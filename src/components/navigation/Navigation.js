import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Player } from '../../model/Player';
import europeData from '../../data/europe/v0001.json';
import './Navigation.css';

function getFlagEmoji(countryCode) {
  if (!countryCode) return '';

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());

  return String.fromCodePoint(...codePoints);
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

  return (
    <div>
      <IconButton
        position="relative"
        aria-label="more"
        id="long-button"
        aria-controls={open ? 'long-menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-haspopup="true"
        onClick={handleClick}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="long-menu"
        MenuListProps={{
          'aria-labelledby': 'long-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: ITEM_HEIGHT * 4.5,
            width: '20ch',
          },
        }}
      >
        {players.map((countries) => (
          <MenuItem key={countries} onClick={handleClose}>
            {getFlagEmoji(countries.countryCode)}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}