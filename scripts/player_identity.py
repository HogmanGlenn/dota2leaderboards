"""Carry legacy player keys across unambiguous changes in team representation."""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from copy import deepcopy
from typing import Any


PLAYER_KEY_PATTERN = re.compile(r"p[a-z0-9]+\Z")


def normalize_player_name(name: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", name).strip().lower().split())


def hash_base36(value: str) -> str:
    hash_value = 0x811C9DC5
    encoded = value.encode("utf-16le")
    for index in range(0, len(encoded), 2):
        code_unit = encoded[index] | (encoded[index + 1] << 8)
        hash_value ^= code_unit
        hash_value = (hash_value * 0x01000193) & 0xFFFFFFFF

    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    if hash_value == 0:
        return "p0"
    encoded_hash = ""
    while hash_value:
        hash_value, remainder = divmod(hash_value, 36)
        encoded_hash = digits[remainder] + encoded_hash
    return f"p{encoded_hash}"


def create_player_key(region: str, player: dict[str, Any]) -> str:
    # This legacy hash also appears in existing URLs and history. Keep it frozen.
    country = player.get("country")
    team_id = player.get("team_id")
    parts = (
        region,
        normalize_player_name(player.get("name", "")),
        "" if team_id is None else str(team_id),
        country.lower() if isinstance(country, str) else "",
    )
    return hash_base36("|".join(parts))


def profile(player: dict[str, Any]) -> tuple[str, str, int | None]:
    return (
        normalize_player_name(player["name"]),
        (player.get("country") or "").lower(),
        player.get("team_id"),
    )


def read_identities(previous: dict[str, Any]) -> dict[str, dict[str, Any]]:
    registry = previous.get("player_identities")
    if registry is None:
        return {}
    if not isinstance(registry, dict) or registry.get("version") != 1:
        raise ValueError("unsupported player identity registry")
    players = registry.get("players")
    if not isinstance(players, dict):
        raise ValueError("invalid player identity registry")
    for key, record in players.items():
        if (
            not PLAYER_KEY_PATTERN.fullmatch(key)
            or not isinstance(record, dict)
            or not isinstance(record.get("name"), str)
            or not isinstance(record.get("country"), str)
            or not isinstance(record.get("teams"), list)
            or not record["teams"]
            or any(team is not None and type(team) is not int for team in record["teams"])
        ):
            raise ValueError("invalid player identity record")
    return deepcopy(players)


def legacy_keys(region: str, record: dict[str, Any]) -> set[str]:
    names = [record["name"]]
    # Older browsers hashed the display label for truly empty names.
    if record["name"] == "":
        names.append("Anonymous player")
    return {
        create_player_key(region, {"name": name, "country": record["country"], "team_id": team})
        for name in names
        for team in record["teams"]
    }


def assign_player_identities(
    region: str, payload: dict[str, Any], previous: dict[str, Any] | None = None
) -> dict[str, Any]:
    previous = previous or {}
    records = read_identities(previous)
    occupied = set(records)
    for record in records.values():
        occupied.update(legacy_keys(region, record))

    def add_identity(signature: tuple[str, str, int | None]) -> str:
        name, country, team = signature
        key = create_player_key(region, {"name": name, "country": country, "team_id": team})
        salt = 0
        while key in occupied:
            salt += 1
            key = hash_base36(f"{region}|{name}|{country}|{team}|identity:{salt}")
        records[key] = {"name": name, "country": country, "teams": [team]}
        occupied.add(key)
        occupied.update(legacy_keys(region, records[key]))
        return key

    # Seed from the last published snapshot, before looking at the new teams.
    if "player_identities" not in previous:
        if any("player_key" in player for player in previous.get("leaderboard", [])):
            raise ValueError("published snapshot is missing its identity registry")
        for signature in dict.fromkeys(profile(player) for player in previous.get("leaderboard", [])):
            add_identity(signature)
    else:
        for player in previous.get("leaderboard", []):
            key = player.get("player_key")
            if not isinstance(key, str):
                raise ValueError("published player has no valid identity key")
            record = records.get(key)
            name, country, team = profile(player)
            if (
                not record
                or (name, country) != (record["name"], record["country"])
                or team not in record["teams"]
            ):
                raise ValueError("published player does not match the identity registry")

    by_profile: dict[tuple[str, str, int | None], list[str]] = defaultdict(list)
    by_name_country: dict[tuple[str, str], list[str]] = defaultdict(list)
    for key, record in records.items():
        name_country = (record["name"], record["country"])
        by_name_country[name_country].append(key)
        for team in record["teams"]:
            by_profile[(*name_country, team)].append(key)

    signatures = dict.fromkeys(profile(player) for player in payload["leaderboard"])
    current_name_counts: dict[tuple[str, str], int] = defaultdict(int)
    for player in payload["leaderboard"]:
        name, country, _ = profile(player)
        current_name_counts[(name, country)] += 1

    previous_keys = {
        profile(player): player["player_key"]
        for player in previous.get("leaderboard", [])
        if "player_key" in player
    }
    exact_matches: dict[str, list[tuple[str, str, int | None]]] = defaultdict(list)
    for signature in signatures:
        candidates = by_profile[signature]
        key = previous_keys.get(signature)
        if key or len(candidates) == 1:
            exact_matches[key or candidates[0]].append(signature)

    assigned: dict[tuple[str, str, int | None], str] = {}
    for key, matches in exact_matches.items():
        if len(matches) == 1:
            assigned[matches[0]] = key
        else:
            # Two accounts can adopt profiles this identity used at different
            # times. Only the last published profile may keep its key.
            for signature in matches:
                if previous_keys.get(signature) == key:
                    assigned[signature] = key
                    break

    for signature in signatures:
        if signature in assigned:
            continue
        name, country, team = signature
        candidates = by_name_country[(name, country)]
        if name and len(candidates) == 1 and current_name_counts[(name, country)] == 1:
            key = candidates[0]
            records[key]["teams"].append(team)
            occupied.update(legacy_keys(region, records[key]))
        else:
            key = add_identity(signature)
        assigned[signature] = key

    # A legacy hash can collide or belong to ambiguous profiles. Never publish
    # an alias that could redirect another identity's links or history.
    owners: dict[str, set[str]] = defaultdict(set)
    for key, record in records.items():
        for alias in legacy_keys(region, record) | {key}:
            owners[alias].add(key)

    leaderboard = []
    for player in payload["leaderboard"]:
        key = assigned[profile(player)]
        aliases = sorted(
            alias for alias in legacy_keys(region, records[key]) - {key}
            if owners[alias] == {key}
        )
        leaderboard.append({**player, "player_key": key, "player_key_aliases": aliases})

    return {
        **payload,
        "leaderboard": leaderboard,
        "player_identities": {"version": 1, "players": records},
    }
