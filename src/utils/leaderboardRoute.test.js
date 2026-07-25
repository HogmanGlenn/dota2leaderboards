import {
  createLeaderboardUrl,
  getCountryPath,
  getLeaderboardPath,
  parseLeaderboardPath,
} from "./leaderboardRoute";

test("creates readable region and country paths", () => {
  expect(getLeaderboardPath("americas")).toBe("/americas/");
  expect(getLeaderboardPath("europe", "finland")).toBe("/europe/finland/");
});

test.each([
  ["aland_islands", "aland-islands"],
  ["cote_d_ivoire", "cote-d-ivoire"],
  ["reunion", "reunion"],
  ["sao_tome_principe", "sao-tome-principe"],
])("normalizes country names with non-ASCII characters (%s)", (slug, path) => {
  expect(getCountryPath(slug)).toBe(path);
  expect(parseLeaderboardPath(`/europe/${path}/`)).toEqual({
    isHomepage: false,
    region: "europe",
    country: slug,
  });
});

test("rejects malformed country paths", () => {
  expect(parseLeaderboardPath("/europe/cote--d-ivoire/")).toBeNull();
  expect(parseLeaderboardPath("/europe/côte-d-ivoire/")).toBeNull();
});

test("serializes rank windows explicitly in permanent links", () => {
  expect(createLeaderboardUrl({
    region: "europe",
    country: "finland",
    pageSize: 25,
    pinnedOnly: false,
    historyWindow: "7d",
    sharedPinsParam: "",
  })).toBe("/europe/finland/?h=7d");
});
