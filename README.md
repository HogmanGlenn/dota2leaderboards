# Dota 2 Leaderboards

[dota2leaderboards.com](https://dota2leaderboards.com/) is a responsive viewer for the official Dota 2 division leaderboards for Europe, the Americas, China, and Southeast Asia.

## Features

- Filter by region, country, player name, or team tag.
- Choose how many players appear on each page and move through the complete regional leaderboard.
- Use the browser's Ctrl+F search across the entire selected region, including players outside the current page.
- Pin players, filter to pinned players, and save named views in local browser storage.
- Compare rank changes over 8 hours, 24 hours, 7 days, or 30 days.
- Copy permanent links that include the selected region, country, row count, rank-change window, and shared pins. Existing compact and verbose query links remain supported.
- Open crawlable region and country URLs with page-specific titles, descriptions, canonical links, and structured leaderboard data.

## Local development

Use Node.js 24, which matches the deployment workflow.

```bash
npm ci
npm start
```

Run the frontend tests and optimized production build with:

```bash
npm run test:ci
npm run build
```

The production output is written to `build/`. The post-build step creates static HTML entry points for each current region and country leaderboard and writes their canonical URLs to the deployed sitemap.

## Search indexing

Country pages are generated from the current ranked players in each region at every build. A country that gains players automatically gets its page and sitemap entry again; absence from one snapshot does not permanently exclude it. Region tabs preserve the selected country. If the destination's successfully loaded data has no players from that country, the app returns to the main page.

The build checks that every sitemap URL has a generated HTML page with its own canonical URL, that leaderboard pages allow indexing, and that static leaderboard links point to generated pages. Missing static pages use GitHub Pages' HTTP 404 response and redirect visitors to the main page with JavaScript and a meta-refresh fallback. A failed data request keeps the requested country URL available for retry, because a failed request does not establish whether the country exists.

The October 2, 2026 Search Console export ends on September 21: 361 URLs were indexed, with 63 not found, 26 redirects, 4 crawled but not indexed, and 48 discovered but not indexed. The summary export has no affected URLs, so it cannot identify which individual exclusions need repair. Export the URL examples from an issue's details to investigate them. Expected trailing-slash redirects and currently unavailable country pages do not need to be indexed. See [Google's Page indexing report guidance](https://support.google.com/webmasters/answer/7440203?hl=en).

## Loading and analytics follow-up

Each generated page preloads only its own region's leaderboard. Other regions are fetched when their tabs are hovered, focused, or opened, and reused from the cache. A loading indicator in the selected tab marks pending region switches while the previous rows remain visible. Rank history loads only when enabled.

Analytics behavior is unchanged in this release. The GA4 web stream currently enables automatic browser-history page views. Before adopting manual page-view tracking, disable **Page changes based on browser history events** in the stream's Enhanced measurement settings. `send_page_view: false` disables the initial automatic view but does not disable automatic history views. See [Google's manual page-view guidance](https://developers.google.com/analytics/devguides/collection/ga4/views#disable_page_changes_based_on_browser_history_events).

The supplied analytics snapshot covers July 4 through October 1, 2026, with 2,054 active users and 50.6 seconds of average engagement. It has no device breakdown, feature-event breakdown, or Search Console query/click/position data. The accompanying Coverage ZIP contains the earlier indexing export, so it does not establish search click-through rates or query-specific opportunities.

## Leaderboard data

Current snapshots are stored in `public/data/<region>/v0001.json`. Rank history is stored separately in `public/data/<region>/history.v0001.json` so refreshing a leaderboard cannot discard previously collected history.

The updater validates every non-empty response before replacing a region. Writes are atomic. If a request fails or returns invalid data, that region's existing snapshot and history remain unchanged. Rank snapshots are recorded at most once every eight hours and retained for 30 days. Node.js generates the sitemap from the validated regional data so country names and canonical paths use the same Unicode-safe normalization as the site build.

Use Python 3.12, which matches the automation workflow:

```bash
python scripts/update_leaderboards.py
```

Update selected regions:

```bash
python scripts/update_leaderboards.py --region europe --region americas
```

Continuously refresh for local inspection:

```bash
python scripts/update_leaderboards.py --watch --interval 30
```

Run the updater tests with:

```bash
python -m unittest discover -s scripts -p "test_*.py"
```

## Automation

- `Refresh leaderboard data` runs at minute 14 of every hour and can also be started manually. It tests the updater, downloads and validates every region, commits changed leaderboard data and the sitemap, and triggers deployment when data changed.
- `Build and deploy GitHub Pages` runs for changes to `master`, manual starts, and successful data refreshes. It installs from `package-lock.json`, runs the frontend tests, creates an optimized build, and deploys it with GitHub Pages.
- Consecutive automated data refreshes are folded into one rolling `Update leaderboard data` commit. A human commit starts a new rolling data commit, so human-authored history is never rewritten. If repository rules prohibit force-pushes, the refresh safely falls back to a normal commit.
- `Clean up automation history` runs weekly and can also be started manually. It keeps seven days of completed refresh/cleanup workflow runs and inactive GitHub Pages deployment records, leaving human-code workflow runs and active deployments untouched.

The workflows use the repository-provided `GITHUB_TOKEN`. Google Analytics is optional and is enabled only when the `GA_MEASUREMENT_ID` repository variable is configured. Local builds can use `REACT_APP_GA_MEASUREMENT_ID`.
