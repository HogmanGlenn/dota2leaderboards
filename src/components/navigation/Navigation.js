import React from "react";
import ClearIcon from "@mui/icons-material/Clear";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { REGIONS } from "../../constants";
import { getFlagImageUrl } from "../leaderboard/Leaderboard";
import "./Navigation.css";

export default function Navigation({
  region,
  onRegionChange,
  countries,
  selectedCountry,
  onCountryChange,
  search,
  onSearchChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  isLoading,
  countrySlug,
}) {
  const countryValue = selectedCountry || (
    countrySlug !== "all"
      ? {
          countryCode: "",
          name: countrySlug.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
          slug: countrySlug,
        }
      : null
  );
  const [countryInput, setCountryInput] = React.useState(countryValue?.name || "");

  React.useEffect(() => {
    setCountryInput(countryValue?.name || "");
  }, [countryValue?.name]);

  const clearCountryInput = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setCountryInput("");
    if (countryValue) onCountryChange(null);
  };

  return (
    <section className="filters" aria-label="Leaderboard filters">
      <div className="region-tabs" role="group" aria-label="Region">
        {Object.entries(REGIONS).map(([value, label]) => (
          <button
            className={value === region ? "region-tab region-tab--active" : "region-tab"}
            key={value}
            onClick={() => onRegionChange(value)}
            type="button"
            aria-pressed={value === region}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <Autocomplete
          className="country-filter"
          disableClearable
          inputValue={countryInput}
          value={countryValue}
          options={countries}
          onChange={(_, value) => onCountryChange(value)}
          onInputChange={(_, value, reason) => {
            if (reason !== "reset") setCountryInput(value);
          }}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.countryCode === value.countryCode}
          loading={isLoading}
          autoHighlight
          blurOnSelect
          size="small"
          renderOption={(props, option) => (
            <li {...props} key={option.countryCode}>
              <img className="flag" src={getFlagImageUrl(option.countryCode)} alt="" />
              <span>{option.name}</span>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Country"
              placeholder="All countries"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {(countryInput || countryValue) && (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="Clear country search"
                          edge="end"
                          size="small"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={clearCountryInput}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              inputProps={{ ...params.inputProps, "aria-label": "Filter by country" }}
            />
          )}
        />
        <TextField
          className="search-filter"
          label="Search"
          size="small"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Player or team"
          inputProps={{ maxLength: 80, "aria-label": "Player or team" }}
          InputProps={{
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear search"
                  edge="end"
                  size="small"
                  onClick={() => onSearchChange("")}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <TextField
          className="limit-filter"
          select
          size="small"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          inputProps={{ "aria-label": "Visible rows" }}
          SelectProps={{
            displayEmpty: true,
            MenuProps: {
              transitionDuration: 0,
              disableScrollLock: true,
            },
            renderValue: (value) => (
              <span className="limit-value">
                <span>Show</span>
                <strong>{value}</strong>
              </span>
            ),
          }}
        >
          {pageSizeOptions.map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </TextField>
      </div>
    </section>
  );
}
