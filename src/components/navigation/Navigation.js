import * as React from "react";
import { getFlagEmoji } from "../leaderboard/Leaderboard";
import "./Navigation.css";
import Box from "@mui/material/Box";
import AutoComplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export default function Navigation({ allPlayers, setFilteredPlayers }) {
    const allCountry = { countryCode: "", name: "All", flagEmoji: "🌍", numPlayers: allPlayers.length };
    const [selectedCountry, setCountry] = React.useState(allCountry);

    const handleCountryUpdate = (event, value) => {
        const countryCode = !value ? "" : value.countryCode;

        setCountry(!value ? allCountry : value);

        const updatedFilteredPlayers = !countryCode || typeof countryCode !== "string" || countryCode === ""
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
        }).sort((a, b) => {
            if (a.name > b.name) return 1;
            else if (a.name < b.name) return -1;
            else return 0;
        });

    countries = [allCountry, ...countries];

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
                        {option.flagEmoji} {option.name} ({option.numPlayers})
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
                    return option.countryCode === value;
                }}
            >
            </AutoComplete>
        </Box>
    );
}
