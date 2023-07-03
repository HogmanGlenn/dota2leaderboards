import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import * as React from "react";

import './Header.css';

export default function Header() {
    return (
        <AppBar position="static" style= {{background: '#33404D'}}>
            <Toolbar>
                <IconButton
                size="large"
                edge="start"
                color="inherit"
                aria-label="menu"
                sx={{mr: 2 }}
                >
                <MenuIcon />
                </IconButton>
            <Typography variant="h6" 
              component="div" sx={{ flexGrow: 1 }}>
              Dota 2 Leaderboards
            </Typography>
            <Button className="Header-style" color="inherit">Login</Button>
          </Toolbar>
        </AppBar>
    );
  }