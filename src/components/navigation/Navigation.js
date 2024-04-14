import * as React from "react";
import { getFlagImageUrl } from "../leaderboard/Leaderboard";
import "./Navigation.css";
import Box from "@mui/material/Box";
import AutoComplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { useNavigate, useLocation } from "react-router-dom";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export default function Navigation({
  countryUrl,
  setCountryUrl,
  region,
  setRegion,
  allPlayers,
  setFilteredPlayers,
  setAllPlayers,
}) {
  const location = useLocation();
  const urlCountry = location.pathname.split("/")[2] || "all";
  const urlRegion = location.pathname.split("/")[1] || "europe";

  const allCountry = {
    countryCode: "",
    name: "All",
    flagEmoji: "🌍",
    numPlayers: allPlayers.length,
  };
  const [countries, setCountries] = React.useState([allCountry]);
  const [selectedCountry, setCountry] = React.useState(allCountry);
  const [flagCache, setFlagCache] = React.useState({});
  const navigate = useNavigate();

  React.useEffect(() => {
    setFilteredPlayers(allPlayers);
  }, [countries, allPlayers]);

  const handleRegionChange = (event) => {
    const validRegions = ["americas", "europe", "se_asia", "china"];
    const selectedRegion = event.target.value;

    setRegion(selectedRegion);
    let newPath;
    if (validRegions.includes(selectedRegion)) {
      newPath = `/${selectedRegion}/${urlCountry}`;
    } else {
      newPath = `/${region}/${urlCountry}`;
    }
    navigate(newPath);
  };

  const handleCountryUpdate = (event, value) => {
    const countryName = value
      ? value.name.toLowerCase().replace(/ /g, "_")
      : "";
    const countryCode = !value ? "" : value.countryCode;

    const updatedFilteredPlayers =
      !countryCode || typeof countryCode !== "string" || countryCode === ""
        ? allPlayers
        : allPlayers.filter((player) => player.countryCode === countryCode);

    const newPath = `/${urlRegion}/${countryName}`;
    setCountryUrl(countryName.toLowerCase() || urlCountry);
    navigate(newPath);
    setCountry(urlCountry);
    setFilteredPlayers(updatedFilteredPlayers);
  };

  React.useEffect(() => {
    setCountries([
      allCountry,
      ...[...new Set(allPlayers.map((player) => player.countryCode))]
        .filter(
          (countryCode) => countryCode !== "" && typeof countryCode === "string"
        )
        .map((countryCode) => {
          return {
            countryCode: countryCode,
            name: regionNames.of(countryCode),
            flagEmoji: ``,
            numPlayers: allPlayers.filter(
              (player) => player.countryCode === countryCode
            ).length,
          };
        })
        .sort((a, b) => {
          if (a.name > b.name) return 1;
          else if (a.name < b.name) return -1;
          else return 0;
        }),
    ]);
  }, [allPlayers]);

  React.useEffect(() => {
    const preloadFlagImages = async () => {
        const flagCacheCopy = { ...flagCache };
        for (const country of countries) {
            if (country.countryCode !== "") {
                let imageUrl = localStorage.getItem(`flag_${country.countryCode}`);
                if (!imageUrl) {
                    try {
                        imageUrl = getFlagImageUrl(country.countryCode);
                        const image = new Image();
                        image.src = imageUrl;
                        await image.decode();
                        flagCacheCopy[country.countryCode] = imageUrl;
                        localStorage.setItem(`flag_${country.countryCode}`, imageUrl); // Store in local storage
                    } catch (error) {
                        console.error("Error fetching flag image:", error);
                    }
                } else {
                    flagCacheCopy[country.countryCode] = imageUrl;
                }
            }
        }
        setFlagCache(flagCacheCopy);
    };

    preloadFlagImages();
}, []);

  React.useEffect(() => {
    handleRegionChange({ target: { value: region } });
  }, [countryUrl, countries, region]);

  React.useEffect(() => {
    const selectedCountry = countries.find(
      (country) => country.name.toLowerCase().replace(/ /g, "_") === urlCountry
    );
    if (selectedCountry) {
      handleCountryUpdate({ target: { value: urlCountry } }, selectedCountry);
    }
  }, [countryUrl, countries, allPlayers]);

  React.useEffect(() => {
    // Set the selected country based on the countryUrl prop
    const selectedCountry = countries.find(
      (country) => country.name.toLowerCase().replace(/ /g, "_") === countryUrl
    );
    setCountry(selectedCountry || allCountry);
  }, [countryUrl, countries, allCountry]);

  return (
    <Box margin={"30px auto 30px auto"}>
      <TextField
        fullWidth={true}
        select
        label="Region"
        value={region}
        onChange={handleRegionChange}
        style={{ marginBottom: "20px" }}
        variant="outlined"
        SelectProps={{
          MenuProps: {
            disableScrollLock: true,
          },
        }}
      >
        <MenuItem value={"europe"}>Europe</MenuItem>
        <MenuItem value={"americas"}>Americas</MenuItem>
        <MenuItem value={"china"}>China</MenuItem>
        <MenuItem value={"se_asia"}>Southeast Asia</MenuItem>
      </TextField>
      <AutoComplete
        value={selectedCountry}
        options={countries}
        onChange={(event, value) => {
          handleCountryUpdate(event, value);
        }}
        getOptionLabel={(option) => option.name || ""}
        autoHighlight
        renderOption={(props, option) => (
          <MenuItem key={option.countryCode} {...props}>
            {option.countryCode === "" ? (
              <span style={{ marginRight: "10px" }}>🌍</span>
            ) : (
              <img
                src={getFlagImageUrl(option.countryCode)}
                className="flagEmoji"
                alt={option.name}
              />
            )}{" "}
            {option.name} ({option.numPlayers})
          </MenuItem>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Country"
            inputProps={{
              ...params.inputProps,
            }}
          />
        )}
        isOptionEqualToValue={(option, value) => {
          if (
            value.countryCode !== "" &&
            !countries.find(
              (country) => country.countryCode === value.countryCode
            )
          ) {
            value = allCountry;
          }
          return (
            value.countryCode === "" || option.countryCode === value.countryCode
          );
        }}
      />
    </Box>
  );
}
