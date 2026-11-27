const SITE_URL = "https://dota2leaderboards.com";

function createStructuredData({ type, metadata, players, lastModified = "" }) {
  const page = {
    "@type": type === "home" ? "WebApplication" : "CollectionPage",
    "@id": `${metadata.url}#page`,
    name: metadata.title,
    url: metadata.url,
    description: metadata.description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: players.length,
      itemListElement: players.map((player, index) => ({
        "@type": "ListItem", position: index + 1, name: player.name || "Anonymous player",
      })),
    },
  };
  if (lastModified) page.dateModified = lastModified;
  if (type === "home") {
    page.applicationCategory = "GameApplication";
    page.operatingSystem = "Any";
  }
  return {
    "@context": "https://schema.org",
    "@graph": [{ "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Dota 2 Leaderboards", url: `${SITE_URL}/` }, page],
  };
}

module.exports = { createStructuredData };
