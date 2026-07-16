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
import { getLeaderboardHistory } from "./api/LeaderboardHistoryApi";
import { trackPageView } from "./analytics";
import { REGIONS } from "./constants";
import { getCountryName, getCountrySlug } from "./utils/countries";
import {
  createHistoryIndex,
  createSimulatedHistory,
  getRankDelta,
  HISTORY_OPTIONS,
} from "./utils/history";
import {
  parseSharedPins,
  pinnedPlayerId,
  readPinnedPlayers,
  serializeSharedPins,
  togglePinnedPlayer,
  writePinnedPlayers,
} from "./utils/pins";
import {
  createSavedSelection,
  readSavedSelections,
  selectionPinsParam,
  upsertSavedSelection,
  writeSavedSelections,
} from "./utils/savedSelections";
import "./App.css";

const DEFAULT_PAGE_SIZE = 25;
const HOME_ROUTE = {
  region: "europe",
  country: "all",
  pageSize: DEFAULT_PAGE_SIZE,
  pinnedOnly: false,
  historyWindow: "off",
  sharedPinsParam: "",
  demoHistory: false,
};
const ROUTE_PARAMS = new Set(["region", "country", "limit", "p", "h", "pins", "demo"]);

function canUseHistoryDemo() {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.startsWith("192.168.")
    || hostname.startsWith("10.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

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
  const requestedPinnedOnly = params.get("p");
  const requestedHistoryWindow = params.get("h");
  const requestedSharedPins = params.get("pins");
  const requestedDemo = params.get("demo");
  const requestedPageSize = Number(requestedLimit);
  const hasUnknownParam = Array.from(params.keys()).some((param) => !ROUTE_PARAMS.has(param));
  const hasDuplicateParam = Array.from(ROUTE_PARAMS).some((param) => params.getAll(param).length > 1);
  const hasInvalidRegion = requestedRegion !== null && !Object.hasOwn(REGIONS, requestedRegion);
  const hasInvalidCountry = requestedCountry === "";
  const hasInvalidPageSize = requestedLimit !== null
    && (!Number.isInteger(requestedPageSize) || requestedPageSize <= 0);
  const hasInvalidPinnedOnly = requestedPinnedOnly !== null && requestedPinnedOnly !== "1";
  const hasInvalidHistoryWindow = requestedHistoryWindow !== null
    && !HISTORY_OPTIONS.includes(requestedHistoryWindow);
  const hasInvalidSharedPins = requestedSharedPins !== null
    && !/^[a-z0-9_,.:~-]{0,2500}$/i.test(requestedSharedPins);
  const hasInvalidDemo = requestedDemo !== null
    && (requestedDemo !== "history" || !canUseHistoryDemo());

  if (
    window.location.pathname !== "/"
    || hasUnknownParam
    || hasDuplicateParam
    || hasInvalidRegion
    || hasInvalidCountry
    || hasInvalidPageSize
    || hasInvalidPinnedOnly
    || hasInvalidHistoryWindow
    || hasInvalidSharedPins
    || hasInvalidDemo
  ) {
    window.history.replaceState({}, "", "/");
    return { ...HOME_ROUTE };
  }

  return {
    region: requestedRegion || HOME_ROUTE.region,
    country: requestedCountry || HOME_ROUTE.country,
    pageSize: requestedLimit === null ? HOME_ROUTE.pageSize : requestedPageSize,
    pinnedOnly: requestedPinnedOnly === "1",
    historyWindow: requestedHistoryWindow || HOME_ROUTE.historyWindow,
    sharedPinsParam: requestedSharedPins || "",
    demoHistory: requestedDemo === "history",
  };
}

function Dashboard() {
  const [route, setRoute] = React.useState(readRoute);
  const { region, country: countrySlug, pageSize } = route;
  const [leaderboard, setLeaderboard] = React.useState({ region: null, players: [], updatedAt: null });
  const [history, setHistory] = React.useState({ region: null, data: null });
  const [historyError, setHistoryError] = React.useState("");
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [pinnedPlayers, setPinnedPlayers] = React.useState(readPinnedPlayers);
  const [savedSelections, setSavedSelections] = React.useState(readSavedSelections);
  const [selectionName, setSelectionName] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState("");
  const [shareStatus, setShareStatus] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [requestVersion, setRequestVersion] = React.useState(0);
  const cache = React.useRef(new Map());
  const inFlight = React.useRef(new Map());
  const historyCache = React.useRef(new Map());
  const historyInFlight = React.useRef(new Map());

  const loadRegion = React.useCallback((targetRegion) => {
    const cached = cache.current.get(targetRegion);
    if (cached) return Promise.resolve(cached);

    const pending = inFlight.current.get(targetRegion);
    if (pending) return pending;

    const request = getLeaderboardData(targetRegion)
      .then((data) => {
        const regionData = { ...data, region: targetRegion };
        cache.current.set(targetRegion, regionData);
        return regionData;
      })
      .finally(() => inFlight.current.delete(targetRegion));

    inFlight.current.set(targetRegion, request);
    return request;
  }, []);

  const loadHistory = React.useCallback((targetRegion) => {
    const cached = historyCache.current.get(targetRegion);
    if (cached) return Promise.resolve(cached);

    const pending = historyInFlight.current.get(targetRegion);
    if (pending) return pending;

    const request = getLeaderboardHistory(targetRegion)
      .then((data) => {
        historyCache.current.set(targetRegion, data);
        return data;
      })
      .finally(() => historyInFlight.current.delete(targetRegion));

    historyInFlight.current.set(targetRegion, request);
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

    setIsLoading(true);
    loadRegion(region)
      .then((data) => {
        if (cancelled) return;
        setLeaderboard(data);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError.message || "The leaderboard could not be loaded.");
        setLeaderboard({ region, players: [], updatedAt: null });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadRegion, region, requestVersion]);

  React.useEffect(() => {
    let cancelled = false;
    setShareStatus("");
    const isCurrentLeaderboard = leaderboard.region === region;

    if (route.historyWindow === "off") {
      setHistory({ region: null, data: null });
      setHistoryError("");
      setIsHistoryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!isCurrentLeaderboard) {
      setHistoryError("");
      setIsHistoryLoading(true);
      return () => {
        cancelled = true;
      };
    }

    if (route.demoHistory) {
      setHistory({
        region,
        data: createSimulatedHistory(leaderboard.players, leaderboard.updatedAt),
      });
      setHistoryError("");
      setIsHistoryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const cached = historyCache.current.get(region);
    setHistoryError("");
    if (cached) {
      setHistory({ region, data: cached });
      setIsHistoryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsHistoryLoading(true);
    setHistory((currentHistory) => (
      currentHistory.region === region
        ? currentHistory
        : { region: null, data: null }
    ));
    loadHistory(region)
      .then((data) => {
        if (!cancelled) setHistory({ region, data });
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setHistory({ region: null, data: null });
        setHistoryError(fetchError.message || "History could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setIsHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leaderboard.players, leaderboard.region, leaderboard.updatedAt, loadHistory, region, route.demoHistory, route.historyWindow]);

  React.useEffect(() => {
    Object.keys(REGIONS).forEach((targetRegion) => {
      loadRegion(targetRegion).catch(() => {});
    });
  }, [loadRegion, requestVersion]);

  React.useEffect(() => {
    if (!saveStatus) return undefined;
    const timeout = window.setTimeout(() => setSaveStatus(""), 900);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  const isLeaderboardCurrent = leaderboard.region === region;
  const currentPlayers = leaderboard.players;
  const currentUpdatedAt = leaderboard.updatedAt;
  const currentDataRegion = leaderboard.region || region;
  const currentHistory = history.region === currentDataRegion ? history.data : null;
  const canShowRankDelta = route.historyWindow !== "off" && Boolean(currentHistory);
  const reserveRankDeltaSpace = route.historyWindow !== "off";

  const countries = React.useMemo(() => {
    const counts = new Map();
    currentPlayers.forEach(({ countryCode }) => {
      if (countryCode) counts.set(countryCode, (counts.get(countryCode) || 0) + 1);
    });

    return Array.from(counts, ([countryCode, count]) => ({
      countryCode,
      name: getCountryName(countryCode),
      slug: getCountrySlug(countryCode),
      count,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentPlayers]);

  const selectedCountry = countries.find(({ slug }) => slug === countrySlug) || null;
  const navigationCountrySlug = countrySlug !== "all" && !selectedCountry && !isLoading
    ? "all"
    : countrySlug;
  const countryFilter = countrySlug === "all" ? null : countrySlug;
  const hasCountryFilter = countrySlug !== "all";
  const isInitialLoading = isLoading && currentPlayers.length === 0;
  const sharedPinnedIds = React.useMemo(
    () => parseSharedPins(route.sharedPinsParam),
    [route.sharedPinsParam]
  );
  const localPinnedIds = React.useMemo(
    () => new Set(pinnedPlayers.map((pin) => pinnedPlayerId(pin.region, pin.playerKey))),
    [pinnedPlayers]
  );
  const activePinnedIds = React.useMemo(
    () => new Set([...localPinnedIds, ...sharedPinnedIds]),
    [localPinnedIds, sharedPinnedIds]
  );

  const filteredPlayers = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return currentPlayers.filter((player) => {
      const isCountryMatch = !countryFilter || player.countrySlug === countryFilter;
      const isSearchMatch = !needle || player.searchText.includes(needle);
      const isPinnedMatch = !route.pinnedOnly || activePinnedIds.has(pinnedPlayerId(currentDataRegion, player.playerKey));
      return isCountryMatch && isSearchMatch && isPinnedMatch;
    });
  }, [activePinnedIds, countryFilter, currentDataRegion, currentPlayers, route.pinnedOnly, search]);

  const historyIndex = React.useMemo(() => createHistoryIndex(currentHistory), [currentHistory]);
  const rankDeltas = React.useMemo(() => {
    if (!canShowRankDelta) return new Map();

    return new Map(filteredPlayers.map((player) => [
      player.playerKey,
      getRankDelta(player, historyIndex, currentUpdatedAt, route.historyWindow),
    ]));
  }, [canShowRankDelta, filteredPlayers, historyIndex, currentUpdatedAt, route.historyWindow]);

  const pageSizeOptions = React.useMemo(
    () => getPageSizeOptions(currentPlayers.length, pageSize),
    [currentPlayers.length, pageSize]
  );

  React.useEffect(() => {
    if (!isLoading && currentPlayers.length > 0 && countrySlug !== "all" && !selectedCountry) {
      window.history.replaceState({}, "", "/");
      setSearch("");
      setRoute({ ...HOME_ROUTE });
      trackPageView("/");
    }
  }, [countrySlug, currentPlayers.length, isLoading, selectedCountry]);

  React.useEffect(() => {
    if (currentPlayers.length > 0 && pageSize !== DEFAULT_PAGE_SIZE && pageSize > currentPlayers.length) {
      updateRoute({ pageSize: currentPlayers.length }, true);
    }
  }, [currentPlayers.length, pageSize]);

  function updateRoute(updates, replace = false) {
    const shouldDropSharedPins = route.sharedPinsParam
      && !Object.hasOwn(updates, "sharedPinsParam")
      && (
        Object.hasOwn(updates, "region")
        || Object.hasOwn(updates, "country")
        || Object.hasOwn(updates, "pageSize")
        || updates.pinnedOnly === false
      );
    const nextRoute = {
      ...route,
      region,
      country: countrySlug,
      pageSize,
      ...updates,
      sharedPinsParam: shouldDropSharedPins ? "" : updates.sharedPinsParam ?? route.sharedPinsParam,
    };
    const params = new URLSearchParams();
    if (nextRoute.region !== "europe") params.set("region", nextRoute.region);
    if (nextRoute.country !== "all") params.set("country", nextRoute.country);
    if (nextRoute.pageSize !== DEFAULT_PAGE_SIZE) params.set("limit", String(nextRoute.pageSize));
    if (nextRoute.pinnedOnly) params.set("p", "1");
    if (nextRoute.historyWindow !== "off") params.set("h", nextRoute.historyWindow);
    if (nextRoute.sharedPinsParam) params.set("pins", nextRoute.sharedPinsParam);
    if (nextRoute.demoHistory && canUseHistoryDemo()) params.set("demo", "history");

    const query = params.toString();
    const url = query ? `/?${query}` : "/";
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(nextRoute);
    trackPageView(url);
  }

  const changeRegion = (nextRegion) => updateRoute({ region: nextRegion, pinnedOnly: false });
  const changeCountry = (country) => updateRoute({ country: country?.slug || "all", pinnedOnly: false });
  const changePageSize = (nextPageSize) => updateRoute({ pageSize: nextPageSize });
  const changePinnedOnly = (pinnedOnly) => updateRoute({ pinnedOnly });
  const changeHistoryWindow = (historyWindow) => {
    setSaveStatus("");
    updateRoute({ historyWindow });
  };
  const resetHome = () => {
    setSearch("");
    updateRoute({ ...HOME_ROUTE });
  };
  const clearPinned = () => {
    setPinnedPlayers([]);
    writePinnedPlayers([]);
    if (route.pinnedOnly || route.sharedPinsParam) {
      updateRoute({ pinnedOnly: false, sharedPinsParam: "" });
    }
  };
  const currentSharePins = React.useMemo(() => {
    const sharedPinEntries = Array.from(sharedPinnedIds, (id) => {
      const separator = id.indexOf(":");
      return {
        region: id.slice(0, separator),
        playerKey: id.slice(separator + 1),
      };
    });
    const pinsById = new Map(
      [...pinnedPlayers, ...sharedPinEntries].map((pin) => [pinnedPlayerId(pin.region, pin.playerKey), pin])
    );
    return Array.from(pinsById.values());
  }, [pinnedPlayers, sharedPinnedIds]);
  const saveSelection = () => {
    const selection = createSavedSelection(selectionName, route, currentSharePins);
    if (!selection) {
      setSaveStatus("Name required");
      return;
    }

    setSavedSelections((currentSelections) => {
      const nextSelections = upsertSavedSelection(currentSelections, selection);
      writeSavedSelections(nextSelections);
      return nextSelections;
    });
    setSelectionName("");
    setSaveStatus("Saved");
  };
  const loadSelection = (selectionId) => {
    const selection = savedSelections.find(({ id }) => id === selectionId);
    if (!selection) return;
    setSearch("");
    setSaveStatus("");
    updateRoute({
      ...selection.route,
      sharedPinsParam: selectionPinsParam(selection),
    });
  };
  const togglePlayerPin = React.useCallback((player) => {
    setPinnedPlayers((currentPins) => {
      const nextPins = togglePinnedPlayer(currentPins, currentDataRegion, player);
      writePinnedPlayers(nextPins);
      return nextPins;
    });
  }, [currentDataRegion]);
  const isPlayerPinned = React.useCallback(
    (player) => activePinnedIds.has(pinnedPlayerId(currentDataRegion, player.playerKey)),
    [activePinnedIds, currentDataRegion]
  );
  const shareView = async () => {
    const sharePins = serializeSharedPins(currentSharePins);
    const params = new URLSearchParams();
    if (route.region !== "europe") params.set("region", route.region);
    if (route.country !== "all") params.set("country", route.country);
    if (route.pageSize !== DEFAULT_PAGE_SIZE) params.set("limit", String(route.pageSize));
    if (route.pinnedOnly) params.set("p", "1");
    if (route.historyWindow !== "off") params.set("h", route.historyWindow);
    if (sharePins) params.set("pins", sharePins);

    const query = params.toString();
    const url = `${window.location.origin}/${query ? `?${query}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Copied");
    } catch {
      window.prompt("Copy this link", url);
      setShareStatus("Ready");
    }
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
          pinnedOnly={route.pinnedOnly}
          onPinnedOnlyChange={changePinnedOnly}
          pinnedCount={activePinnedIds.size}
          onClearPinned={clearPinned}
          historyWindow={route.historyWindow}
          historyOptions={HISTORY_OPTIONS}
          onHistoryWindowChange={changeHistoryWindow}
          historyStatus={
            route.historyWindow === "off"
              ? ""
              : isHistoryLoading || !isLeaderboardCurrent
                ? "Loading history"
                : historyError
                  ? "History unavailable"
                  : route.demoHistory
                    ? "Simulated history"
                  : ""
          }
          onShare={shareView}
          shareStatus={shareStatus}
          selectionName={selectionName}
          onSelectionNameChange={(value) => {
            setSelectionName(value);
            setSaveStatus("");
          }}
          onSaveSelection={saveSelection}
          savedSelections={savedSelections}
          onLoadSelection={loadSelection}
          saveStatus={saveStatus}
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
          updatedAt={currentUpdatedAt}
          error={error}
          onRetry={retry}
          hasFilters={Boolean(hasCountryFilter || search || route.pinnedOnly)}
          rankDeltas={rankDeltas}
          showRankDelta={reserveRankDeltaSpace}
          isPlayerPinned={isPlayerPinned}
          onTogglePinned={togglePlayerPin}
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
