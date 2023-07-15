import * as React from "react";

import './Header.css';

export default function Header() {
    return (
      <h1 style={{textAlign: 'center' }}>
        Dota 2 Country Leaderboards (Europe Ladder)
      </h1>
        // <AppBar position="static" style= {{background: '#33404D'}}>
        //     <Toolbar>
        //         {/* <IconButton
        //         size="large"
        //         edge="start"
        //         color="inherit"
        //         aria-label="menu"
        //         sx={{mr: 2 }}
        //         >
        //         <MenuIcon />
        //         </IconButton> */}
        //     <Typography variant="h6" 
        //       component="div" sx={{ flexGrow: 1 }}>
        //       Dota 2 Leaderboards
        //     </Typography>
        //     {/* <Button className="Header-style" color="inherit">Login</Button> */}
        //   </Toolbar>
        // </AppBar>
    );
  }