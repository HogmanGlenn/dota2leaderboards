const assert = require("node:assert/strict");
const { snapshotProblems, collectProblems, publishIncident, monitor } = require("./site_health");

async function main() {
  const now = Date.parse("2026-11-27T10:00:00Z");
  const fresh = { leaderboard: [{ rank: 1, name: "Player" }], fetched_at: now / 1000, time_posted: now / 1000 - 3600 };
  assert.deepEqual(snapshotProblems("europe", fresh, now), []);
  assert.match(snapshotProblems("china", { ...fresh, time_posted: now / 1000 - 4 * 3600 }, now)[0], /time_posted is over three hours old/);
  for (const timestamp of [null, "1795770000", -1, now / 1000 + 3600]) {
    assert.match(snapshotProblems("china", { ...fresh, fetched_at: timestamp }, now)[0], /invalid fetched_at/);
  }
  assert.match(snapshotProblems("china", { ...fresh, leaderboard: [] }, now)[0], /missing or empty/);

  const context = { repo: { owner: "Owner", repo: "leaderboards" }, serverUrl: "https://github.com", runId: 123, payload: {} };
  let runs = [{ conclusion: "cancelled" }, { conclusion: "success" }];
  let networkFailure = false;
  const issues = [];
  const comments = [];
  const github = {
    rest: {
      actions: { listWorkflowRuns: async () => ({ data: { workflow_runs: runs } }) },
      issues: {
        listForRepo: () => {},
        create: async (input) => {
          const issue = { ...input, number: issues.length + 1, html_url: "https://github.com/Owner/leaderboards/issues/1", state: "open" };
          issues.push(issue);
          return { data: issue };
        },
        createComment: async (input) => { comments.push(input); },
        update: async (input) => { Object.assign(issues.find((issue) => issue.number === input.issue_number), input); },
      },
    },
    paginate: async () => issues.filter((issue) => issue.state === "open"),
  };
  const fetchImpl = async (url) => {
    if (networkFailure && url.includes("china")) throw new Error("Network unavailable");
    return { ok: true, json: async () => fresh, text: async () => '<title>Dota 2 Leaderboards</title><div id="root"></div>' };
  };
  assert.deepEqual(await collectProblems({ github, context, fetchImpl, now }), []);
  runs = [{ conclusion: "failure", html_url: "https://github.com/Owner/leaderboards/actions/runs/456" }];
  networkFailure = true;
  const problems = await collectProblems({ github, context, fetchImpl, now });
  assert.equal(problems.length, 3);
  assert.ok(problems.some((problem) => problem.includes("china: health check could not complete")));
  assert.ok(problems.some((problem) => problem.includes("/actions/runs/456")));
  const httpProblems = await collectProblems({ github, context, fetchImpl: async () => ({ ok: false, status: 503 }), now });
  assert.equal(httpProblems.filter((problem) => problem.includes("HTTP 503")).length, 5);

  assert.equal(await publishIncident({ github, context, problems: [] }), null);
  await publishIncident({ github, context, problems });
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].assignees, ["Owner"]);
  assert.match(issues[0].body, /@Owner/);
  await publishIncident({ github, context, problems: ["Another failed run"] });
  assert.equal(issues.length, 1, "Repeated failures must not create duplicate alerts");
  assert.equal(comments.length, 0, "Repeated failures must not send hourly comments");
  await publishIncident({ github, context, problems: [] });
  assert.equal(issues[0].state, "closed");
  assert.equal(comments.length, 1);
  await publishIncident({ github, context, problems });
  assert.equal(issues.length, 2, "A new incident after recovery must send a new alert");

  await monitor({
    github, context: { ...context, payload: { inputs: { test_notification: "true" } } },
    core: { info: () => {}, setFailed: () => assert.fail("Notification tests must not fail health checks") },
  });
  assert.equal(issues.length, 3);
  assert.equal(issues[2].state, "closed");
  assert.equal(issues[1].state, "open", "A notification test must not close a real incident");
  console.log("Site health tests passed: freshness, failures, incident alerts, deduplication, recovery, and notification test.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
