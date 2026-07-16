import { createHistoryIndex, findHistorySample, getRankDelta } from "./history";

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

test("uses the nearest sample at or before the requested history window", () => {
  const samples = [
    { t: 1_000 },
    { t: 2_000 },
    { t: 3_000 },
  ];

  expect(findHistorySample(samples, 3_000 + 8 * 60 * 60, "8h")).toEqual({ t: 3_000 });
  expect(findHistorySample(samples, 3_500 + 8 * 60 * 60, "8h")).toEqual({ t: 3_000 });
  expect(findHistorySample(samples, 900 + 8 * 60 * 60, "8h")).toBeNull();
});
