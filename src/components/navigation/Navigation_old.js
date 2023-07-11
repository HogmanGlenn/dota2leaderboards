import * as React from "react";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import FlagIcon from "@mui/icons-material/Flag";
import { getFlagEmoji } from "../leaderboard/Leaderboard";
import "./Navigation.css";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const ITEM_HEIGHT = 48;

export default function Navigation({ allPlayers, setFilteredPlayers }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (countryCode) => {
    setAnchorEl(null);

    const updatedFilteredPlayers = !countryCode || typeof countryCode !== "string" || countryCode == ""
      ? allPlayers
      : allPlayers.filter(player => player.countryCode === countryCode);

    setFilteredPlayers(updatedFilteredPlayers);
  }

  var countries = [...new Set(allPlayers.map(player => player.countryCode))]
    .filter(countryCode => countryCode !== "" && typeof countryCode === "string")
    .map(countryCode => {
      return {
        countryCode: countryCode,
        name: regionNames.of(countryCode),
        flagEmoji: getFlagEmoji(countryCode),
        numPlayers: allPlayers.filter(player => player.countryCode === countryCode).length
      }
    })
    .sort((a, b) => {
      if (a.name > b.name) return 1;
      else if (a.name < b.name) return -1;
      else return 0;
    });

  return (
    <div className="navigation-container">
      <IconButton
        className="long-menu"
        aria-label="more"
        id="long-button"
        aria-controls={open ? "long-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        color="inherit"
        onClick={handleClick}
        style={{ fontSize: "32px" }}
      >
        <FlagIcon fontSize="large" />
      </IconButton>
      <Menu
        className="menu-country"
        id="long-menu"
        MenuListProps={{
          "aria-labelledby": "long-button",
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        disableScrollLock={true}
        
      >
        {countries.map(country =>
          <MenuItem
            key={country.countryCode}
            onClick={() => handleClose(country.countryCode)}
          >
            {country.name} ({country.numPlayers}) {country.flagEmoji}
          </MenuItem>
        )
        }
      </Menu>
    </div>
  );
}
