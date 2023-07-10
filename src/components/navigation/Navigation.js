import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import europeData from '../../data/europe/v0001.json';
import FlagIcon from '@mui/icons-material/Flag';
import './Navigation.css';
import { createData } from '../leaderboard/Leaderboard';

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

const ITEM_HEIGHT = 48;

export default function Navigation({ setFilteredPlayers }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const [selectedCountry, setSelectedCountry] = React.useState('');
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = (countryCode) => {
    setAnchorEl(null);
    setSelectedCountry(countryCode);
    const updatedFilteredPlayers = createData(europeData.leaderboard).filter(
      (player) => player.countryCode === countryCode.toUpperCase()
    );
    setFilteredPlayers(updatedFilteredPlayers);
  };

    React.useEffect(() => {
    // Update filtered players based on the selected country
    const updatedFilteredPlayers = createData(europeData.leaderboard).filter((player) => player.countryCode === selectedCountry);
    setFilteredPlayers(updatedFilteredPlayers);
  }, [selectedCountry]);

  const filteredPlayers = createData(europeData.leaderboard).filter(player => europeData.leaderboard.some(entry => entry.country === player.countryCode));

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

  const temp = [filteredPlayers.countryCode]; // Store the first countryCode in temp
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
        style={{fontSize: '32px'}}
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
            <MenuItem
                key={countries.countryCode}
                onClick={() => handleClose(countries.countryCode)}
            >
                {getCountryName(countries.countryCode.toUpperCase())}
            </MenuItem>
          );
        }
        })}
      </Menu>
    </div>
  );
}

  