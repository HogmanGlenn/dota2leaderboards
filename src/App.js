import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import * as React from 'react';
import './App.css';
import Header from "./components/header/Header";
import Leaderboard from "./components/leaderboard/Leaderboard";
import Navigation from "./components/navigation/Navigation"
import Container from '@mui/material/Container';


export default function App(){
  return (
    //set up the leaderboard page with background color and title
    <div className="App"> 
      <Header />
      <Container maxWidth="lg" style={{}}>
        <Leaderboard />
        <Navigation />
      </Container>
    </div>
  );
}



