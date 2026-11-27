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
import { DEFAULT_PAGE_SIZE, REGIONS } from "./constants";
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
  resolvePinnedPlayerIds,
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
import { getPlayerFindKey } from "./utils/playerFindText";
import { createLeaderboardUrl, getLeaderboardPath, parseLeaderboardPath } from "./utils/leaderboardRoute";
import { applySeoMetadata, getSeoMetadata } from "./utils/seoMetadata";
import { countryForRegion, readLeaderboardAvailability } from "./utils/leaderboardAvailability";
import { parseCompactShareRoute } from "./utils/shareRoute";
import "./App.css";

const HOME_ROUTE = {
  region: "europe",
  country: "all",
  pageSize: DEFAULT_PAGE_SIZE,
  page: 1,
  pinnedOnly: false,
  historyWindow: "off",
  sharedPinsParam: "",
  demoHistory: false,
};
const ROUTE_PARAMS = new Set(["region", "country", "limit", "p", "h", "pins", "demo", "s"]);

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
  const pathRoute = parseLeaderboardPath(window.location.pathname);
  const requestedRegion = params.get("region");
  const requestedCountry = params.get("country");
  const requestedLimit = params.get("limit");
  const requestedPinnedOnly = params.get("p");
  const requestedHistoryWindow = params.get("h");
  const requestedSharedPins = params.get("pins");
  const requestedDemo = params.get("demo");
  const requestedCompactShare = params.get("s");
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
  const hasMixedCompactShare = requestedCompactShare !== null
    && Array.from(params.keys()).some((param) => param !== "s");
  const hasPathRouteConflict = pathRoute && !pathRoute.isHomepage && (
    requestedRegion !== null
    || requestedCountry !== null
    || requestedCompactShare !== null
  );
  const compactShareRoute = requestedCompactShare === null
    ? null
    : parseCompactShareRoute(requestedCompactShare);

  if (
    !pathRoute
    || hasUnknownParam
    || hasDuplicateParam
    || hasInvalidRegion
    || hasInvalidCountry
    || hasInvalidPageSize
    || hasInvalidPinnedOnly
    || hasInvalidHistoryWindow
    || hasInvalidSharedPins
    || hasInvalidDemo
    || hasMixedCompactShare
    || hasPathRouteConflict
    || (requestedCompactShare !== null && !compactShareRoute)
  ) {
    window.history.replaceState({}, "", "/");
    return { ...HOME_ROUTE };
  }

  if (compactShareRoute) {
    return { ...compactShareRoute, page: 1, demoHistory: false };
  }

  return {
    region: pathRoute.isHomepage
      ? requestedRegion || HOME_ROUTE.region
      : pathRoute.region,
    country: pathRoute.isHomepage
      ? requestedCountry || HOME_ROUTE.country
      : pathRoute.country,
    pageSize: requestedLimit === null ? HOME_ROUTE.pageSize : requestedPageSize,
    page: pathRoute.page || 1,
    pinnedOnly: requestedPinnedOnly === "1",
    historyWindow: requestedHistoryWindow || HOME_ROUTE.historyWindow,
    sharedPinsParam: requestedSharedPins || "",
    demoHistory: requestedDemo === "history",
  };
}

