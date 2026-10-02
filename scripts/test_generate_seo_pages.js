const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const {
  createPages,
  createSeoBody,
  createSitemap,
  replaceSeoBody,
  validateSeoPages,
} = require("./generate_seo_pages");

function player(rank, name, country = "", teamTag = "") {
  return {
    rank,
    name,
    country,
    team_tag: teamTag,
  };
}

const europePlayers = [
  player(1, "First & <Best>", "fi", "ONE"),
  ...Array.from({ length: 100 }, (_, index) => player(index + 2, `Player ${index + 2}`, "se")),
  player(102, "<script>last</script>", "se"),
];
const regions = [
  {
    key: "europe",
    name: "Europe",
    path: "europe",
    players: europePlayers,
    countries: new Map([
      ["FI", [europePlayers[0]]],
      ["SE", europePlayers.slice(1)],
      ["AL", [player(103, "Albania Player", "al")]],
      ["AX", [player(104, "Åland Player", "ax")]],
    ]),
    lastModified: "2026-07-28T05:45:52Z",
  },
  {
    key: "americas",
    name: "Americas",
    path: "americas",
    players: [player(1, "Americas Player", "us")],
    countries: new Map([["US", [player(1, "Americas Player", "us")]]]),
    lastModified: "2026-07-28T05:45:52Z",
  },
];

const pages = createPages(regions);
const europePage = pages.find(({ pathname }) => pathname === "/europe/");
const finlandPage = pages.find(({ pathname }) => pathname === "/europe/finland/");
const alandPageIndex = pages.findIndex(({ pathname }) => pathname === "/europe/aland-islands/");
const albaniaPageIndex = pages.findIndex(({ pathname }) => pathname === "/europe/albania/");
const europeBody = createSeoBody(europePage, pages);
const finlandBody = createSeoBody(finlandPage, pages);

assert.ok(alandPageIndex >= 0 && alandPageIndex < albaniaPageIndex);
assert.match(europeBody, /<h1>Europe Dota 2 Leaderboard<\/h1>/);
assert.match(europeBody, /href="\/europe\/finland\/">Finland<\/a>/);
assert.match(europeBody, /First &amp; &lt;Best&gt;/);
assert.doesNotMatch(europeBody, /&lt;script&gt;last/);
assert.match(europeBody, /Showing the top 100 of 102 ranked players/);
assert.match(finlandBody, /<th scope="col">Country rank<\/th>/);
assert.match(finlandBody, /<a href="\/europe\/">Europe<\/a>/);

const baseHtml = '<html><body><div id="root"></div></body></html>';
const renderedHtml = replaceSeoBody(baseHtml, europePage, pages);
assert.doesNotMatch(renderedHtml, /<div id="root"><\/div>/);
assert.match(renderedHtml, /<table class="seo-fallback__table">/);
assert.throws(
  () => replaceSeoBody("<html></html>", europePage, pages),
  /Empty root container/
);

