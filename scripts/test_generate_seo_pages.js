const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const {
  createPages,
  createSeoBody,
  createSitemap,
  replaceSeoBody,
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

process.stdout.write(`SEO generator tests passed (${pages.length} pages)\n`);
