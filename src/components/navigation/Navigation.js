import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Player } from '../../model/Player';
import europeData from '../../data/europe/v0001.json';
import FlagIcon from '@mui/icons-material/Flag';
import './Navigation.css';

function getFlagEmoji(countryCode) {
  if (!countryCode) return '';

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());

    return String.fromCodePoint(...codePoints);
}

function getCountryName(countryCode) {

    const regionNames = new Intl.DisplayNames(['en'], {type: 'region'});
    return regionNames.of(countryCode) + " " + getFlagEmoji(countryCode);

}


function createData(leaderboardJson) {
  let players = leaderboardJson.map(x => new Player(x.country, x.name, x.rank, x.team_id, x.team_tag));
  players.sort((a, b) => a.rank - b.rank).forEach((x, i) => x.rank = i + 1);

  return players;
}



let players = createData(europeData.leaderboard)


const ITEM_HEIGHT = 48;

export default function Navigation() {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const filteredPlayers = players.filter(player => europeData.leaderboard.some(entry => entry.country === player.countryCode));

  // Sort the players array by countryCode in alphabetical order
  filteredPlayers.sort((a, b) => {
    const countryCodeA = (a.countryCode || '').toUpperCase();
    const countryCodeB = (b.countryCode || '').toUpperCase();

    if (countryCodeA < countryCodeB) {
      return -1;
    }
    if (countryCodeA > countryCodeB) {
      return 1;
    }
    return 0;
  });

  const temp = [filteredPlayers[0].countryCode]; // Store the first countryCode in temp
//TODO: Move menu in CSS
  return (
    <div className="navigation-container">
      <IconButton
        className="long-menu"
        aria-label="more"
        id="long-button"
        aria-controls={open ? 'long-menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-haspopup="true"
        color="inherit"
        
        onClick={handleClick}
      >
        <FlagIcon fontSize='large'/>
      </IconButton>
      <Menu classname="menu-country"
        id="long-menu"
        MenuListProps={{
          'aria-labelledby': 'long-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
        transformOrigin={{vertical: 'top', horizontal: 'center'}}
        disableScrollLock={true}     
        PaperProps={{
          style: {
            maxHeight: ITEM_HEIGHT * 5.5,
            width: '30ch',
          },
        }}
      > 

        {filteredPlayers.map((countries) => {
        if (temp.includes(countries.countryCode)) {
          return null;
        }
        else {
          temp.push(countries.countryCode);
          return (
            <MenuItem key={countries.countryCode} onClick={handleClose}>
              {getCountryName(countries.countryCode.toUpperCase())}
            </MenuItem>
          );
        }
        })}
      </Menu>
    </div>
  );
}