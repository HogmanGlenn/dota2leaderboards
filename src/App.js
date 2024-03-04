import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import * as React from "react";
import "./App.css";
import Header from "./components/header/Header";
import Leaderboard from "./components/leaderboard/Leaderboard";
import Navigation from "./components/navigation/Navigation";
import Container from "@mui/material/Container";
import { useState } from "react";
import { getPlayersData } from './api/LeaderboardsApi';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#448E85'
    },
  },
});

export default function App() {
  const [region, setRegion] = useState("europe");
  const [allPlayers, setAllPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);

  React.useEffect(() => {
    getPlayersData(region).then(playersData => {
      setAllPlayers(playersData);
      setFilteredPlayers(playersData);
  });
  }, [region]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="App">
        <Header />

        <Container maxWidth="lg" style={{ maxWidth: 850, marginTop: 80 }}>
          <Navigation region={region} setRegion={setRegion} allPlayers={allPlayers} setFilteredPlayers={setFilteredPlayers} setAllPlayers={setAllPlayers}/>
          <Leaderboard filteredPlayers={filteredPlayers} />
        </Container>
      </div>
    </ThemeProvider>
  );
}