const sitemap = createSitemap(pages);
assert.match(sitemap, /https:\/\/dota2leaderboards\.com\/europe\//);
assert.doesNotMatch(sitemap, /\?region=|\/all\//);

const documentShell = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8"
);
const visibilityStyle = documentShell.indexOf('id="seo-fallback-visibility"');
const bootstrapScript = documentShell.indexOf('id="seo-fallback-bootstrap"');
const rootContainer = documentShell.indexOf('<div id="root"></div>');
assert.ok(visibilityStyle >= 0 && visibilityStyle < rootContainer);
assert.ok(bootstrapScript >= 0 && bootstrapScript < rootContainer);
assert.match(documentShell, /html\.js-enabled \.seo-fallback\s*{\s*display: none !important;/);
assert.match(documentShell, /document\.documentElement\.classList\.add\("js-enabled"\)/);
assert.match(documentShell, /if \(!document\.querySelector\("\.app-shell"\)\)/);
assert.match(documentShell, /document\.documentElement\.classList\.remove\("js-enabled"\)/);

const missingPage = fs.readFileSync(path.join(__dirname, "..", "public", "404.html"), "utf8");
assert.match(missingPage, /window\.location\.replace\("\/"\)/);
assert.match(missingPage, /http-equiv="refresh" content="0; url=\/"/);

const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "d2l-seo-"));
try {
  const buildDir = path.join(temporaryDir, "build");
  const dataDir = path.join(temporaryDir, "data");
  fs.mkdirSync(buildDir);
  fs.writeFileSync(path.join(buildDir, "index.html"), documentShell);
  regions.forEach((region) => {
    fs.mkdirSync(path.join(dataDir, region.key), { recursive: true });
    fs.writeFileSync(path.join(dataDir, region.key, "v0001.json"), JSON.stringify({
      fetched_at: 1785217552,
      leaderboard: Array.from(region.countries.values()).flat(),
    }));
  });
  execFileSync(process.execPath, [
    path.join(__dirname, "generate_seo_pages.js"),
    "--build-dir", buildDir,
    "--data-dir", dataDir,
  ]);

  const sitemapPath = path.join(buildDir, "sitemap.xml");
  validateSeoPages(buildDir, pages, sitemapPath);
  const finlandPath = path.join(buildDir, "europe", "finland", "index.html");
  const countryHtml = fs.readFileSync(finlandPath, "utf8");
  assert.match(countryHtml, /href="https:\/\/dota2leaderboards\.com\/europe\/finland\/"/);
  const americasHtml = fs.readFileSync(path.join(buildDir, "americas", "index.html"), "utf8");
  assert.match(americasHtml, /href="\/data\/americas\/v0001\.json"/);
  assert.doesNotMatch(americasHtml, /href="\/data\/europe\/v0001\.json"/);

  fs.writeFileSync(finlandPath, countryHtml.replace("/data/europe/v0001.json", "/data/americas/v0001.json"));
  assert.throws(() => validateSeoPages(buildDir, pages, sitemapPath), /Incorrect leaderboard data preload/);

  fs.writeFileSync(finlandPath, countryHtml.replace("</main>", '<a href="/china/finland/">China</a></main>'));
  assert.throws(() => validateSeoPages(buildDir, pages, sitemapPath), /Broken leaderboard link/);
  fs.writeFileSync(finlandPath, countryHtml.replace('rel="canonical"', 'rel="alternate"'));
  assert.throws(() => validateSeoPages(buildDir, pages, sitemapPath), /incorrect canonical/);
  fs.writeFileSync(finlandPath, countryHtml.replace('content="index,follow"', 'content="noindex,follow"'));
  assert.throws(() => validateSeoPages(buildDir, pages, sitemapPath), /marked noindex/);
  fs.writeFileSync(finlandPath, countryHtml);
  fs.writeFileSync(sitemapPath, createSitemap([...pages, pages[0]]));
  assert.throws(() => validateSeoPages(buildDir, pages, sitemapPath), /exactly once/);
  fs.writeFileSync(sitemapPath, createSitemap(pages));
  fs.unlinkSync(finlandPath);
  assert.throws(() => validateSeoPages(buildDir, pages, sitemapPath), /ENOENT/);

  const newPlayer = player(2, "New Finland Player", "fi");
  const futureAmericas = {
    ...regions[1],
    players: [...regions[1].players, newPlayer],
    countries: new Map([...regions[1].countries, ["FI", [newPlayer]]]),
  };
  const futurePages = createPages([regions[0], futureAmericas]);
  assert.ok(!pages.some(({ pathname }) => pathname === "/americas/finland/"));
  fs.writeFileSync(path.join(dataDir, "americas", "v0001.json"), JSON.stringify({
    fetched_at: 1785217552,
    leaderboard: futureAmericas.players,
  }));
  fs.writeFileSync(path.join(buildDir, "index.html"), documentShell);
  execFileSync(process.execPath, [
    path.join(__dirname, "generate_seo_pages.js"),
    "--build-dir", buildDir,
    "--data-dir", dataDir,
  ]);
  validateSeoPages(buildDir, futurePages, sitemapPath);
  const newCountryHtml = fs.readFileSync(path.join(buildDir, "americas", "finland", "index.html"), "utf8");
  assert.match(newCountryHtml, /New Finland Player/);
  assert.match(fs.readFileSync(sitemapPath, "utf8"), /https:\/\/dota2leaderboards\.com\/americas\/finland\//);
} finally {
  fs.rmSync(temporaryDir, { recursive: true, force: true });
}

process.stdout.write(`SEO generator tests passed (${pages.length} pages)\n`);
