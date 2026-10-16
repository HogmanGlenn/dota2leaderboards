import {
  parseSharedPins,
  pinnedPlayerId,
  resolvePinnedPlayerIds,
  serializeSharedPins,
  togglePinnedPlayer,
} from "./pins";

test("toggles compact local pin entries", () => {
  const player = {
    playerKey: "p123",
    name: "Player",
    teamTag: "D2L",
    countryCode: "FI",
    rank: 12,
  };

  const pinned = togglePinnedPlayer([], "europe", player);
  expect(pinned).toEqual([{
    region: "europe",
    playerKey: "p123",
    name: "Player",
    teamTag: "D2L",
    countryCode: "FI",
    rank: 12,
  }]);
  expect(togglePinnedPlayer(pinned, "europe", player)).toEqual([]);
});

test("resolves old aliases, deduplicates pins, and preserves other regions and absent players", () => {
  const ids = new Set(["europe:pold", "europe:pstable", "europe:pabsent", "americas:pold"]);
  const resolved = resolvePinnedPlayerIds(ids, "europe", [{ playerKey: "pstable", playerKeyAliases: ["pold"] }]);
  expect([...resolved]).toEqual(["europe:pstable", "europe:pabsent", "americas:pold"]);
  expect(ids.size).toBe(4);
});

test("unpinning an identity removes its stored aliases without changing unrelated pins", () => {
  const pins = [
    { region: "europe", playerKey: "pold" },
    { region: "europe", playerKey: "pstable" },
    { region: "americas", playerKey: "pold" },
  ];
  expect(togglePinnedPlayer(pins, "europe", { playerKey: "pstable", playerKeyAliases: ["pold"] }))
    .toEqual([{ region: "americas", playerKey: "pold" }]);
});

test("serializes and parses shared pins", () => {
  const pins = [
    { region: "europe", playerKey: "p123" },
    { region: "europe", playerKey: "p456" },
    { region: "americas", playerKey: "p789" },
  ];

  const parsed = parseSharedPins(serializeSharedPins(pins));

  expect(parsed.has(pinnedPlayerId("europe", "p123"))).toBe(true);
  expect(parsed.has(pinnedPlayerId("europe", "p456"))).toBe(true);
  expect(parsed.has(pinnedPlayerId("americas", "p789"))).toBe(true);
});
