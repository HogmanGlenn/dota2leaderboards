import { DEFAULT_PAGE_SIZE, REGIONS } from "../constants";

export const REGION_PATHS = {
  europe: "europe",
  americas: "americas",
  china: "china",
  se_asia: "southeast-asia",
};

const REGIONS_BY_PATH = Object.fromEntries(
  Object.entries(REGION_PATHS).map(([region, path]) => [path, region])
);
const COUNTRY_PATH_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getCountryPath(countrySlug) {
  const normalizedSlug = String(countrySlug || "").replace(/_/g, "-");
  if (!normalizedSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) return "";
  return normalizedSlug;
}

export function getLeaderboardPath(region, country = "all") {
  const regionPath = REGION_PATHS[region];
  if (!regionPath) return "/";
  if (country === "all") return `/${regionPath}/`;

  const countryPath = getCountryPath(country);
  return countryPath ? `/${regionPath}/${countryPath}/` : "/";
}

export function parseLeaderboardPath(pathname) {
  if (pathname === "/") {
    return {
      isHomepage: true,
      region: "europe",
      country: "all",
    };
  }

  const match = String(pathname || "").match(/^\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?\/?$/);
  if (!match) return null;

  const region = REGIONS_BY_PATH[match[1]];
  if (!region || !Object.hasOwn(REGIONS, region)) return null;
  if (!match[2]) {
    return { isHomepage: false, region, country: "all" };
  }

  if (!COUNTRY_PATH_PATTERN.test(match[2])) return null;

  return {
    isHomepage: false,
    region,
    country: match[2].replace(/-/g, "_"),
  };
}

export function createLeaderboardUrl(route, options = {}) {
  const {
    homepage = false,
    includeSharedPins = true,
    includeDemo = false,
  } = options;
  const path = homepage
    ? "/"
    : getLeaderboardPath(route.region, route.country);
  const params = new URLSearchParams();

  if (path === "/" && !homepage) {
    if (route.region !== "europe") params.set("region", route.region);
    if (route.country !== "all") params.set("country", route.country);
  }
  if (route.pageSize !== DEFAULT_PAGE_SIZE) params.set("limit", String(route.pageSize));
  if (route.pinnedOnly) params.set("p", "1");
  if (route.historyWindow !== "off") params.set("h", route.historyWindow);
  if (includeSharedPins && route.sharedPinsParam) params.set("pins", route.sharedPinsParam);
  if (includeDemo && route.demoHistory) params.set("demo", "history");

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
