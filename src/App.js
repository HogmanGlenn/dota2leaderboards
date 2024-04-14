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
import { getPlayersData } from "./api/LeaderboardsApi";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#448E85",
    },
  },
});

export default function App() {
  const initialUrl = window.location.pathname.toString().replace('"', "");
  const urlArray = initialUrl.split("/");
  const regionUrl = urlArray[1];
  const [countryUrl, setCountryUrl] = useState("all");

  const [region, setRegion] = useState(regionUrl || "europe");
  const [allPlayers, setAllPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const playersData = await getPlayersData(region);
        setAllPlayers(playersData);
        setFilteredPlayers(playersData);
      } catch (error) {
        console.error("Error fetching player data:", error);
      }
    };
    fetchData();
  }, [region]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <Header />
          <Container maxWidth="lg" style={{ maxWidth: 850, marginTop: 40 }}>
            <Navigation
              countryUrl={countryUrl}
              setCountryUrl={setCountryUrl}
              region={region || regionUrl}
              setRegion={setRegion}
              allPlayers={allPlayers}
              setFilteredPlayers={setFilteredPlayers}
              setAllPlayers={setAllPlayers}
            />
            <Routes>
              <Route
                path={`/:${regionUrl}/:${countryUrl.replace(/å/g, "a")}`}
                element={<Leaderboard filteredPlayers={filteredPlayers} />}
              />
            </Routes>
          </Container>
        </div>
      </Router>
    </ThemeProvider>
  );
}
