import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from '@mui/material/TablePagination';
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import * as React from "react";
import "./Leaderboard.css";
import { useTheme } from '@mui/material/styles';

//TODO: It's the duplicates that cause the issue.

// Yoinked from https://dev.to/jorik/country-code-to-flag-emoji-a21
export function getFlagEmoji(countryCode) {
  if (!countryCode) return "";

  const codePoints = countryCode
    .split("")
    .map((char) => 127397 + char.charCodeAt());

  return String.fromCodePoint(...codePoints);
}

export default function Leaderboard({ filteredPlayers }) {
  const theme = useTheme();
  const [page, setPage] = React.useState(0);
  const rowsPerPageOptions = [25, 50, 100, 1000, 5000];
  const [rowsPerPage, setRowsPerPage] = React.useState(rowsPerPageOptions[0]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - filteredPlayers.length) : 0;

  const visiblePlayers = React.useMemo(
    () => filteredPlayers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage,
    ),
    [page, rowsPerPage, filteredPlayers],
  );

  return (
    <TableContainer component={Paper}>
      <Table
        size="small"
        aria-label="Dota 2 Leaderboards"
      >
        <TableHead>
          <TableRow>
            <TableCell style={{ color: theme.palette.primary.main }}>Country</TableCell>
            <TableCell style={{ color: theme.palette.primary.main }} align="right">Rank</TableCell>
            <TableCell style={{ color: theme.palette.primary.main }} align="right">Name</TableCell>
            <TableCell style={{ color: theme.palette.primary.main }} align="right">Team</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visiblePlayers.map(player => (
            <TableRow
              key={`${player.name}_${player.rank}`}
            >
              <TableCell component="th" scope="row" style={{ width: "20px" }}>
                {getFlagEmoji(player.countryCode)}
              </TableCell>
              <TableCell align="right" style={{ width: "20px" }}>{player.rank}</TableCell>
              <TableCell align="right">{player.name}</TableCell>
              <TableCell align="right">{player.team_tag}</TableCell>
            </TableRow>
          ))}
          {emptyRows > 0 && (
            <TableRow>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination
        component={Paper}
        count={filteredPlayers.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPageOptions={rowsPerPageOptions}
        rowsPerPage={rowsPerPage}
        labelRowsPerPage="Players per page:"
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{ '.MuiToolbar-root': { color: theme.palette.primary.main } }}
      />
    </TableContainer>
  );
}
