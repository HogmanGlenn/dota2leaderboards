export const PIN_STORAGE_KEY = "dota2leaderboards:pinnedPlayers:v1";
export const MAX_PINNED_PLAYERS = 100;
export const MAX_SHARED_PINS = 50;

export function pinnedPlayerId(region, playerKey) {
  return `${region}:${playerKey}`;
}

export function readPinnedPlayers(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(PIN_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((pin) => pin && typeof pin.region === "string" && typeof pin.playerKey === "string")
      .slice(0, MAX_PINNED_PLAYERS);
  } catch {
    return [];
  }
}

export function writePinnedPlayers(pins, storage = window.localStorage) {
  try {
    storage.setItem(PIN_STORAGE_KEY, JSON.stringify(pins.slice(0, MAX_PINNED_PLAYERS)));
  } catch {
    // Local storage can be unavailable in private windows; pinning remains session-only.
  }
}

export function togglePinnedPlayer(pins, region, player) {
  const id = pinnedPlayerId(region, player.playerKey);
  const existingIndex = pins.findIndex((pin) => pinnedPlayerId(pin.region, pin.playerKey) === id);

  if (existingIndex >= 0) {
    return pins.filter((_, index) => index !== existingIndex);
  }

  const nextPin = {
    region,
    playerKey: player.playerKey,
    name: player.name,
    teamTag: player.teamTag || "",
    countryCode: player.countryCode || "",
    rank: player.rank,
  };

  return [nextPin, ...pins].slice(0, MAX_PINNED_PLAYERS);
}

export function parseSharedPins(value) {
  const pins = new Set();
  if (!value || typeof value !== "string" || value.length > 2500) return pins;

  value.split("~").forEach((group) => {
    const separator = group.indexOf(".");
    if (separator <= 0) return;
    const region = group.slice(0, separator);
    const keys = group.slice(separator + 1);
    if (!/^[a-z0-9_]+$/.test(region)) return;

    keys.split(",").forEach((playerKey) => {
      if (/^p[a-z0-9]+$/.test(playerKey)) {
        pins.add(pinnedPlayerId(region, playerKey));
      }
    });
  });

  return pins;
}

export function serializeSharedPins(pins) {
  const grouped = new Map();

  pins.slice(0, MAX_SHARED_PINS).forEach((pin) => {
    if (!pin.region || !pin.playerKey) return;
    const keys = grouped.get(pin.region) || [];
    keys.push(pin.playerKey);
    grouped.set(pin.region, keys);
  });

  return Array.from(grouped, ([region, keys]) => `${region}.${keys.join(",")}`).join("~");
}