function Dashboard() {
  const [route, setRoute] = React.useState(readRoute);
  const [availability, setAvailability] = React.useState(readLeaderboardAvailability);
  const [visiblePage, setVisiblePage] = React.useState({ players: [] });
  const { region, country: countrySlug, pageSize } = route;
  const [leaderboard, setLeaderboard] = React.useState({ region: null, players: [], updatedAt: null });
  const [history, setHistory] = React.useState({ region: null, data: null });
  const [historyError, setHistoryError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [pinnedPlayers, setPinnedPlayers] = React.useState(readPinnedPlayers);
  const [savedSelections, setSavedSelections] = React.useState(readSavedSelections);
  const [selectionName, setSelectionName] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState("");
  const [shareStatus, setShareStatus] = React.useState("");
  const [findJump, setFindJump] = React.useState(null);
  const [pageResetVersion, setPageResetVersion] = React.useState(0);
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
        setAvailability((known) => ({ ...known, [targetRegion]: [...new Set(data.players
          .filter((player) => player.countryCode).map((player) => player.countrySlug))] }));
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
    setError("");
    setHistoryError("");
    setShareStatus("");
    setIsLoading(true);

    const leaderboardRequest = loadRegion(region);
    const historyRequest = route.historyWindow === "off"
      ? Promise.resolve({ data: null, error: "" })
      : route.demoHistory
        ? leaderboardRequest.then((data) => ({
            data: createSimulatedHistory(data.players, data.updatedAt),
            error: "",
          }))
        : loadHistory(region)
          .then((data) => ({ data, error: "" }))
          .catch((fetchError) => ({
            data: null,
            error: fetchError.message || "History could not be loaded.",
          }));

    Promise.all([leaderboardRequest, historyRequest])
      .then(([data, historyResult]) => {
        if (cancelled) return;
        setLeaderboard(data);
        setHistory({ region, data: historyResult.data });
        setHistoryError(historyResult.error);
        setIsLoading(false);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError.message || "The leaderboard could not be loaded.");
        setLeaderboard({ region, players: [], updatedAt: null });
        setHistory({ region, data: null });
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadHistory, loadRegion, region, requestVersion, route.demoHistory, route.historyWindow]);

  React.useEffect(() => {
    if (!saveStatus) return undefined;
    const timeout = window.setTimeout(() => setSaveStatus(""), 900);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

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
    () => resolvePinnedPlayerIds(
      new Set([...localPinnedIds, ...sharedPinnedIds]), currentDataRegion, currentPlayers
    ),
    [currentDataRegion, currentPlayers, localPinnedIds, sharedPinnedIds]
  );

  const pinnedFilterIds = route.pinnedOnly ? activePinnedIds : null;
  const filteredPlayers = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return currentPlayers.filter((player) => {
      const isCountryMatch = !countryFilter || player.countrySlug === countryFilter;
      const isSearchMatch = !needle || player.searchText.includes(needle);
      const isPinnedMatch = !pinnedFilterIds || pinnedFilterIds.has(pinnedPlayerId(currentDataRegion, player.playerKey));
      return isCountryMatch && isSearchMatch && isPinnedMatch;
    });
  }, [countryFilter, currentDataRegion, currentPlayers, pinnedFilterIds, search]);
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

  const canonicalPage = 1 + Math.floor(((route.page || 1) - 1) * pageSize / DEFAULT_PAGE_SIZE);
  const canonicalPath = window.location.pathname === "/" && region === HOME_ROUTE.region && countrySlug === "all"
    ? "/" : getLeaderboardPath(region, countrySlug, canonicalPage);
  const contextTitle = getSeoMetadata(region, selectedCountry?.name || "", canonicalPath).title;
  const regionPaths = Object.fromEntries(Object.keys(REGIONS).map((key) => [key,
    getLeaderboardPath(key, countryForRegion(key, countrySlug, availability, cache.current, "all")),
  ]));

  React.useEffect(() => {
    if (isLoading || leaderboard.region !== region || (countrySlug !== "all" && !selectedCountry)) return;
    applySeoMetadata(region, selectedCountry?.name || "", canonicalPath, {
      players: visiblePage.players, updatedAt: currentUpdatedAt,
    });
  }, [canonicalPath, countrySlug, currentUpdatedAt, isLoading, leaderboard.region, region, selectedCountry, visiblePage]);

  React.useEffect(() => {
    if (!isLoading && !error && leaderboard.region === region && currentPlayers.length > 0 && countrySlug !== "all" && !selectedCountry) {
      const knownCountry = Object.values(availability).some((countries) => countries.includes(countrySlug))
        || Array.from(cache.current.values()).some((data) => data.players.some((player) => player.countrySlug === countrySlug));
      if (knownCountry) {
        updateRoute({ country: "all", page: 1 }, true);
        return;
      }
      window.history.replaceState({}, "", "/");
      setSearch("");
      setRoute({ ...HOME_ROUTE });
      trackPageView("/");
    }
  }, [countrySlug, currentPlayers.length, error, isLoading, leaderboard.region, region, selectedCountry]);

  React.useEffect(() => {
    if (isLoading || !filteredPlayers.length) return;
    const rows = pageSize === 5000 && filteredPlayers.length > 5000 ? filteredPlayers.length : pageSize;
    const lastPage = Math.max(1, Math.ceil(filteredPlayers.length / rows));
    if (route.page > lastPage) updateRoute({ page: lastPage }, true);
  }, [filteredPlayers.length, isLoading, pageSize, route.page]);

  React.useEffect(() => {
    if (currentPlayers.length > 0 && pageSize !== DEFAULT_PAGE_SIZE && pageSize > currentPlayers.length) {
      updateRoute({ pageSize: currentPlayers.length }, true);
    }
  }, [currentPlayers.length, pageSize]);

  function updateRoute(updates, replace = false, homepage = false) {
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
      pageSize,
      ...updates,
      page: updates.page ?? (["region", "country", "pageSize", "pinnedOnly", "sharedPinsParam"].some(
        (key) => Object.hasOwn(updates, key) && updates[key] !== route[key]
      ) ? 1 : route.page || 1),
      country: updates.country ?? countrySlug,
      sharedPinsParam: shouldDropSharedPins ? "" : updates.sharedPinsParam ?? route.sharedPinsParam,
    };
    const url = createLeaderboardUrl(nextRoute, {
      homepage,
      includeDemo: canUseHistoryDemo(),
    });
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(nextRoute);
    trackPageView(url);
  }

  const changeRegion = (nextRegion) => updateRoute({
    region: nextRegion, country: countryForRegion(nextRegion, countrySlug, availability, cache.current), pinnedOnly: false,
  });
  const changeSearch = (value) => {
    setSearch(value);
    if (route.page > 1) updateRoute({ page: 1 }, true);
  };
  const changeCountry = (country) => updateRoute({
    country: country?.slug || "all",
    pinnedOnly: false,
  });
  const changePageSize = (nextPageSize) => updateRoute({ pageSize: nextPageSize });
  const changePinnedOnly = (pinnedOnly) => updateRoute({ pinnedOnly });
  const changeHistoryWindow = (historyWindow) => {
    setSaveStatus("");
    updateRoute({ historyWindow });
  };
  const resetHome = () => {
    setSearch("");
    setFindJump(null);
    setPageResetVersion((version) => version + 1);
    updateRoute(
      {
        ...HOME_ROUTE,
        historyWindow: route.historyWindow,
        demoHistory: route.demoHistory,
      },
      false,
      true
    );
  };
  const clearPinned = () => {
    setPinnedPlayers([]);
    writePinnedPlayers([]);
    if (route.pinnedOnly || route.sharedPinsParam) {
      updateRoute({ pinnedOnly: false, sharedPinsParam: "" });
    }
  };
  const currentSharePins = React.useMemo(() => {
    return Array.from(activePinnedIds, (id) => {
      const separator = id.indexOf(":");
      return {
        region: id.slice(0, separator),
        playerKey: id.slice(separator + 1),
      };
    });
  }, [activePinnedIds]);
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
    const url = `${window.location.origin}${createLeaderboardUrl({
      ...route,
      sharedPinsParam: serializeSharedPins(currentSharePins),
    })}`;
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
  const closeNativeFind = React.useCallback(() => setFindJump(null), []);
  const handleNativeFindMatch = React.useCallback(({ findKey }) => {
    if (!findKey || currentPlayers.length === 0) return;

    const isInCurrentView = filteredPlayers.some((player) => getPlayerFindKey(player) === findKey);
    if (!isInCurrentView) {
      setSearch("");
      updateRoute({ country: "all", pinnedOnly: false }, true);
    }

    setFindJump({ findKey });
  }, [currentPlayers.length, filteredPlayers, updateRoute]);

  return (
    <div className="app-shell">
      <main className="content" id="main-content">
        <header className="site-header">
          <h1 className="leaderboard-context-heading">{contextTitle}</h1>
          <a
            className="site-title"
            href="/"
            data-preserve-native-find="true"
            onClick={(event) => {
              event.preventDefault();
              resetHome();
            }}
          >
            Dota 2 Leaderboards
          </a>
        </header>
        <Navigation
          regionPaths={regionPaths}
          region={region}
          onRegionChange={changeRegion}
          onRegionPrefetch={(targetRegion) => loadRegion(targetRegion).catch(() => {})}
          isRegionLoading={isLoading && leaderboard.region !== region}
          countries={countries}
          selectedCountry={selectedCountry}
          onCountryChange={changeCountry}
          search={search}
          onSearchChange={changeSearch}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={changePageSize}
          isLoading={isInitialLoading}
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
          initialPage={(route.page || 1) - 1}
          onPageNavigate={(page) => updateRoute({ page: page + 1 })}
          pageHref={(page) => createLeaderboardUrl({ ...route, page: page + 1 })}
          onVisiblePlayersChange={setVisiblePage}
          players={filteredPlayers}
          findIndexPlayers={currentPlayers}
          findJump={findJump}
          onNativeFindClose={closeNativeFind}
          onNativeFindMatch={handleNativeFindMatch}
          pageResetVersion={pageResetVersion}
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
