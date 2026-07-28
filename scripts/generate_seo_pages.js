const fs = require("fs");
const path = require("path");

const SITE_NAME = "Dota 2 Leaderboards";
const HOME_TITLE = "Dota 2 Leaderboard | Regional Rankings";
const SITE_URL = "https://dota2leaderboards.com";
const STATIC_ROW_LIMIT = 100;
const REGIONS = [
  { key: "europe", name: "Europe", path: "europe" },
  { key: "americas", name: "Americas", path: "americas" },
  { key: "china", name: "China", path: "china" },
  { key: "se_asia", name: "Southeast Asia", path: "southeast-asia" },
];
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryNameCollator = new Intl.Collator("en", { sensitivity: "base" });

function readOption(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
}

function countryName(countryCode) {
  try {
    return displayNames.of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

function countrySlug(countryCode) {
  return countryName(countryCode)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function countryPath(countryCode) {
  return countrySlug(countryCode).replace(/_/g, "-");
}

function isoTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return new Date(timestamp * 1000).toISOString().replace(".000Z", "Z");
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readRegionData(dataDir, region) {
  const dataPath = path.join(dataDir, region.key, "v0001.json");
  if (!fs.existsSync(dataPath)) return null;

  const payload = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!payload || !Array.isArray(payload.leaderboard) || payload.leaderboard.length === 0) {
    throw new Error(`${dataPath} does not contain a leaderboard`);
  }

  const players = payload.leaderboard
    .filter((player) => player && Number.isFinite(Number(player.rank)))
    .sort((a, b) => Number(a.rank) - Number(b.rank));
  const countries = new Map();

  players.forEach((player) => {
    const code = typeof player.country === "string" ? player.country.toUpperCase() : "";
    if (!/^[A-Z]{2}$/.test(code)) return;
    const countryPlayers = countries.get(code) || [];
    countryPlayers.push(player);
    countries.set(code, countryPlayers);
  });

  return {
    ...region,
    players,
    countries,
    lastModified: isoTimestamp(
      Number(payload.fetched_at) || Number(payload.time_posted)
    ),
  };
}

function pageMetadata(region, country = null, pathname = "/") {
  if (country) {
    return {
      title: `Dota 2 Leaderboard | ${country.name}, ${region.name}`,
      description: `Current ${country.name} Dota 2 leaderboard for ${region.name}, with player ranks, team tags, and country positions.`,
      url: `${SITE_URL}${pathname}`,
    };
  }

  if (pathname !== "/") {
    return {
      title: `Dota 2 Leaderboard | ${region.name}`,
      description: `Current Dota 2 leaderboard for ${region.name}, with player rankings, team tags, countries, and rank changes.`,
      url: `${SITE_URL}${pathname}`,
    };
  }

  return {
    title: HOME_TITLE,
    description: "Browse current Dota 2 leaderboards by region, country, player name, and team.",
    url: `${SITE_URL}/`,
  };
}

function createPages(regionData) {
  const europe = regionData.find(({ key }) => key === "europe") || regionData[0];
  const pages = [{
    type: "home",
    pathname: "/",
    region: europe,
    country: null,
    players: europe.players,
    lastModified: europe.lastModified,
  }];

  regionData.forEach((region) => {
    pages.push({
      type: "region",
      pathname: `/${region.path}/`,
      region,
      country: null,
      players: region.players,
      lastModified: region.lastModified,
    });

    Array.from(region.countries.entries())
      .map(([code, players]) => ({
        code,
        name: countryName(code),
        players,
      }))
      .sort((a, b) => (
        countryNameCollator.compare(a.name, b.name)
        || a.code.localeCompare(b.code, "en")
      ))
      .forEach((country) => {
        pages.push({
          type: "country",
          pathname: `/${region.path}/${countryPath(country.code)}/`,
          region,
          country,
          players: country.players,
          lastModified: region.lastModified,
        });
      });
  });

  const paths = new Set();
  pages.forEach((page) => {
    if (paths.has(page.pathname)) throw new Error(`Duplicate SEO path: ${page.pathname}`);
    paths.add(page.pathname);
  });
  return pages;
}

function createStructuredData(page, metadata) {
  const itemList = {
    "@type": "ItemList",
    numberOfItems: page.players.length,
    itemListElement: page.players.slice(0, 25).map((player, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: player.name || "Anonymous player",
    })),
  };
  const pageEntity = {
    "@type": page.type === "home" ? "WebApplication" : "CollectionPage",
    "@id": `${metadata.url}#page`,
    name: metadata.title,
    url: metadata.url,
    description: metadata.description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: itemList,
  };

  if (page.lastModified) pageEntity.dateModified = page.lastModified;
  if (page.type === "home") {
    pageEntity.applicationCategory = "GameApplication";
    pageEntity.operatingSystem = "Any";
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
      },
      pageEntity,
    ],
  };
}

