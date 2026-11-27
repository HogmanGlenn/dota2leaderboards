import { REGIONS } from "../constants";

export function readLeaderboardAvailability() {
  try {
    const data = JSON.parse(document.getElementById("leaderboard-availability")?.textContent || "null");
    if (!data || typeof data !== "object") return {};
    return Object.fromEntries(Object.keys(REGIONS)
      .filter((region) => Array.isArray(data[region]) && data[region].length <= 300)
      .map((region) => [region, data[region].filter((slug) => typeof slug === "string" && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(slug))]));
  } catch {
    return {};
  }
}

export function countryForRegion(region, country, availability, cache, fallback = country) {
  if (country === "all") return country;
  if (availability[region]) return availability[region].includes(country) ? country : "all";
  const data = cache.get(region);
  if (data) return data.players.some((player) => player.countrySlug === country) ? country : "all";
  return fallback;
}
