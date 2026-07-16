export function normalizePlayerName(name) {
  return String(name || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

export function hashBase36(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `p${hash.toString(36)}`;
}

export function createPlayerKey(region, { name, teamId, countryCode }) {
  const parts = [
    region,
    normalizePlayerName(name),
    teamId == null ? "" : String(teamId),
    String(countryCode || "").toLocaleLowerCase(),
  ];
  return hashBase36(parts.join("|"));
}
