# Dota 2 Leaderboards

[dota2leaderboards.com](https://dota2leaderboards.com/) is a responsive viewer for the official Dota 2 division leaderboards for Europe, the Americas, China, and Southeast Asia.

## Features

- Filter by region, country, player name, or team tag.
- Choose how many players appear on each page and move through the complete regional leaderboard.
- Use the browser's Ctrl+F search across the entire selected region, including players outside the current page.
- Pin players, filter to pinned players, and save named views in local browser storage.
- Compare rank changes over 8 hours, 24 hours, 7 days, or 30 days.
- Copy compact share links that include the selected region, country, row count, rank-change window, and shared pins. Existing verbose query links remain supported.

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

The production output is written to `build/`.

## Leaderboard data

Current snapshots are stored in `public/data/<region>/v0001.json`. Rank history is stored separately in `public/data/<region>/history.v0001.json` so refreshing a leaderboard cannot discard previously collected history.

The updater uses Python's standard library and validates every non-empty response before replacing a region. Writes are atomic. If a request fails or returns invalid data, that region's existing snapshot and history remain unchanged. Rank snapshots are recorded at most once every eight hours and retained for 30 days.

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

- `Refresh leaderboard data` runs at minute 14 of every hour and can also be started manually. It tests the updater, downloads and validates every region, commits only changed files under `public/data`, and triggers deployment when data changed.
- `Build and deploy GitHub Pages` runs for changes to `master`, manual starts, and successful data refreshes. It installs from `package-lock.json`, runs the frontend tests, creates an optimized build, and deploys it with GitHub Pages.

The workflows use the repository-provided `GITHUB_TOKEN`. Google Analytics is optional and is enabled only when the `GA_MEASUREMENT_ID` repository variable is configured. Local builds can use `REACT_APP_GA_MEASUREMENT_ID`.
