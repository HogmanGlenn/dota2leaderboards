import { getLeaderboardData } from "./LeaderboardsApi";
import { createPlayerKey } from "../utils/playerKey";

afterEach(() => jest.restoreAllMocks());

test("uses the successful fetch timestamp when available", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      time_posted: 1_700_000_000,
      fetched_at: 1_900_000_000,
      leaderboard: [{ rank: 1, name: "Player" }],
    }),
  });

  const result = await getLeaderboardData("europe");

  expect(result.updatedAt).toBe(1_900_000_000);
});

test("falls back to Dota's timestamp for existing data files", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      time_posted: 1_700_000_000,
      leaderboard: [{ rank: 1, name: "Player" }],
    }),
  });

  const result = await getLeaderboardData("europe");

  expect(result.updatedAt).toBe(1_700_000_000);
});

test("assigns unique find keys when stable player identities are duplicated", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      time_posted: 1_700_000_000,
      leaderboard: [
        { rank: 30, name: "Duplicate", team_id: 10, country: "fi" },
        { rank: 60, name: "Duplicate", team_id: 10, country: "fi" },
      ],
    }),
  });

  const { players } = await getLeaderboardData("europe");

  expect(players[0].playerKey).toBe(players[1].playerKey);
  expect(players[0].findKey).not.toBe(players[1].findKey);
});

test("uses the published identity after a team transfer and retains legacy link aliases", async () => {
  const originalKey = createPlayerKey("europe", { name: "Player", teamId: 42, countryCode: "FI" });
  const transferKey = createPlayerKey("europe", { name: "Player", teamId: 77, countryCode: "FI" });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      leaderboard: [{
        rank: 10, name: "Player", country: "fi", team_id: 77, team_tag: "NEW",
        player_key: originalKey, player_key_aliases: [transferKey],
      }],
    }),
  });
  const { players } = await getLeaderboardData("europe");
  expect(players[0]).toMatchObject({
    playerKey: originalKey, playerKeyAliases: [transferKey], teamId: 77, teamTag: "NEW",
  });
});

test("keeps legacy keys for snapshots without published identities", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ leaderboard: [{ rank: 1, name: "  Player   One ", team_id: 42, country: "FI" }] }),
  });
  const { players } = await getLeaderboardData("europe");
  expect(players[0].playerKey).toBe("pge6p8b");
  expect(players[0].playerKeyAliases).toEqual([]);
});
