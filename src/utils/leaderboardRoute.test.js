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

test("paginated region and country paths round-trip without changing legacy first-page URLs", () => {
  expect(getLeaderboardPath("europe", "all", 2)).toBe("/europe/page/2/");
  expect(getLeaderboardPath("europe", "finland", 3)).toBe("/europe/finland/page/3/");
  expect(parseLeaderboardPath("/europe/finland/page/3/")).toMatchObject({ region: "europe", country: "finland", page: 3 });
  expect(createLeaderboardUrl({ region: "europe", country: "all", page: 2, pageSize: 25, historyWindow: "off" })).toBe("/europe/page/2/");
});

test.each(["/europe/page/0/", "/europe/page/1/", "/europe/page/02/", "/europe/page/-2/", "/europe/page/9007199254740992/", "/europe/finland/page/3/extra/"])("rejects malformed pagination %s", (url) => {
  expect(parseLeaderboardPath(url)).toBeNull();
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
