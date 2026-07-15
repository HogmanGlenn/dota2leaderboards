import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import update_leaderboards as updater


class LeaderboardUpdaterTests(unittest.TestCase):
    def test_validates_expected_payload(self):
        payload = {
            "time_posted": 1_700_000_000,
            "leaderboard": [{"rank": 1, "name": "Player", "country": "fi"}],
        }

        self.assertIs(updater.validate_payload(payload, "europe"), payload)

    def test_rejects_empty_or_malformed_entries(self):
        with self.assertRaisesRegex(ValueError, "no leaderboard entries"):
            updater.validate_payload({"leaderboard": []}, "europe")

        with self.assertRaisesRegex(ValueError, "invalid rank"):
            updater.validate_payload(
                {"leaderboard": [{"rank": 0, "name": "Player"}]}, "europe"
            )

    def test_allows_tied_ranks_from_the_api(self):
        payload = {
            "leaderboard": [
                {"rank": 1, "name": "Player A"},
                {"rank": 1, "name": "Player B"},
            ]
        }

        self.assertIs(updater.validate_payload(payload, "europe"), payload)

    def test_allows_blank_player_names_from_the_api(self):
        payload = {"leaderboard": [{"rank": 1, "name": ""}]}

        self.assertIs(updater.validate_payload(payload, "europe"), payload)

    def test_decodes_json_response_bytes(self):
        payload = updater.decode_json_response(
            b'{"time_posted":1700000000,"leaderboard":[{"rank":1,"name":"Player"}]}',
            "europe",
        )

        self.assertEqual(payload["leaderboard"][0]["name"], "Player")

    def test_rejects_invalid_json_response_bytes(self):
        with self.assertRaisesRegex(ValueError, "not valid JSON"):
            updater.decode_json_response(b"{", "europe")

    def test_writes_valid_json_to_the_region_path(self):
        payload = {"leaderboard": [{"rank": 1, "name": "Player"}]}

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            updater.write_payload(output_dir, "europe", payload)
            target = output_dir / "europe" / "v0001.json"

            self.assertEqual(json.loads(target.read_text(encoding="utf-8")), payload)
            self.assertEqual(list(target.parent.glob(".v0001-*.json")), [])

    def test_update_once_updates_good_regions_and_keeps_failed_regions(self):
        existing_payload = {
            "time_posted": 1_700_000_000,
            "leaderboard": [{"rank": 1, "name": "Existing"}],
        }
        new_payload = {
            "time_posted": 1_800_000_000,
            "leaderboard": [{"rank": 1, "name": "New"}],
        }

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            updater.write_payload(output_dir, "europe", existing_payload)

            def fake_fetch(region, attempts, timeout):
                if region == "europe":
                    raise RuntimeError("empty response")
                return new_payload

            with mock.patch.object(updater, "fetch_region", side_effect=fake_fetch):
                result = updater.update_once(output_dir, ("europe", "americas"))

            europe = json.loads(
                (output_dir / "europe" / "v0001.json").read_text(encoding="utf-8")
            )
            americas = json.loads(
                (output_dir / "americas" / "v0001.json").read_text(encoding="utf-8")
            )
            self.assertEqual(result.updated, ("americas",))
            self.assertEqual(result.kept, ("europe",))
            self.assertIn("empty response", result.failures["europe"])
            self.assertEqual(europe, existing_payload)
            self.assertEqual(americas, new_payload)

    def test_update_once_fails_when_bad_region_has_no_previous_data(self):
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch.object(updater, "fetch_region", side_effect=RuntimeError("timeout")):
                with self.assertRaisesRegex(RuntimeError, "no existing file"):
                    updater.update_once(Path(directory), ("europe",))

    def test_watch_mode_skips_failed_refresh_and_keeps_running(self):
        existing_payload = {
            "time_posted": 1_700_000_000,
            "leaderboard": [{"rank": 1, "name": "Existing"}],
        }

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            updater.write_payload(output_dir, "europe", existing_payload)

            with mock.patch.object(
                updater,
                "fetch_region",
                side_effect=[
                    RuntimeError("timeout"),
                    {"leaderboard": [{"rank": 1, "name": "Recovered"}]},
                ],
            ), mock.patch.object(updater.time, "sleep") as sleep:
                with mock.patch(
                    "sys.argv",
                    [
                        "update_leaderboards.py",
                        "--output-dir",
                        str(output_dir),
                        "--region",
                        "europe",
                        "--watch",
                        "--cycles",
                        "2",
                        "--interval",
                        "30",
                    ],
                ):
                    updater.main()

            sleep.assert_called_once_with(30)
            written = json.loads(
                (output_dir / "europe" / "v0001.json").read_text(encoding="utf-8")
            )
            self.assertEqual(written["leaderboard"][0]["name"], "Recovered")


if __name__ == "__main__":
    unittest.main()
