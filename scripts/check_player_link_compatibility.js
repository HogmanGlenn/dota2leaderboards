const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const source = fs.readFileSync(path.join(__dirname, "../src/utils/playerKey.js"), "utf8");
  const { createPlayerKey } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  const regions = JSON.parse(fs.readFileSync(0, "utf8"));
  let linksChecked = 0;

  for (const { region, original, snapshots } of regions) {
    const expected = new Map();
    original.forEach((player, index) => {
      const legacyKey = createPlayerKey(region, {
        name: player.name || "Anonymous player",
        teamId: player.team_id,
        countryCode: player.country,
      });
      const keys = player.player_key
        ? [player.player_key, ...(player.player_key_aliases || [])]
        : [legacyKey];
      for (const key of keys) {
        if (!expected.has(key)) expected.set(key, new Set());
        expected.get(key).add(index);
      }
    });

    for (const players of snapshots) {
      const actual = new Map();
      players.forEach((player, index) => {
        for (const key of [player.player_key, ...player.player_key_aliases]) {
          if (!actual.has(key)) actual.set(key, new Set());
          actual.get(key).add(index);
        }
      });
      for (const [key, indexes] of expected) {
        assert.deepEqual(actual.get(key), indexes, `${region}: legacy link ${key} changed its players`);
        linksChecked += 1;
      }
    }
  }
  console.log(`Verified ${linksChecked} legacy and published player-link lookups through migration and transfers.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
