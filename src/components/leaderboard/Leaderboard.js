import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import * as React from "react";
import { Player } from '../../model/Player';
import europeData from '../../data/europe/v0001.json';
import './Leaderboard.css';

// Yoinked from https://dev.to/jorik/country-code-to-flag-emoji-a21
function getFlagEmoji(countryCode) {
  if (!countryCode) return '';

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());

  return String.fromCodePoint(...codePoints);
}

export function createData(leaderboardJson) {
  let players = leaderboardJson.map(x => new Player(x.country, x.name, x.rank, x.team_id, x.team_tag));
  players.sort((a, b) => a.rank - b.rank).forEach((x, i) => x.rank = i + 1);
  return players;
}


let players = createData(europeData.leaderboard)

export default function Leaderboard({ filteredPlayers }, { selectedCountry }) {

  const displayPlayers = filteredPlayers.length > 0 ? filteredPlayers : players;
  
  return (
    <TableContainer component={Paper} style={{
      width: 650,
      margin: '50px'
    }}>
      <Table sx={{ maxWidth: 650 }} size="small" aria-label="Dota 2 Leaderboards">
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
              key={player.name}
              sx={{ '&:last-child td, &:last-child th': { border: 5 } }}
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