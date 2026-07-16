import { MAX_SHARED_PINS, serializeSharedPins } from "./pins";

export const SAVED_SELECTIONS_KEY = "dota2leaderboards:savedSelections:v1";
export const MAX_SAVED_SELECTIONS = 20;

export function readSavedSelections(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(SAVED_SELECTIONS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((selection) => (
        selection
        && typeof selection.id === "string"
        && typeof selection.name === "string"
        && selection.route
        && Array.isArray(selection.pins)
      ))
      .slice(0, MAX_SAVED_SELECTIONS);
  } catch {
    return [];
  }
}

export function writeSavedSelections(selections, storage = window.localStorage) {
  try {
    storage.setItem(SAVED_SELECTIONS_KEY, JSON.stringify(selections.slice(0, MAX_SAVED_SELECTIONS)));
  } catch {
    // Saving views is optional; the live filters still work if storage is unavailable.
  }
}

export function normalizeSelectionName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 40);
}

export function createSavedSelection(name, route, pins) {
  const cleanName = normalizeSelectionName(name);
  if (!cleanName) return null;

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: cleanName,
    createdAt: Date.now(),
    route: {
      region: route.region,
      country: route.country,
      pageSize: route.pageSize,
      pinnedOnly: route.pinnedOnly,
      historyWindow: route.historyWindow,
    },
    pins: pins.slice(0, MAX_SHARED_PINS).map(({ region, playerKey }) => ({ region, playerKey })),
  };
}

export function upsertSavedSelection(selections, selection) {
  const nextSelections = selections.filter(
    (existing) => existing.name.toLocaleLowerCase() !== selection.name.toLocaleLowerCase()
  );
  return [selection, ...nextSelections].slice(0, MAX_SAVED_SELECTIONS);
}

export function selectionPinsParam(selection) {
  return serializeSharedPins(selection?.pins || []);
}
