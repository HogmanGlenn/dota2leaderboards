import { DataGrid } from '@mui/x-data-grid';
import * as React from "react";

import './Leaderboard.css';
import './Players.js';

export default function Leaderboard() {
    const columns = [
        { field: 'id', headerName: 'Rank', width: 100 },
        { field: 'name', headerName: 'Name', width: 200 },
        { field: 'score', headerName: 'Score', width: 200 },
        ];
    const rows = [
        { id: 1, name: 'Player 1', score: 100 },
        { id: 2, name: 'Player 2', score: 90 },
        { id: 3, name: 'Player 3', score: 80 },
        { id: 4, name: 'Player 4', score: 70 },
        { id: 5, name: 'Player 5', score: 60 },
        { id: 6, name: 'Player 6', score: 50 },
        { id: 7, name: 'Player 7', score: 40 },
        { id: 8, name: 'Player 8', score: 30 },
        { id: 9, name: 'Player 9', score: 20 },
        { id: 10, name: 'Player 10', score: 10 },
        { id: 11, name: 'Player 11', score: 9 },
        { id: 12, name: 'Player 12', score: 8 },
        { id: 13, name: 'Player 13', score: 7 },
        { id: 14, name: 'Player 14', score: 6 },
        { id: 15, name: 'Player 15', score: 5 },
        { id: 16, name: 'Player 16', score: 4 },
        { id: 17, name: 'Player 17', score: 3 },
        { id: 18, name: 'Player 18', score: 2 },
        { id: 19, name: 'Player 19', score: 1 },
        { id: 20, name: 'Player 20', score: 0 },
        ];
    return (
        <div style={{ height: 400, width: '100%' }}>
        <header className="Leaderboard-header">
          <h1>Leaderboard</h1>
        </header>
        <DataGrid
            rows={rows}
            columns={columns}
            pageSize={5}
            rowsPerPageOptions={[5]}
            checkboxSelection
            disableSelectionOnClick
        />
        </div>
    );

    }