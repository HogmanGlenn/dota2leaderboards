# Dota 2 Leaderboards

A responsive GitHub Pages viewer for the official Dota 2 division leaderboards. Players can browse Europe, the Americas, China, and Southeast Asia, then filter by country, player name, or team tag.

## Local development

This project requires Node.js 20 or newer.

```bash
npm ci
npm start
```

Run the automated checks and production build with:

```bash
npm run test:ci
npm run build
```

Filters are stored in normal query parameters, such as `?region=americas`. This keeps direct links compatible with a GitHub Pages project site without adding a hash fragment or requiring a custom 404 handler.

## Refreshing leaderboard data

The updater uses only Python's standard library. Each region is replaced only after a valid, non-empty API response and receives a `fetched_at` timestamp for that successful refresh. If a request fails or Dota returns an empty leaderboard, the existing JSON for that region is left untouched, including its timestamp.

```bash
python scripts/update_leaderboards.py
```

To update one or more divisions locally:

```bash
python scripts/update_leaderboards.py --region europe --region americas
```

For local inspection, keep it refreshing every 30 seconds:

```bash
python scripts/update_leaderboards.py --watch --interval 30
```

Generated JSON is stored in `public/data/<region>/v0001.json` and is included in the static production build.
Run the updater unit tests with `python -m unittest discover -s scripts -p "test_*.py"`.

## GitHub Pages automation

Two workflows are included:

- `Build and deploy GitHub Pages` runs tests, builds the React app, and deploys it whenever `master` changes or the workflow is started manually.
- `Refresh leaderboard data` runs at minute 14 of every hour (and on demand), commits changed JSON, and calls the Pages deployment workflow directly.

Before the first deployment, open **Settings → Pages** in GitHub and set **Source** to **GitHub Actions**. The workflows use only the repository-provided `GITHUB_TOKEN`; no custom secrets are required.

### Deployment checklist

After pushing to `master`:

1. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Add the optional `GA_MEASUREMENT_ID` repository variable if Google Analytics should be enabled.
3. Add the custom domain in **Settings → Pages**.
4. Point the domain DNS at GitHub Pages, then wait for GitHub to verify DNS and issue HTTPS.

## Analytics

Google Analytics is optional. To enable it in production, create a GitHub repository variable named `GA_MEASUREMENT_ID` with the GA4 measurement ID, for example `G-XXXXXXXXXX`. Local builds can use the same value through `REACT_APP_GA_MEASUREMENT_ID`.

If the default branch is renamed, update the `master` branch references in both files under `.github/workflows`.
