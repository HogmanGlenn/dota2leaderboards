import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import * as React from "react";
import { Player } from "../../model/Player";
import europeData from "../../data/europe/v0001.json";
import "./Leaderboard.css";

//TODO: It's the duplicates that cause the issue.

// Yoinked from https://dev.to/jorik/country-code-to-flag-emoji-a21
function getFlagEmoji(countryCode) {
  if (!countryCode) return "";

  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt());

  return String.fromCodePoint(...codePoints);
}

export function createData(leaderboardJson) {
  let players = leaderboardJson.map(
    (x) => new Player(x.country, x.name, x.rank, x.team_id, x.team_tag)
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

export default function Leaderboard({ filteredPlayers }) {
  const displayPlayers =
    filteredPlayers.length > 0
      ? filteredPlayers
      : createData(europeData.leaderboard);

  return (
    <TableContainer
      component={Paper}
      style={{
        width: 650,
        margin: "50px",
      }}
    >
      <Table
        sx={{ maxWidth: 650 }}
        size="small"
        aria-label="Dota 2 Leaderboards"
      >
        <TableHead>
          <TableRow>
            <TableCell>Country</TableCell>
            <TableCell align="right">Rank</TableCell>
            <TableCell align="right">Name</TableCell>
            <TableCell align="right">Team</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {displayPlayers.map((player) => (
            <TableRow
              key={`${player.name}_${player.rank}`}
              sx={{ "&:last-child td, &:last-child th": { border: 5 } }}
            >
              <TableCell component="th" scope="row">
                {getFlagEmoji(player.countryCode)}
              </TableCell>
              <TableCell align="right">{player.rank}</TableCell>
              <TableCell align="right">{player.name}</TableCell>
              <TableCell align="right">{player.team_tag}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
