import { REGIONS } from "../constants";

const HOME_TITLE = "Dota 2 Leaderboard | Regional Rankings";
const SITE_URL = "https://dota2leaderboards.com";

function setMeta(selector, content) {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute("content", content);
}

export function getSeoMetadata(region, countryName = "", canonicalPath = "/") {
  const regionName = REGIONS[region] || REGIONS.europe;

  if (countryName) {
    return {
      title: `Dota 2 Leaderboard | ${countryName}, ${regionName}`,
      description: `Current ${countryName} Dota 2 leaderboard for ${regionName}, with player ranks, team tags, and country positions.`,
      url: `${SITE_URL}${canonicalPath}`,
    };
  }

  if (canonicalPath !== "/") {
    return {
      title: `Dota 2 Leaderboard | ${regionName}`,
      description: `Current Dota 2 leaderboard for ${regionName}, with player rankings, team tags, countries, and rank changes.`,
      url: `${SITE_URL}${canonicalPath}`,
    };
  }

  return {
    title: HOME_TITLE,
    description: "Browse current Dota 2 leaderboards by region, country, player name, and team.",
    url: `${SITE_URL}/`,
  };
}

export function applySeoMetadata(region, countryName, canonicalPath) {
  const metadata = getSeoMetadata(region, countryName, canonicalPath);
  document.title = metadata.title;
  setMeta('meta[name="description"]', metadata.description);
  setMeta('meta[property="og:title"]', metadata.title);
  setMeta('meta[property="og:description"]', metadata.description);
  setMeta('meta[property="og:url"]', metadata.url);
  setMeta('meta[name="twitter:title"]', metadata.title);
  setMeta('meta[name="twitter:description"]', metadata.description);

  const canonical = document.head.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", metadata.url);
}
