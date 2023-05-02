import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import * as React from "react";

import './Leaderboard.css';
import './Players.js';
import { Margin } from '@mui/icons-material';

function createData(flag, rank, name, MMR) {
    return { flag, rank, name, MMR };
  }

var player = <player />;

const rows = [];

for (let i = 0; i < 20; i++){
    const rows = createData("FIN", i, player + i, 9999);
}

export default function Leaderboard() {
    return (
      <TableContainer component={Paper} style={{width: 700,
                                                margin: '50px'}}>
        <Table sx={{ maxWidth: 650}} size="small" aria-label="Dota 2 Leaderboards">
          <TableHead>
            <TableRow>
              <TableCell>Country</TableCell>
              <TableCell align="right">Rank</TableCell>
              <TableCell align="right">Name</TableCell>
              <TableCell align="right">MMR</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.name}
                sx={{ '&:last-child td, &:last-child th': { border: 5 } }}
              >
                <TableCell component="th" scope="row">
                  {row.flag}
                </TableCell>
                <TableCell align="right">{row.rank}</TableCell>
                <TableCell align="right">{row.name}</TableCell>
                <TableCell align="right">{row.MMR}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }