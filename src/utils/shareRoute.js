import { DEFAULT_PAGE_SIZE, REGIONS } from "../constants";
import { getCountrySlug } from "./countries";
import { HISTORY_OPTIONS } from "./history";
import { MAX_SHARED_PINS, serializeSharedPins } from "./pins";

const SHARE_VERSION = "1";
const REGION_CODES = {
  europe: "e",
  americas: "a",
  china: "c",
  se_asia: "s",
};
const REGIONS_BY_CODE = Object.fromEntries(
  Object.entries(REGION_CODES).map(([region, code]) => [code, region])
);
const COUNTRY_SLUG_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const COUNTRY_CODE_PATTERN = /^[a-z]{2}$/;
const PLAYER_KEY_PATTERN = /^p[a-z0-9]+$/;
const COMPACT_PLAYER_KEY_PATTERN = /^[a-z0-9]+$/;
const MAX_COMPACT_SHARE_LENGTH = 2000;

function serializeCompactPins(pins) {
  const grouped = new Map();

  pins.slice(0, MAX_SHARED_PINS).forEach(({ region, playerKey }) => {
    const regionCode = REGION_CODES[region];
    if (!regionCode || !PLAYER_KEY_PATTERN.test(playerKey || "")) return;

    const keys = grouped.get(regionCode) || [];
    keys.push(playerKey.slice(1));
    grouped.set(regionCode, keys);
  });

  return Array.from(grouped, ([regionCode, keys]) => (
    `${regionCode}${keys.join(",")}`
  )).join("~");
}

function parseCompactPins(value) {
  if (!value) return "";

  const pins = [];
  const groups = value.split("~");
  for (const group of groups) {
    const region = REGIONS_BY_CODE[group[0]];
    const keys = group.slice(1).split(",");
    if (!region || keys.some((key) => !COMPACT_PLAYER_KEY_PATTERN.test(key))) return null;

    keys.forEach((key) => pins.push({ region, playerKey: `p${key}` }));
    if (pins.length > MAX_SHARED_PINS) return null;
  }

  return serializeSharedPins(pins);
}

export function serializeCompactShareRoute(route, pins = [], countryCode = "") {
  const regionCode = REGION_CODES[route.region];
  if (!regionCode) return "";

  const normalizedCountryCode = String(countryCode).toLowerCase();
  const country = route.country === "all"
    ? ""
    : COUNTRY_CODE_PATTERN.test(normalizedCountryCode)
      ? normalizedCountryCode
      : `_${route.country}`;
  const pageSize = route.pageSize === DEFAULT_PAGE_SIZE ? "" : route.pageSize.toString(36);
  const historyIndex = HISTORY_OPTIONS.indexOf(route.historyWindow);
  const state = Math.max(0, historyIndex) * 2 + (route.pinnedOnly ? 1 : 0);
  const compactPins = serializeCompactPins(pins);
  const fields = [
    `${SHARE_VERSION}${regionCode}`,
    country,
    pageSize,
    state === 0 ? "" : state.toString(36),
    compactPins,
  ];

  while (fields[fields.length - 1] === "") fields.pop();
  if (fields.length === 1 && regionCode === REGION_CODES.europe) return "";
  return fields.join(".");
}

export function parseCompactShareRoute(value) {
  if (!value || value.length > MAX_COMPACT_SHARE_LENGTH || !/^[a-z0-9_.,~-]+$/i.test(value)) {
    return null;
  }

  const fields = value.toLowerCase().split(".");
  if (fields.length > 5 || !fields[0].startsWith(SHARE_VERSION)) return null;

  const region = REGIONS_BY_CODE[fields[0].slice(SHARE_VERSION.length)];
  const countryToken = fields[1] || "";
  const fallbackCountry = countryToken.startsWith("_") ? countryToken.slice(1) : "";
  const country = !countryToken
    ? "all"
    : COUNTRY_CODE_PATTERN.test(countryToken)
      ? getCountrySlug(countryToken.toUpperCase())
      : COUNTRY_SLUG_PATTERN.test(fallbackCountry)
        ? fallbackCountry
        : null;
  const pageSizeToken = fields[2] || "";
  const stateToken = fields[3] || "";
  const sharedPinsParam = parseCompactPins(fields[4] || "");
  const pageSize = pageSizeToken ? Number.parseInt(pageSizeToken, 36) : DEFAULT_PAGE_SIZE;
  const state = stateToken ? Number.parseInt(stateToken, 36) : 0;
  const historyIndex = Math.floor(state / 2);

  if (
    !region
    || !country
    || !Number.isSafeInteger(pageSize)
    || pageSize <= 0
    || (pageSizeToken && pageSize.toString(36) !== pageSizeToken)
    || !Number.isInteger(state)
    || state < 0
    || state > (HISTORY_OPTIONS.length - 1) * 2 + 1
    || (stateToken && state.toString(36) !== stateToken)
    || !HISTORY_OPTIONS[historyIndex]
    || sharedPinsParam === null
  ) {
    return null;
  }

  return {
    region,
    country,
    pageSize,
    pinnedOnly: state % 2 === 1,
    historyWindow: HISTORY_OPTIONS[historyIndex],
    sharedPinsParam,
  };
}
