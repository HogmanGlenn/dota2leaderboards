import europeData from "../data/europe/v0001.json";
import { Player } from '../model/Player'

export function getPlayersData() {
  return parseLeaderboard(europeData.leaderboard);
}

function parseLeaderboard(leaderboardData) {
  let players = leaderboardData.map(
    (x) => new Player(!x.country ? "" : x.country.toUpperCase(), x.name, x.rank, x.team_id, x.team_tag)
  );

  // Sort the players by rank in ascending order
  players.sort((a, b) => a.rank - b.rank);

  // Assign a unique rank to each player
  let currentRank = 1;
  players.forEach((player, index) => {
    if (index > 0 && player.rank === players[index - 1].rank) {
      player.rank = currentRank; // Assign the same rank as the previous player
    } else {
      player.rank = currentRank++; // Assign a new rank
    }
  });

  return players;
}