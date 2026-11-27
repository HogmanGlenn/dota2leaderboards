import { createHistoryIndex, findHistorySample, getRankDelta } from "./history";

test.each(["8h", "24h", "7d", "30d"])("rejects outage-era samples for %s instead of reporting fabricated movement or new entries", (windowName) => {
  const now = Date.parse("2026-11-27T10:00:00Z") / 1000;
  const history = createHistoryIndex({ players: ["p1"], samples: [
    { t: now - 15 * 86400, i: [0], r: [50] },
    { t: now, i: [0], r: [10] },
  ] });
  expect(getRankDelta({ playerKey: "p1", rank: 10 }, history, now, windowName)).toEqual({ label: "—", type: "missing" });
  expect(getRankDelta({ playerKey: "pnew", rank: 20 }, history, now, windowName)).toEqual({ label: "—", type: "missing" });
});

test("a valid month comparison survives an intervening outage without inventing missing samples", () => {
  const now = Date.parse("2026-11-27T10:00:00Z") / 1000;
  const data = { players: ["p1"], samples: [
    { t: now - 30 * 86400 + 2 * 3600, i: [0], r: [50] },
    { t: now, i: [0], r: [10] },
  ] };
  expect(getRankDelta({ playerKey: "p1", rank: 10 }, createHistoryIndex(data), now, "30d")).toEqual({ label: "+40", type: "up" });
  expect(data.samples).toHaveLength(2);
});

test("comparison tolerance is bounded, prefers the earlier sample on a tie, and ignores invalid and future samples", () => {
  const now = 10_000_000;
  const target = now - 86400;
  const earlier = { t: target - 4 * 3600 };
  expect(findHistorySample([{ t: target + 4 * 3600 }, earlier, null, { t: NaN }, { t: now + 1 }], now, "24h")).toBe(earlier);
  expect(findHistorySample([{ t: target - 4 * 3600 - 1 }, { t: now }], now, "24h")).toBeNull();
});

test("calculates improved, worsened, new, and missing rank deltas", () => {
  const history = createHistoryIndex({
    players: ["p1", "p2"],
    samples: [{ t: 1_000, i: [0, 1], r: [10, 5] }],
  });

  expect(getRankDelta({ playerKey: "p1", rank: 3 }, history, 1_000 + 8 * 60 * 60, "8h"))
    .toEqual({ label: "+7", type: "up" });
  expect(getRankDelta({ playerKey: "p2", rank: 8 }, history, 1_000 + 8 * 60 * 60, "8h"))
    .toEqual({ label: "-3", type: "down" });
  expect(getRankDelta({ playerKey: "p3", rank: 1 }, history, 1_000 + 8 * 60 * 60, "8h"))
    .toEqual({ label: "new", type: "new" });
  expect(getRankDelta({ playerKey: "p1", rank: 1 }, history, 1_000 + 60, "8h"))
    .toEqual({ label: "—", type: "missing" });
});

test("treats players absent from the comparison sample as newly entered", () => {
  const history = createHistoryIndex({
    players: ["p1"],
    samples: [{ t: 1_000, i: [], r: [] }],
  });

  expect(getRankDelta({ playerKey: "p1", rank: 12 }, history, 1_000 + 8 * 60 * 60, "8h"))
    .toEqual({ label: "new", type: "new" });
});

test("uses the closest real sample on either side of the requested window", () => {
  const samples = [
    { t: 1_000 },
    { t: 2_000 },
    { t: 3_000 },
  ];

  expect(findHistorySample(samples, 3_000 + 8 * 60 * 60, "8h")).toEqual({ t: 3_000 });
  expect(findHistorySample(samples, 3_500 + 8 * 60 * 60, "8h")).toEqual({ t: 3_000 });
  expect(findHistorySample(samples, 900 + 8 * 60 * 60, "8h")).toEqual({ t: 1_000 });
});

test("reads existing samples through aliases without rewriting or preferring them over the stable key", () => {
  const data = {
    players: ["pstable", "pold"],
    samples: [
      { t: 1_000, i: [1], r: [20] },
      { t: 2_000, i: [0, 1], r: [12, 99] },
    ],
  };
  const history = createHistoryIndex(data);
  const player = { playerKey: "pstable", playerKeyAliases: ["pold"], rank: 10 };
  expect(getRankDelta(player, history, 1_000 + 8 * 60 * 60, "8h")).toEqual({ label: "+10", type: "up" });
  expect(getRankDelta(player, history, 2_000 + 8 * 60 * 60, "8h")).toEqual({ label: "+2", type: "up" });
  expect(data.samples[0]).toEqual({ t: 1_000, i: [1], r: [20] });
});
