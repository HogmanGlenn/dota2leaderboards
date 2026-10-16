import json
import subprocess
import tempfile
import unittest
from collections import Counter
from copy import deepcopy
from pathlib import Path
from unittest import mock

import player_identity as identity
import update_leaderboards as updater


def payload(*players):
    return {"leaderboard": list(players)}


PLAYER = {"rank": 50, "name": "Player One", "country": "fi", "team_id": 42, "team_tag": "OLD"}


class PlayerIdentityTests(unittest.TestCase):
    def test_every_existing_frontend_link_survives_migration_and_team_changes(self):
        root = Path(__file__).resolve().parents[1]
        regions = []
        for region in updater.REGIONS:
            original = json.loads(updater.payload_path(root / "public/data", region).read_text(encoding="utf-8"))
            migrated = identity.assign_player_identities(region, original, original)
            counts = Counter(identity.profile(player)[:2] for player in original["leaderboard"])
            players = [
                {**player, "team_id": 2_000_000_000 + index, "team_tag": "Transfer"}
                if identity.profile(player)[0] and counts[identity.profile(player)[:2]] == 1
                else player
                for index, player in enumerate(original["leaderboard"])
            ]
            transferred = identity.assign_player_identities(region, payload(*players), migrated)
            restarted = identity.assign_player_identities(region, payload(*players), transferred)
            regions.append({
                "region": region,
                "original": original["leaderboard"],
                "snapshots": [snapshot["leaderboard"] for snapshot in (migrated, transferred, restarted)],
            })
        result = subprocess.run(
            ["node", str(root / "scripts/check_player_link_compatibility.js")],
            input=json.dumps(regions), capture_output=True, text=True, encoding="utf-8",
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_transfer_keeps_original_key_and_history_across_restarts(self):
        original_key = identity.create_player_key("europe", PLAYER)
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            updater.write_payload(output_dir, "europe", payload(PLAYER))
            updater.update_history(output_dir, "europe", payload(PLAYER), 1_900_000_000)
            for index, team in enumerate((77, None, 42), start=1):
                current = {**PLAYER, "rank": 50 - index, "team_id": team, "team_tag": "NEW"}
                if team is None:
                    del current["team_id"]
                timestamp = 1_900_000_000 + index * updater.HISTORY_INTERVAL_SECONDS
                with mock.patch.object(updater, "fetch_region", return_value=payload(current)), \
                     mock.patch.object(updater.time, "time", return_value=timestamp), \
                     mock.patch.object(updater, "write_sitemap"):
                    updater.update_once(output_dir, ("europe",))
                published = json.loads(updater.payload_path(output_dir, "europe").read_text(encoding="utf-8"))
                self.assertEqual(published["leaderboard"][0]["player_key"], original_key)
            history = updater.read_history(output_dir, "europe")
            self.assertEqual(history["players"], [original_key])
            self.assertEqual([sample["r"] for sample in history["samples"]], [[50], [49], [48], [47]])
            aliases = published["leaderboard"][0]["player_key_aliases"]
            self.assertIn(identity.create_player_key("europe", {**PLAYER, "team_id": 77}), aliases)
            self.assertIn(identity.create_player_key("europe", {**PLAYER, "team_id": None}), aliases)

    def test_keeps_identity_through_absence_without_an_eight_hour_sample(self):
        previous = identity.assign_player_identities("europe", payload(PLAYER))
        missing = identity.assign_player_identities("europe", payload({"rank": 1, "name": "Other"}), previous)
        returned = identity.assign_player_identities("europe", payload({**PLAYER, "team_id": 77}), missing)
        self.assertEqual(returned["leaderboard"][0]["player_key"], previous["leaderboard"][0]["player_key"])
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            updater.write_payload(output_dir, "europe", previous)
            updater.update_history(output_dir, "europe", previous, 1_900_000_000)
            before = updater.history_path(output_dir, "europe").read_bytes()
            with mock.patch.object(updater, "fetch_region", return_value=payload({**PLAYER, "team_id": 77})), \
                 mock.patch.object(updater.time, "time", return_value=1_900_000_060), \
                 mock.patch.object(updater, "write_sitemap"):
                updater.update_once(output_dir, ("europe",))
            self.assertEqual(updater.history_path(output_dir, "europe").read_bytes(), before)
            self.assertIn('"team_id":77', updater.payload_path(output_dir, "europe").read_text(encoding="utf-8"))
            self.assertIn('"teams":[42,77]', updater.payload_path(output_dir, "europe").read_text(encoding="utf-8"))

    def test_cosmetic_name_and_tag_changes_keep_identity_without_mutating_inputs(self):
        previous = payload(PLAYER)
        current = payload({**PLAYER, "name": "  Ｐlayer   ONE ", "team_tag": "Renamed", "team_id": 77})
        originals = deepcopy((previous, current))
        result = identity.assign_player_identities("europe", current, previous)
        self.assertEqual(result["leaderboard"][0]["player_key"], identity.create_player_key("europe", PLAYER))
        self.assertEqual((previous, current), originals)

    def test_same_names_different_countries_do_not_merge(self):
        other = {**PLAYER, "rank": 60, "country": "se"}
        result = identity.assign_player_identities("europe", payload({**PLAYER, "team_id": 77}, other), payload(PLAYER, other))
        self.assertEqual(result["leaderboard"][0]["player_key"], identity.create_player_key("europe", PLAYER))
        self.assertNotEqual(result["leaderboard"][0]["player_key"], result["leaderboard"][1]["player_key"])

    def test_ambiguous_same_name_transfer_does_not_borrow_either_history(self):
        other = {**PLAYER, "rank": 60, "team_id": 99}
        previous = identity.assign_player_identities("europe", payload(PLAYER, other))
        result = identity.assign_player_identities("europe", payload({**PLAYER, "team_id": 77}, other), previous)
        old_keys = {player["player_key"] for player in previous["leaderboard"]}
        self.assertNotIn(result["leaderboard"][0]["player_key"], old_keys)
        self.assertEqual(result["leaderboard"][1]["player_key"], previous["leaderboard"][1]["player_key"])

    def test_new_same_name_cannot_share_identity_or_claim_aliases(self):
        first = identity.assign_player_identities("europe", payload(PLAYER))
        transferred = identity.assign_player_identities("europe", payload({**PLAYER, "team_id": 77}), first)
        result = identity.assign_player_identities("europe", payload(PLAYER, {**PLAYER, "team_id": 77, "rank": 60}), transferred)
        first_key, current_key = [player["player_key"] for player in result["leaderboard"]]
        self.assertNotEqual(first_key, current_key)
        self.assertEqual(current_key, first["leaderboard"][0]["player_key"])
        self.assertEqual(result["leaderboard"][0]["player_key_aliases"], [])
        again = identity.assign_player_identities("europe", payload(PLAYER, {**PLAYER, "team_id": 77, "rank": 60}), result)
        self.assertEqual([player["player_key"] for player in again["leaderboard"]], [first_key, current_key])

    def test_anonymous_transfers_are_not_matched_by_an_empty_name(self):
        blank = {**PLAYER, "name": ""}
        previous = identity.assign_player_identities("europe", payload(blank))
        self.assertIn(identity.create_player_key("europe", {**blank, "name": "Anonymous player"}), previous["leaderboard"][0]["player_key_aliases"])
        result = identity.assign_player_identities("europe", payload({**blank, "team_id": 77}), previous)
        self.assertNotEqual(result["leaderboard"][0]["player_key"], previous["leaderboard"][0]["player_key"])

    def test_identical_duplicate_rows_do_not_make_a_transfer_unambiguous(self):
        previous = identity.assign_player_identities("europe", payload(PLAYER))
        transferred = {**PLAYER, "team_id": 77}
        result = identity.assign_player_identities("europe", payload(transferred, {**transferred, "rank": 60}), previous)
        self.assertNotEqual(result["leaderboard"][0]["player_key"], previous["leaderboard"][0]["player_key"])

    def test_hash_collisions_allocate_distinct_keys_and_suppress_unsafe_aliases(self):
        other = {**PLAYER, "name": "Other"}
        with mock.patch.object(identity, "create_player_key", return_value="pcollision"):
            result = identity.assign_player_identities("europe", payload(PLAYER, other))
        self.assertEqual(result["leaderboard"][0]["player_key"], "pcollision")
        self.assertNotEqual(result["leaderboard"][1]["player_key"], "pcollision")
        self.assertEqual(result["leaderboard"][1]["player_key_aliases"], [])

    def test_real_snapshot_migration_preserves_every_key_and_rank(self):
        data_dir = Path(__file__).resolve().parents[1] / "public" / "data"
        for region in updater.REGIONS:
            with self.subTest(region=region):
                previous = json.loads(updater.payload_path(data_dir, region).read_text(encoding="utf-8"))
                expected = updater.build_rank_snapshot(region, previous)
                original = deepcopy(previous)
                migrated = identity.assign_player_identities(region, previous, previous)
                self.assertEqual(updater.build_rank_snapshot(region, migrated), expected)
                self.assertEqual(previous, original)
                again = identity.assign_player_identities(region, previous, migrated)
                self.assertEqual(again, migrated)
                history = updater.read_history(data_dir, region)
                timestamp = max(sample["t"] for sample in history["samples"]) + updater.HISTORY_INTERVAL_SECONDS
                continued = updater.remap_history_samples(history, timestamp, updater.build_rank_snapshot(region, migrated))

                def decoded_samples(data):
                    return [
                        (sample["t"], {data["players"][index]: rank for index, rank in zip(sample["i"], sample["r"])})
                        for sample in data["samples"]
                        if sample["t"] >= timestamp - updater.HISTORY_RETENTION_SECONDS
                    ]

                self.assertEqual(decoded_samples(continued)[:-1], decoded_samples(history))

    def test_corrupt_persisted_state_keeps_all_regional_files_unchanged(self):
        corrupt_states = (
            ("snapshot", b'{'),
            ("registry", {"version": 2, "players": {}}),
            ("missing_registry", None),
            ("invalid_key", []),
            ("registry", {"version": 1, "players": {"pbad": {"name": "Player", "country": "fi", "teams": "bad"}}}),
            ("history", b'{'),
            ("sample", {"t": 1_900_000_000, "i": [999], "r": [1]}),
            ("sample", {"t": 1_900_000_000, "i": [0], "r": []}),
        )
        for kind, corruption in corrupt_states:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                output_dir = Path(directory)
                previous = identity.assign_player_identities("europe", payload(PLAYER))
                if kind == "registry":
                    previous["player_identities"] = corruption
                if kind == "missing_registry":
                    del previous["player_identities"]
                if kind == "invalid_key":
                    previous["leaderboard"][0]["player_key"] = corruption
                updater.write_payload(output_dir, "europe", previous)
                updater.update_history(output_dir, "europe", payload(PLAYER), 1_900_000_000)
                if kind == "snapshot":
                    updater.payload_path(output_dir, "europe").write_bytes(corruption)
                if kind == "history":
                    updater.history_path(output_dir, "europe").write_bytes(corruption)
                if kind == "sample":
                    history = updater.read_history(output_dir, "europe")
                    updater.write_history(output_dir, "europe", {**history, "samples": [corruption]})
                paths = (updater.payload_path(output_dir, "europe"), updater.history_path(output_dir, "europe"))
                before = [path.read_bytes() for path in paths]
                with mock.patch.object(updater, "fetch_region", return_value=payload({**PLAYER, "team_id": 77})), \
                     mock.patch.object(updater, "write_sitemap"):
                    result = updater.update_once(output_dir, ("europe",))
                self.assertEqual(result.kept, ("europe",))
                self.assertEqual([path.read_bytes() for path in paths], before)

    def test_interrupted_snapshot_write_preserves_registry_and_history(self):
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            previous = identity.assign_player_identities("europe", payload(PLAYER))
            updater.write_payload(output_dir, "europe", previous)
            updater.update_history(output_dir, "europe", previous, 1_900_000_000)
            paths = (updater.payload_path(output_dir, "europe"), updater.history_path(output_dir, "europe"))
            before = [path.read_bytes() for path in paths]
            with mock.patch.object(updater, "fetch_region", return_value=payload({**PLAYER, "team_id": 77})), \
                 mock.patch.object(updater.os, "replace", side_effect=OSError("disk unavailable")):
                with self.assertRaisesRegex(OSError, "disk unavailable"):
                    updater.update_once(output_dir, ("europe",))
            self.assertEqual([path.read_bytes() for path in paths], before)
            self.assertEqual(list(paths[0].parent.glob(".v0001-*.json")), [])

    def test_history_write_failure_recovers_using_the_published_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            previous = identity.assign_player_identities("europe", payload(PLAYER))
            updater.write_payload(output_dir, "europe", previous)
            updater.update_history(output_dir, "europe", previous, 1_900_000_000)
            before = updater.history_path(output_dir, "europe").read_bytes()
            timestamp = 1_900_000_000 + updater.HISTORY_INTERVAL_SECONDS
            with mock.patch.object(updater, "fetch_region", return_value=payload({**PLAYER, "team_id": 77})), \
                 mock.patch.object(updater.time, "time", return_value=timestamp), \
                 mock.patch.object(updater, "write_sitemap"):
                with mock.patch.object(updater, "write_history", side_effect=OSError("disk unavailable")):
                    with self.assertRaisesRegex(OSError, "disk unavailable"):
                        updater.update_once(output_dir, ("europe",))
                self.assertEqual(updater.history_path(output_dir, "europe").read_bytes(), before)
                updater.update_once(output_dir, ("europe",))
            history = updater.read_history(output_dir, "europe")
            self.assertEqual(history["players"], [previous["leaderboard"][0]["player_key"]])
            self.assertEqual(len(history["samples"]), 2)


if __name__ == "__main__":
    unittest.main()
