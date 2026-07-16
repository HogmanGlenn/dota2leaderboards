"""Download and validate the public Dota 2 division leaderboards."""

from __future__ import annotations

import argparse
import json
import os
import socket
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


REGIONS = ("americas", "europe", "se_asia", "china")
API_URL = (
    "https://www.dota2.com/webapi/ILeaderboard/GetDivisionLeaderboard/v0001"
    "?division={region}&leaderboard=0"
)
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[1] / "public" / "data"
DEFAULT_ATTEMPTS = 4
DEFAULT_TIMEOUT = 30
DEFAULT_INTERVAL = 30
MIN_EXPECTED_PLAYERS = 1


class PayloadValidationError(ValueError):
    """Raised when Dota returns JSON that is not safe to publish."""


@dataclass(frozen=True)
class UpdateResult:
    updated: tuple[str, ...]
    kept: tuple[str, ...]
    failures: dict[str, str]


def _require_optional_string(player: dict[str, Any], key: str, region: str, index: int) -> None:
    value = player.get(key)
    if value is not None and not isinstance(value, str):
        raise PayloadValidationError(f"{region}: entry {index} has an invalid {key}")


def validate_payload(
    payload: Any,
    region: str,
    *,
    min_players: int = MIN_EXPECTED_PLAYERS,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise PayloadValidationError(f"{region}: API response is not a JSON object")

    time_posted = payload.get("time_posted")
    if time_posted is not None and (
        not isinstance(time_posted, int) or time_posted <= 0
    ):
        raise PayloadValidationError(f"{region}: API response has an invalid timestamp")

    leaderboard = payload.get("leaderboard")
    if not isinstance(leaderboard, list) or len(leaderboard) < min_players:
        raise PayloadValidationError(f"{region}: API response has no leaderboard entries")

    for index, player in enumerate(leaderboard):
        if not isinstance(player, dict):
            raise PayloadValidationError(f"{region}: entry {index} is not an object")
        if not isinstance(player.get("rank"), int) or player["rank"] < 1:
            raise PayloadValidationError(f"{region}: entry {index} has an invalid rank")
        if not isinstance(player.get("name"), str):
            raise PayloadValidationError(f"{region}: entry {index} has an invalid name")
        if "team_id" in player and not isinstance(player["team_id"], int):
            raise PayloadValidationError(f"{region}: entry {index} has an invalid team_id")
        _require_optional_string(player, "team_tag", region, index)
        _require_optional_string(player, "country", region, index)

    return payload


def decode_json_response(raw_body: bytes, region: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw_body.decode("utf-8-sig"))
    except UnicodeDecodeError as error:
        raise PayloadValidationError(f"{region}: response is not valid UTF-8") from error
    except json.JSONDecodeError as error:
        raise PayloadValidationError(f"{region}: response is not valid JSON") from error

    return validate_payload(payload, region)


def fetch_region(
    region: str,
    attempts: int = DEFAULT_ATTEMPTS,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    request = Request(
        API_URL.format(region=region),
        headers={"Accept": "application/json", "User-Agent": "dota2leaderboards-updater/1.0"},
    )

    for attempt in range(1, attempts + 1):
        try:
            with urlopen(request, timeout=timeout) as response:
                status = getattr(response, "status", response.getcode())
                if status != 200:
                    raise RuntimeError(f"{region}: unexpected HTTP status {status}")
                payload = decode_json_response(response.read(), region)
            return payload
        except (
            HTTPError,
            URLError,
            TimeoutError,
            socket.timeout,
            RuntimeError,
            PayloadValidationError,
        ) as error:
            if attempt == attempts:
                raise RuntimeError(
                    f"{region}: failed after {attempts} attempts: {error}"
                ) from error
            delay = 2 ** (attempt - 1)
            print(f"{region}: attempt {attempt} failed ({error}); retrying in {delay}s")
            time.sleep(delay)

    raise AssertionError("retry loop exited unexpectedly")


def write_payload(output_dir: Path, region: str, payload: dict[str, Any]) -> None:
    target_dir = output_dir / region
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / "v0001.json"

    # Replace each file atomically so a terminated process cannot leave truncated JSON.
    descriptor, temporary_name = tempfile.mkstemp(
        dir=target_dir, prefix=".v0001-", suffix=".json"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.write("\n")
        os.replace(temporary_name, target)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def payload_path(output_dir: Path, region: str) -> Path:
    return output_dir / region / "v0001.json"


def has_existing_payload(output_dir: Path, region: str) -> bool:
    return payload_path(output_dir, region).is_file()


def update_once(
    output_dir: Path,
    regions: tuple[str, ...],
    *,
    attempts: int = DEFAULT_ATTEMPTS,
    timeout: int = DEFAULT_TIMEOUT,
) -> UpdateResult:
    payloads: dict[str, dict[str, Any]] = {}
    failures: dict[str, str] = {}
    missing_existing_data: list[str] = []

    for region in regions:
        print(f"{region}: downloading")
        try:
            payload = fetch_region(region, attempts=attempts, timeout=timeout)
        except RuntimeError as error:
            failures[region] = str(error)
            if has_existing_payload(output_dir, region):
                print(f"{region}: keeping existing data ({error})")
            else:
                missing_existing_data.append(region)
            continue

        print(f"{region}: validated {len(payload['leaderboard']):,} players")
        payloads[region] = {**payload, "fetched_at": int(time.time())}

    if missing_existing_data:
        names = ", ".join(missing_existing_data)
        raise RuntimeError(f"cannot keep previous data; no existing file for: {names}")

    for region, payload in payloads.items():
        write_payload(output_dir, region, payload)
        print(f"{region}: wrote {payload_path(output_dir, region)}")

    kept = tuple(region for region in regions if region in failures)
    return UpdateResult(updated=tuple(payloads), kept=kept, failures=failures)


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"destination directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--region",
        action="append",
        choices=REGIONS,
        dest="regions",
        help="update one region; may be provided more than once",
    )
    parser.add_argument(
        "--attempts",
        type=positive_int,
        default=DEFAULT_ATTEMPTS,
        help=f"download attempts per region (default: {DEFAULT_ATTEMPTS})",
    )
    parser.add_argument(
        "--timeout",
        type=positive_int,
        default=DEFAULT_TIMEOUT,
        help=f"request timeout in seconds (default: {DEFAULT_TIMEOUT})",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="keep refreshing until stopped; useful for local inspection",
    )
    parser.add_argument(
        "--interval",
        type=positive_int,
        default=DEFAULT_INTERVAL,
        help=f"seconds between watch refreshes (default: {DEFAULT_INTERVAL})",
    )
    parser.add_argument(
        "--cycles",
        type=positive_int,
        default=None,
        help="stop watch mode after this many refresh attempts",
    )
    parser.add_argument(
        "--runs",
        type=positive_int,
        default=None,
        help="run this many refresh attempts, sleeping --interval seconds between them",
    )
    parser.add_argument(
        "--max-runtime",
        type=positive_int,
        default=None,
        help="maximum watch runtime in seconds",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    regions = tuple(args.regions or REGIONS)
    cycles = args.runs if args.runs is not None else args.cycles
    started_at = time.monotonic()

    if not args.watch and cycles is None:
        update_once(args.output_dir, regions, attempts=args.attempts, timeout=args.timeout)
        return

    cycle = 0
    while cycles is None or cycle < cycles:
        cycle += 1
        update_once(args.output_dir, regions, attempts=args.attempts, timeout=args.timeout)

        if cycles is not None and cycle >= cycles:
            break
        if args.max_runtime is not None and time.monotonic() - started_at >= args.max_runtime:
            break

        time.sleep(args.interval)
        if args.max_runtime is not None and time.monotonic() - started_at >= args.max_runtime:
            break


if __name__ == "__main__":
    main()