function createSeoHead(page) {
  const metadata = pageMetadata(page.region, page.country, page.pathname);
  const structuredData = JSON.stringify(createStructuredData(page, metadata))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return [
    `<title>${htmlEscape(metadata.title)}</title>`,
    `    <meta name="description" content="${htmlEscape(metadata.description)}" />`,
    `    <link rel="canonical" href="${htmlEscape(metadata.url)}" />`,
    `    <meta property="og:title" content="${htmlEscape(metadata.title)}" />`,
    `    <meta property="og:description" content="${htmlEscape(metadata.description)}" />`,
    `    <meta property="og:url" content="${htmlEscape(metadata.url)}" />`,
    `    <meta name="twitter:title" content="${htmlEscape(metadata.title)}" />`,
    `    <meta name="twitter:description" content="${htmlEscape(metadata.description)}" />`,
    `    <script id="seo-structured-data" type="application/ld+json">${structuredData}</script>`,
  ].join("\n");
}

function formatUpdatedAt(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return `${new Date(timestamp).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function createRegionLinks(page, pages) {
  return pages
    .filter(({ type }) => type === "region")
    .map((regionPage) => {
      const current = page.type !== "home" && page.region.key === regionPage.region.key
        ? ' aria-current="page"'
        : "";
      return `        <a class="seo-fallback__region-link" href="${htmlEscape(regionPage.pathname)}"${current}>${htmlEscape(regionPage.region.name)}</a>`;
    })
    .join("\n");
}

function createCountryLinks(page, pages) {
  if (page.type !== "region") return "";

  const links = pages
    .filter(({ type, region }) => type === "country" && region.key === page.region.key)
    .map((countryPage) => `        <a href="${htmlEscape(countryPage.pathname)}">${htmlEscape(countryPage.country.name)}</a>`)
    .join("\n");

  return [
    '      <nav class="seo-fallback__countries" aria-label="Country leaderboards">',
    links,
    "      </nav>",
  ].join("\n");
}

function createLeaderboardRows(page) {
  return page.players.slice(0, STATIC_ROW_LIMIT).map((player, index) => {
    const code = typeof player.country === "string" ? player.country.toUpperCase() : "";
    const country = /^[A-Z]{2}$/.test(code)
      ? `<a href="/${htmlEscape(page.region.path)}/${htmlEscape(countryPath(code))}/">${htmlEscape(countryName(code))}</a>`
      : "—";
    const countryRank = page.type === "country"
      ? `          <td>${index + 1}</td>\n`
      : "";

    return [
      "        <tr>",
      countryRank.trimEnd(),
      `          <td>${htmlEscape(player.rank)}</td>`,
      `          <td>${htmlEscape(player.name || "Anonymous player")}</td>`,
      `          <td>${htmlEscape(player.team_tag || "—")}</td>`,
      `          <td>${country}</td>`,
      "        </tr>",
    ].filter(Boolean).join("\n");
  }).join("\n");
}

function createSeoBody(page, pages) {
  const metadata = pageMetadata(page.region, page.country, page.pathname);
  const heading = page.country
    ? `${page.country.name} Dota 2 Leaderboard — ${page.region.name}`
    : page.type === "region"
      ? `${page.region.name} Dota 2 Leaderboard`
      : SITE_NAME;
  const updatedAt = formatUpdatedAt(page.lastModified);
  const rowCount = Math.min(page.players.length, STATIC_ROW_LIMIT);
  const countryRankHeader = page.type === "country"
    ? "            <th scope=\"col\">Country rank</th>\n"
    : "";
  const parentLink = page.type === "country"
    ? `      <p class="seo-fallback__breadcrumb"><a href="/">Dota 2 Leaderboards</a> / <a href="/${htmlEscape(page.region.path)}/">${htmlEscape(page.region.name)}</a> / ${htmlEscape(page.country.name)}</p>`
    : "";
  const countryLinks = createCountryLinks(page, pages);

  return [
    '  <div class="seo-fallback">',
    '    <main class="seo-fallback__content">',
    '      <header class="seo-fallback__header">',
    '        <a class="seo-fallback__brand" href="/">Dota 2 Leaderboards</a>',
    "      </header>",
    '      <nav class="seo-fallback__regions" aria-label="Leaderboard regions">',
    createRegionLinks(page, pages),
    "      </nav>",
    parentLink,
    `      <h1>${htmlEscape(heading)}</h1>`,
    `      <p class="seo-fallback__summary">${htmlEscape(metadata.description)} Showing the top ${rowCount.toLocaleString("en-US")} of ${page.players.length.toLocaleString("en-US")} ranked players.${updatedAt ? ` Updated <time datetime="${htmlEscape(page.lastModified)}">${htmlEscape(updatedAt)}</time>.` : ""}</p>`,
    countryLinks,
    '      <div class="seo-fallback__table-wrap">',
    '        <table class="seo-fallback__table">',
    `          <caption>Top ${rowCount.toLocaleString("en-US")} ${htmlEscape(page.country?.name || page.region.name)} players</caption>`,
    "          <thead>",
    "          <tr>",
    countryRankHeader.trimEnd(),
    '            <th scope="col">Region rank</th>',
    '            <th scope="col">Player</th>',
    '            <th scope="col">Team</th>',
    '            <th scope="col">Country</th>',
    "          </tr>",
    "          </thead>",
    "          <tbody>",
    createLeaderboardRows(page),
    "          </tbody>",
    "        </table>",
    "      </div>",
    "    </main>",
    "  </div>",
  ].filter(Boolean).join("\n");
}

function replaceSeoHead(html, page) {
  const start = html.indexOf("<title>");
  const structuredDataStart = html.indexOf('<script id="seo-structured-data"', start);
  const structuredDataEnd = html.indexOf("</script>", structuredDataStart);
  if (start < 0 || structuredDataStart < start || structuredDataEnd < structuredDataStart) {
    throw new Error("SEO metadata block is missing from index.html");
  }
  return `${html.slice(0, start)}${createSeoHead(page)}${html.slice(structuredDataEnd + 9)}`;
}

function replaceSeoBody(html, page, pages) {
  const rootPattern = /<div id="root"[^>]*>\s*<\/div>/;
  if (!rootPattern.test(html)) {
    throw new Error("Empty root container is missing from index.html");
  }
  return html.replace(rootPattern, `<div id="root">\n${createSeoBody(page, pages)}\n</div>`);
}

function createSitemap(pages) {
  const urls = pages.map((page) => [
    "  <url>",
    `    <loc>${xmlEscape(`${SITE_URL}${page.pathname}`)}</loc>`,
    page.lastModified ? `    <lastmod>${page.lastModified}</lastmod>` : "",
    "  </url>",
  ].filter(Boolean).join("\n"));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

function writeSeoPages(buildDir, pages) {
  const indexPath = path.join(buildDir, "index.html");
  if (!fs.existsSync(indexPath)) throw new Error(`${indexPath} does not exist`);
  const baseHtml = fs.readFileSync(indexPath, "utf8");

  pages.forEach((page) => {
    const outputPath = page.pathname === "/"
      ? indexPath
      : path.join(buildDir, ...page.pathname.split("/").filter(Boolean), "index.html");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const html = replaceSeoHead(baseHtml, page);
    fs.writeFileSync(outputPath, replaceSeoBody(html, page, pages), "utf8");
  });
}

function main() {
  const projectDir = path.resolve(__dirname, "..");
  const dataDir = path.resolve(readOption("--data-dir", path.join(projectDir, "public", "data")));
  const buildDir = path.resolve(readOption("--build-dir", path.join(projectDir, "build")));
  const sitemapOnly = process.argv.includes("--sitemap-only");
  const sitemapPath = path.resolve(readOption(
    "--sitemap",
    sitemapOnly
      ? path.join(projectDir, "public", "sitemap.xml")
      : path.join(buildDir, "sitemap.xml")
  ));
  const regionData = REGIONS
    .map((region) => readRegionData(dataDir, region))
    .filter(Boolean);
  if (regionData.length === 0) throw new Error(`No leaderboard data found in ${dataDir}`);

  const pages = createPages(regionData);
  fs.mkdirSync(path.dirname(sitemapPath), { recursive: true });
  fs.writeFileSync(sitemapPath, createSitemap(pages), "utf8");
  if (!sitemapOnly) writeSeoPages(buildDir, pages);
  process.stdout.write(`Generated ${pages.length} SEO URLs\n`);
}

if (require.main === module) main();

module.exports = {
  createPages,
  createSeoBody,
  createSitemap,
  replaceSeoBody,
};
