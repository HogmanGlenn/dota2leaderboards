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
            "fetched_at": 1_700_000_100,
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

            with mock.patch.object(
                updater, "fetch_region", side_effect=fake_fetch
            ), mock.patch.object(updater.time, "time", return_value=1_900_000_000):
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
            self.assertEqual(americas, {**new_payload, "fetched_at": 1_900_000_000})

    def test_update_once_refreshes_timestamp_when_payload_is_unchanged(self):
        api_payload = {
            "time_posted": 1_700_000_000,
            "leaderboard": [{"rank": 1, "name": "Player"}],
        }
        existing_payload = {**api_payload, "fetched_at": 1_700_000_100}

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            updater.write_payload(output_dir, "europe", existing_payload)

            with mock.patch.object(
                updater, "fetch_region", return_value=api_payload
            ), mock.patch.object(updater.time, "time", return_value=1_900_000_000):
                updater.update_once(output_dir, ("europe",))

            written = json.loads(
                (output_dir / "europe" / "v0001.json").read_text(encoding="utf-8")
            )
            self.assertEqual(written, {**api_payload, "fetched_at": 1_900_000_000})

    def test_update_once_writes_canonical_sitemap_with_verifiable_lastmod(self):
        payloads = {
            "europe": {
                "time_posted": 1_700_000_000,
                "leaderboard": [{"rank": 1, "name": "Europe Player"}],
            },
            "americas": {
                "time_posted": 1_800_000_000,
                "leaderboard": [{"rank": 1, "name": "Americas Player"}],
            },
        }

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)

            with mock.patch.object(
                updater,
                "fetch_region",
                side_effect=lambda region, attempts, timeout: payloads[region],
            ), mock.patch.object(updater.time, "time", side_effect=[1_900_000_000, 1_900_003_600]):
                updater.update_once(output_dir, ("europe", "americas"))

            sitemap = (output_dir / "sitemap.xml").read_text(encoding="utf-8")
            self.assertIn("<loc>https://dota2leaderboards.com/</loc>", sitemap)
            self.assertIn("<lastmod>2030-03-17T18:46:40Z</lastmod>", sitemap)
            self.assertNotIn("?region=", sitemap)
            self.assertNotIn("<changefreq>", sitemap)
            self.assertNotIn("<priority>", sitemap)

    def test_player_key_generation_is_deterministic(self):
        player = {"rank": 1, "name": "  Player   One ", "team_id": 42, "country": "FI"}

        self.assertEqual(
            updater.create_player_key("europe", player),
            updater.create_player_key("europe", {**player, "name": "player one"}),
        )
        self.assertNotEqual(
            updater.create_player_key("europe", player),
            updater.create_player_key("americas", player),
        )
        self.assertEqual(updater.create_player_key("europe", player), "pge6p8b")
        self.assertEqual(
            updater.create_player_key(
                "europe",
                {"name": "医者watson`", "team_id": 9823272, "country": "kz"},
            ),
            "p1o9lax3",
        )

    def test_update_once_creates_separate_history_file(self):
        api_payload = {
            "time_posted": 1_700_000_000,
            "leaderboard": [{"rank": 1, "name": "Player", "team_id": 42, "country": "fi"}],
        }

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)

            with mock.patch.object(
                updater, "fetch_region", return_value=api_payload
            ), mock.patch.object(updater.time, "time", return_value=1_900_000_000):
                updater.update_once(output_dir, ("europe",))

            current = json.loads(
                (output_dir / "europe" / "v0001.json").read_text(encoding="utf-8")
            )
            history = json.loads(
                (output_dir / "europe" / "history.v0001.json").read_text(encoding="utf-8")
            )

            self.assertEqual(current, {**api_payload, "fetched_at": 1_900_000_000})
            self.assertEqual(history["interval_hours"], 8)
            self.assertEqual(history["samples"][0]["t"], 1_900_000_000)
            self.assertEqual(history["samples"][0]["r"], [1])

    def test_history_appends_only_after_eight_hours(self):
        payload = {
            "leaderboard": [{"rank": 1, "name": "Player", "team_id": 42, "country": "fi"}],
            "fetched_at": 1_900_000_000,
        }

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            self.assertTrue(updater.update_history(output_dir, "europe", payload, 1_900_000_000))
            self.assertFalse(updater.update_history(output_dir, "europe", payload, 1_900_000_000 + 60))
            self.assertTrue(
                updater.update_history(
                    output_dir,
                    "europe",
                    {**payload, "leaderboard": [{**payload["leaderboard"][0], "rank": 2}]},
                    1_900_000_000 + updater.HISTORY_INTERVAL_SECONDS,
                )
            )

            history = json.loads(
                (output_dir / "europe" / "history.v0001.json").read_text(encoding="utf-8")
            )
            self.assertEqual([sample["r"][0] for sample in history["samples"]], [1, 2])

    def test_history_is_pruned_to_thirty_days(self):
        player = {"rank": 1, "name": "Player", "team_id": 42, "country": "fi"}

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            updater.update_history(
                output_dir,
                "europe",
                {"leaderboard": [player]},
                1_900_000_000 - updater.HISTORY_RETENTION_SECONDS - updater.HISTORY_INTERVAL_SECONDS,
            )
            updater.update_history(output_dir, "europe", {"leaderboard": [player]}, 1_900_000_000)

            history = json.loads(
                (output_dir / "europe" / "history.v0001.json").read_text(encoding="utf-8")
            )
            self.assertEqual(len(history["samples"]), 1)
            self.assertEqual(history["samples"][0]["t"], 1_900_000_000)

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

    def test_failed_refresh_keeps_existing_history(self):
        existing_payload = {
            "time_posted": 1_700_000_000,
            "leaderboard": [{"rank": 1, "name": "Existing"}],
        }

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            updater.write_payload(output_dir, "europe", existing_payload)
            updater.write_history(
                output_dir,
                "europe",
                {
                    "version": 1,
                    "interval_hours": 8,
                    "retention_days": 30,
                    "players": ["p123"],
                    "samples": [{"t": 1_700_000_000, "i": [0], "r": [1]}],
                },
            )

            with mock.patch.object(updater, "fetch_region", side_effect=RuntimeError("timeout")):
                result = updater.update_once(output_dir, ("europe",))

            history = json.loads(
                (output_dir / "europe" / "history.v0001.json").read_text(encoding="utf-8")
            )
            self.assertEqual(result.kept, ("europe",))
            self.assertEqual(history["samples"], [{"t": 1_700_000_000, "i": [0], "r": [1]}])


if __name__ == "__main__":
    unittest.main()
