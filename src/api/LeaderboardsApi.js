import { Player } from "../model/Player";
import { createPlayerKey } from "../utils/playerKey";
import { getCountrySlug } from "../utils/countries";

const publicUrl = process.env.PUBLIC_URL || "";

export async function getLeaderboardData(region = "europe", options = {}) {
  const response = await fetch(`${publicUrl}/data/${region}/v0001.json`, {
    cache: options.cache,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Leaderboard request failed (${response.status}).`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.leaderboard) || payload.leaderboard.length === 0) {
    throw new Error("Leaderboard data is not in the expected format.");
  }

  const players = payload.leaderboard
    .map((entry) => {
      const countryCode = typeof entry.country === "string" ? entry.country.toUpperCase() : "";
      const name = entry.name || "Anonymous player";
      const teamTag = entry.team_tag || "";

      return new Player(
        countryCode,
        name,
        Number(entry.rank),
        entry.team_id,
        teamTag,
        getCountrySlug(countryCode),
        `${name} ${teamTag}`.toLocaleLowerCase(),
        createPlayerKey(region, { name, teamId: entry.team_id, countryCode })
      );
    })
    .filter((player) => Number.isFinite(player.rank))
    .sort((a, b) => a.rank - b.rank);

  return {
    players,
    updatedAt: Number(payload.fetched_at) || Number(payload.time_posted) || null,
  };
}
