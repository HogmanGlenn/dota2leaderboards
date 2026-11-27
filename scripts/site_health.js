const SITE_URL = "https://dota2leaderboards.com";
const REGIONS = ["europe", "americas", "china", "se_asia"];
const WORKFLOWS = ["update-leaderboards.yml", "deploy-pages.yml"];
const MAX_AGE_SECONDS = 3 * 60 * 60;
const ISSUE_MARKER = "<!-- dota2leaderboards-site-health -->";

function snapshotProblems(region, payload, now = Date.now()) {
  if (!payload || !Array.isArray(payload.leaderboard) || !payload.leaderboard.length) {
    return [`${region}: published leaderboard is missing or empty.`];
  }
  const problems = [];
  for (const field of ["fetched_at", "time_posted"]) {
    const timestamp = payload[field];
    if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp * 1000 > now + 15 * 60 * 1000) {
      problems.push(`${region}: invalid ${field} timestamp.`);
    } else if (now / 1000 - timestamp > MAX_AGE_SECONDS) {
      problems.push(`${region}: ${field} is over three hours old (${new Date(timestamp * 1000).toISOString()}).`);
    }
  }
  return problems;
}

async function collectProblems({ github, context, fetchImpl = fetch, now = Date.now() }) {
  const problems = [];
  const checks = [
    ...WORKFLOWS.map(async (workflow) => {
      const { data } = await github.rest.actions.listWorkflowRuns({
        ...context.repo, workflow_id: workflow, branch: "master", status: "completed", per_page: 10,
      });
      const run = data.workflow_runs.find(({ conclusion }) => !["cancelled", "skipped"].includes(conclusion));
      if (!run) return [`${workflow}: no completed run found.`];
      return run.conclusion === "success" ? [] : [`${workflow}: ${run.conclusion}. ${run.html_url}`];
    }),
    ...REGIONS.map(async (region) => {
      const response = await fetchImpl(`${SITE_URL}/data/${region}/v0001.json`, {
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return [`${region}: published data returned HTTP ${response.status}.`];
      return snapshotProblems(region, await response.json(), now);
    }),
    (async () => {
      const response = await fetchImpl(`${SITE_URL}/`, {
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return [`Homepage returned HTTP ${response.status}.`];
      const html = await response.text();
      return /id=["']root["']/.test(html) && html.includes("Dota 2 Leaderboard")
        ? [] : ["Homepage did not contain the leaderboard application."];
    })(),
  ];
  const labels = [...WORKFLOWS, ...REGIONS, "Homepage"];
  const results = await Promise.allSettled(checks);
  results.forEach((result, index) => {
    if (result.status === "fulfilled") problems.push(...result.value);
    else problems.push(`${labels[index]}: health check could not complete (${result.reason.message}).`);
  });
  return problems;
}

async function publishIncident({ github, context, problems, test = false }) {
  const marker = test ? `${ISSUE_MARKER} notification-test` : ISSUE_MARKER;
  const title = test ? "[Site health] Notification test" : "[Site health] Leaderboard publishing needs attention";
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo, state: "open", creator: "github-actions[bot]", per_page: 100,
  });
  const existing = issues.find((issue) => issue.title === title && issue.body?.includes(marker));
  if (!problems.length && !existing) return null;

  let issue = existing;
  if (problems.length && !issue) {
    const { data } = await github.rest.issues.create({
      ...context.repo, title, assignees: [context.repo.owner],
      body: [
        marker,
        `@${context.repo.owner}, ${test ? "this is the requested alert delivery test." : "the leaderboard publishing checks found a problem."}`,
        "",
        ...problems.map((problem) => `- ${problem}`),
        "",
        `Monitor run: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
        "",
        test ? "The live website has not been changed by this test." : "One issue is opened per incident; hourly checks do not create duplicate alerts. It closes automatically after recovery.",
      ].join("\n"),
    });
    issue = data;
  }
  if ((!problems.length || test) && issue) {
    await github.rest.issues.createComment({
      ...context.repo, issue_number: issue.number,
      body: test ? "Notification test completed. The alert was created with an owner mention and assignment."
        : "Publishing recovered: the latest refresh and deployment succeeded, all four published regions are fresh, and the homepage is available.",
    });
    await github.rest.issues.update({
      ...context.repo, issue_number: issue.number, state: "closed", state_reason: "completed",
    });
  }
  return issue.html_url;
}

async function monitor({ github, context, core }) {
  const test = context.payload.inputs?.test_notification === "true";
  const problems = test ? ["Test of the GitHub incident notification path."] : await collectProblems({ github, context });
  const url = await publishIncident({ github, context, problems, test });
  if (test) core.info(`Notification test completed: ${url}`);
  else if (problems.length) core.setFailed(`${problems.join("\n")}\nIncident: ${url}`);
  else core.info("Publishing and all four live leaderboards are healthy.");
}

module.exports = { snapshotProblems, collectProblems, publishIncident, monitor };
