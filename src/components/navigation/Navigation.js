import * as React from "react";
import { getFlagImageUrl } from "../leaderboard/Leaderboard";
import "./Navigation.css";
import Box from "@mui/material/Box";
import AutoComplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export default function Navigation({ allPlayers, setFilteredPlayers }) {
    const allCountry = { countryCode: "", name: "All", flagEmoji: "🌍", numPlayers: allPlayers.length };
    const [selectedCountry, setCountry] = React.useState(allCountry);
    const [flagCache, setFlagCache] = React.useState({});

    const handleCountryUpdate = (event, value) => {
        const countryCode = !value ? "" : value.countryCode;
        const updatedFilteredPlayers = !countryCode || typeof countryCode !== "string" || countryCode === ""
            ? allPlayers
            : allPlayers.filter(player => player.countryCode === countryCode);

        setFilteredPlayers(updatedFilteredPlayers);
        setCountry(value);
    }

    // Unique countries of all players
    var countries = [allCountry, ...[...new Set(allPlayers.map(player => player.countryCode))]
        .filter(countryCode => countryCode !== "" && typeof countryCode === "string")
        .map(countryCode => {
            return {
                countryCode: countryCode,
                name: regionNames.of(countryCode),
                flagEmoji: ``,
                numPlayers: allPlayers.filter(player => player.countryCode === countryCode).length
            }
        }).sort((a, b) => {
            if (a.name > b.name) return 1;
            else if (a.name < b.name) return -1;
            else return 0;
        })];

    // Fetch and cache flag images
    React.useEffect(() => {
        const fetchFlagImages = async () => {
        const flagCacheCopy = { ...flagCache };
        for (const country of countries) {
            if (country.countryCode !== "") {
            if (!flagCacheCopy[country.countryCode]) {
                const imageUrl = getFlagImageUrl(country.countryCode);
                const image = new Image();
                image.src = imageUrl;
                await image.decode();
                flagCacheCopy[country.countryCode] = imageUrl;
            }
            }
        }
        setFlagCache(flagCacheCopy);
        };

    fetchFlagImages();
  }, [countries, flagCache]);

    // Force update when allPlayers changes
    React.useEffect(() => {
        handleCountryUpdate(null, selectedCountry);

        // TODO eager load all flag images (for countryCodes under AllPlayers) here to prevent flickering when first opening the dropdown
    }, [allPlayers])

    return (
        <Box margin={"30px auto 30px auto"}>
            <AutoComplete
                value={selectedCountry}
                options={countries}
                onChange={handleCountryUpdate}
                getOptionLabel={option => option.name || ""}
                autoHighlight
                renderOption={(props, option) => (
                    <MenuItem
                        key={option.countryCode}
                        {...props}>
                        {option.countryCode === "" ? "🌍" : <img src={getFlagImageUrl(option.countryCode)} className="flagEmoji" alt={option.name} />} {option.name} ({option.numPlayers})
                    </MenuItem>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Select a country"
                        inputProps={{
                            ...params.inputProps
                        }}
                    />
                )}
                isOptionEqualToValue={(option, value) => {
                    return value.countryCode === "" || option.countryCode === value.countryCode;
                }}
            >
            </AutoComplete>
        </Box>
    );
}
