import {
  parseSharedPins,
  pinnedPlayerId,
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
