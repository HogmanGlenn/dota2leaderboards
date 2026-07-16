import React from "react";
import ClearIcon from "@mui/icons-material/Clear";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { REGIONS } from "../../constants";
import Flag from "../flag/Flag";
import "./Navigation.css";

const HISTORY_OPTION_LABELS = {
  off: "Off",
  "8h": "8 hours",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

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
  pinnedOnly,
  onPinnedOnlyChange,
  pinnedCount,
  onClearPinned,
  historyWindow,
  historyOptions,
  onHistoryWindowChange,
  historyStatus,
  onShare,
  shareStatus,
  selectionName,
  onSelectionNameChange,
  onSaveSelection,
  savedSelections,
  onLoadSelection,
  saveStatus,
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
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

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
              <Flag countryCode={option.countryCode} className="flag" />
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
        <button
          className={advancedOpen ? "more-options-toggle more-options-toggle--active" : "more-options-toggle"}
          type="button"
          aria-expanded={advancedOpen}
          aria-label="More options"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <ExpandMoreIcon fontSize="small" />
          <span>More</span>
        </button>
      </div>

      {advancedOpen && (
        <div className="more-options" data-testid="more-options-panel">
        <div className="more-options__panel">
          <div className="option-group option-group--pins">
            <label className="pinned-toggle">
              <span>Filter pinned</span>
              <Switch
                checked={pinnedOnly}
                onChange={(event) => onPinnedOnlyChange(event.target.checked)}
                size="small"
                inputProps={{ "aria-label": "Filter pinned" }}
              />
            </label>
            <Button
              className="clear-pins"
              variant="outlined"
              size="small"
              disabled={pinnedCount === 0}
              onClick={onClearPinned}
            >
              Clear pinned
            </Button>
            <span className="pin-count" aria-live="polite">
              <strong>{pinnedCount}</strong> pinned
            </span>
          </div>
          <div className="option-group option-group--view">
            <TextField
              className="history-filter"
              select
              size="small"
              label="Show rank change"
              value={historyWindow}
              onChange={(event) => onHistoryWindowChange(event.target.value)}
              inputProps={{ "aria-label": "Show rank change" }}
              SelectProps={{
                MenuProps: {
                  transitionDuration: 0,
                  disableScrollLock: true,
                },
              }}
            >
              {historyOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {HISTORY_OPTION_LABELS[option] || option}
                </MenuItem>
              ))}
            </TextField>
          </div>
          <div className="selection-row">
            <TextField
              className="selection-name"
              size="small"
              label="Selection name"
              value={selectionName}
              onChange={(event) => onSelectionNameChange(event.target.value)}
              inputProps={{ maxLength: 40, "aria-label": "Selection name" }}
            />
            <div className="selection-actions">
              <Button
                className={saveStatus === "Saved" ? "save-selection save-selection--saved" : "save-selection"}
                variant="outlined"
                size="small"
                onClick={onSaveSelection}
              >
                Save
              </Button>
              <TextField
                className="saved-selection"
                select
                size="small"
                value=""
                onChange={(event) => onLoadSelection(event.target.value)}
                inputProps={{ "aria-label": "Saved selections" }}
                SelectProps={{
                  displayEmpty: true,
                  MenuProps: {
                    transitionDuration: 0,
                    disableScrollLock: true,
                  },
                  renderValue: () => "Load saved",
                }}
              >
                {savedSelections.length === 0 ? (
                  <MenuItem disabled value="">No saved selections</MenuItem>
                ) : savedSelections.map((selection) => (
                  <MenuItem key={selection.id} value={selection.id}>{selection.name}</MenuItem>
                ))}
              </TextField>
              <Button
                className="share-view"
                variant="contained"
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={onShare}
                title={shareStatus || ""}
              >
                Copy shareable link
              </Button>
            </div>
          </div>
          {historyStatus && (
            <span className="options-status">{historyStatus}</span>
          )}
        </div>
        </div>
      )}
    </section>
  );
}
