import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import React from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Leaderboard from "./components/leaderboard/Leaderboard";
import Navigation from "./components/navigation/Navigation";
import { getLeaderboardData } from "./api/LeaderboardsApi";
import { trackPageView } from "./analytics";
import { REGIONS } from "./constants";
import { getCountryName, getCountrySlug } from "./utils/countries";
import "./App.css";

const DEFAULT_PAGE_SIZE = 25;
const HOME_ROUTE = { region: "europe", country: "all", pageSize: DEFAULT_PAGE_SIZE };
const ROUTE_PARAMS = new Set(["region", "country", "limit"]);

function getPageSizeOptions(maxRows, currentPageSize = DEFAULT_PAGE_SIZE) {
  const optionLimit = Math.min(maxRows, 5000);
  const increments = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  const options = increments.filter((option) => option <= optionLimit);

  if (!options.includes(DEFAULT_PAGE_SIZE)) options.push(DEFAULT_PAGE_SIZE);
  if (currentPageSize > 0 && !options.includes(currentPageSize)) options.push(currentPageSize);
  if (optionLimit > 0 && !options.includes(optionLimit)) options.push(optionLimit);

  return options.sort((a, b) => a - b);
}

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#448e85" },
    background: { default: "#121212", paper: "#1e1e1e" },
    text: { primary: "#f0f0ee", secondary: "#aaa7a2" },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
});

function readRoute() {
  const params = new URLSearchParams(window.location.search);
  const requestedRegion = params.get("region");
  const requestedCountry = params.get("country");
  const requestedLimit = params.get("limit");
  const requestedPageSize = Number(requestedLimit);
  const hasUnknownParam = Array.from(params.keys()).some((param) => !ROUTE_PARAMS.has(param));
  const hasDuplicateParam = Array.from(ROUTE_PARAMS).some((param) => params.getAll(param).length > 1);
  const hasInvalidRegion = requestedRegion !== null && !Object.hasOwn(REGIONS, requestedRegion);
  const hasInvalidCountry = requestedCountry === "";
  const hasInvalidPageSize = requestedLimit !== null
    && (!Number.isInteger(requestedPageSize) || requestedPageSize <= 0);

  if (
    window.location.pathname !== "/"
    || hasUnknownParam
    || hasDuplicateParam
    || hasInvalidRegion
    || hasInvalidCountry
    || hasInvalidPageSize
  ) {
    window.history.replaceState({}, "", "/");
    return { ...HOME_ROUTE };
  }

  return {
    region: requestedRegion || HOME_ROUTE.region,
    country: requestedCountry || HOME_ROUTE.country,
    pageSize: requestedLimit === null ? HOME_ROUTE.pageSize : requestedPageSize,
  };
}

