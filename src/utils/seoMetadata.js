import { REGIONS } from "../constants";
import { createStructuredData } from "./seoStructuredData";

const HOME_TITLE = "Dota 2 Leaderboard | Regional Rankings";
const SITE_URL = "https://dota2leaderboards.com";

function setMeta(selector, content) {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute("content", content);
}

export function getSeoMetadata(region, countryName = "", canonicalPath = "/") {
  const regionName = REGIONS[region] || REGIONS.europe;
  const pageNumber = Number(canonicalPath.match(/\/page\/(\d+)\/$/)?.[1]) || 1;
  const suffix = pageNumber > 1 ? ` — Page ${pageNumber}` : "";

  if (countryName) {
    return {
      title: `Dota 2 Leaderboard | ${countryName}, ${regionName}${suffix}`,
      description: `Current ${countryName} Dota 2 leaderboard for ${regionName}, with player ranks, team tags, and country positions.`,
      url: `${SITE_URL}${canonicalPath}`,
    };
  }

  if (canonicalPath !== "/") {
    return {
      title: `Dota 2 Leaderboard | ${regionName}${suffix}`,
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

export function applySeoMetadata(region, countryName, canonicalPath, data = null) {
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
  const structuredData = document.getElementById("seo-structured-data");
  if (structuredData && data) {
    structuredData.textContent = JSON.stringify(createStructuredData({
      type: canonicalPath === "/" ? "home" : "leaderboard",
      metadata, players: data.players,
      lastModified: data.updatedAt ? new Date(data.updatedAt * 1000).toISOString().replace(".000Z", "Z") : "",
    })).replace(/</g, "\\u003c");
  }
}
