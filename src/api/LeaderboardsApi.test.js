import { getLeaderboardData } from "./LeaderboardsApi";

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