function Dashboard() {
  const [route, setRoute] = React.useState(readRoute);
  const { region, country: countrySlug, pageSize } = route;
  const [leaderboard, setLeaderboard] = React.useState({ players: [], updatedAt: null });
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [requestVersion, setRequestVersion] = React.useState(0);
  const cache = React.useRef(new Map());
  const inFlight = React.useRef(new Map());

  const loadRegion = React.useCallback((targetRegion) => {
    const cached = cache.current.get(targetRegion);
    if (cached) return Promise.resolve(cached);

    const pending = inFlight.current.get(targetRegion);
    if (pending) return pending;

    const request = getLeaderboardData(targetRegion)
      .then((data) => {
        cache.current.set(targetRegion, data);
        return data;
      })
      .finally(() => inFlight.current.delete(targetRegion));

    inFlight.current.set(targetRegion, request);
    return request;
  }, []);

  React.useEffect(() => {
    const handleBackButton = () => {
      setRoute(readRoute());
      trackPageView();
    };
    window.addEventListener("popstate", handleBackButton);
    return () => window.removeEventListener("popstate", handleBackButton);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const cached = cache.current.get(region);

    setError("");
    if (cached) {
      setLeaderboard(cached);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(leaderboard.players.length === 0);
    loadRegion(region)
      .then((data) => {
        if (cancelled) return;
        setLeaderboard(data);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError.message || "The leaderboard could not be loaded.");
        setLeaderboard({ players: [], updatedAt: null });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leaderboard.players.length, loadRegion, region, requestVersion]);

  React.useEffect(() => {
    Object.keys(REGIONS).forEach((targetRegion) => {
      loadRegion(targetRegion).catch(() => {});
    });
  }, [loadRegion, requestVersion]);

  const countries = React.useMemo(() => {
    const counts = new Map();
    leaderboard.players.forEach(({ countryCode }) => {
      if (countryCode) counts.set(countryCode, (counts.get(countryCode) || 0) + 1);
    });

    return Array.from(counts, ([countryCode, count]) => ({
      countryCode,
      name: getCountryName(countryCode),
      slug: getCountrySlug(countryCode),
      count,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [leaderboard.players]);

  const selectedCountry = countries.find(({ slug }) => slug === countrySlug) || null;
  const navigationCountrySlug = countrySlug !== "all" && !selectedCountry && !isLoading
    ? "all"
    : countrySlug;
  const countryFilter = countrySlug === "all" ? null : countrySlug;
  const hasCountryFilter = countrySlug !== "all";
  const isInitialLoading = isLoading && leaderboard.players.length === 0;

  const filteredPlayers = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return leaderboard.players.filter((player) => {
      const isCountryMatch = !countryFilter || player.countrySlug === countryFilter;
      const isSearchMatch = !needle || player.searchText.includes(needle);
      return isCountryMatch && isSearchMatch;
    });
  }, [countryFilter, leaderboard.players, search]);

  const pageSizeOptions = React.useMemo(
    () => getPageSizeOptions(leaderboard.players.length, pageSize),
    [leaderboard.players.length, pageSize]
  );

  React.useEffect(() => {
    if (!isLoading && leaderboard.players.length > 0 && countrySlug !== "all" && !selectedCountry) {
      window.history.replaceState({}, "", "/");
      setSearch("");
      setRoute({ ...HOME_ROUTE });
      trackPageView("/");
    }
  }, [countrySlug, isLoading, leaderboard.players.length, selectedCountry]);

  React.useEffect(() => {
    if (leaderboard.players.length > 0 && pageSize !== DEFAULT_PAGE_SIZE && pageSize > leaderboard.players.length) {
      updateRoute({ pageSize: leaderboard.players.length }, true);
    }
  }, [leaderboard.players.length, pageSize]);

  function updateRoute(updates, replace = false) {
    const nextRoute = { region, country: countrySlug, pageSize, ...updates };
    const params = new URLSearchParams();
    if (nextRoute.region !== "europe") params.set("region", nextRoute.region);
    if (nextRoute.country !== "all") params.set("country", nextRoute.country);
    if (nextRoute.pageSize !== DEFAULT_PAGE_SIZE) params.set("limit", String(nextRoute.pageSize));

    const query = params.toString();
    const url = query ? `/?${query}` : "/";
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(nextRoute);
    trackPageView(url);
  }

  const changeRegion = (nextRegion) => updateRoute({ region: nextRegion });
  const changeCountry = (country) => updateRoute({ country: country?.slug || "all" });
  const changePageSize = (nextPageSize) => updateRoute({ pageSize: nextPageSize });
  const resetHome = () => {
    setSearch("");
    updateRoute({ region: "europe", country: "all", pageSize: DEFAULT_PAGE_SIZE });
  };
  const retry = () => {
    cache.current.delete(region);
    inFlight.current.delete(region);
    setRequestVersion((version) => version + 1);
  };

  return (
    <div className="app-shell">
      <main className="content" id="main-content">
        <header className="site-header">
          <button className="site-title" type="button" onClick={resetHome}>
            Dota 2 Leaderboards
          </button>
        </header>
        <Navigation
          region={region}
          onRegionChange={changeRegion}
          countries={countries}
          selectedCountry={selectedCountry}
          onCountryChange={changeCountry}
          search={search}
          onSearchChange={setSearch}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={changePageSize}
          isLoading={isLoading}
          countrySlug={navigationCountrySlug}
        />
        <Leaderboard
          players={filteredPlayers}
          rowsPerPage={pageSize}
          effectiveRowsPerPage={
            pageSize === 5000 && filteredPlayers.length > 5000
              ? filteredPlayers.length
              : pageSize
          }
          showRelativeRank={hasCountryFilter}
          isLoading={isInitialLoading}
          updatedAt={leaderboard.updatedAt}
          error={error}
          onRetry={retry}
          hasFilters={Boolean(hasCountryFilter || search)}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <a className="skip-link" href="#main-content">Skip to leaderboard</a>
      <Dashboard />
    </ThemeProvider>
  );
}
