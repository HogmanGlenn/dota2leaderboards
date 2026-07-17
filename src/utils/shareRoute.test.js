import { parseCompactShareRoute, serializeCompactShareRoute } from "./shareRoute";

test("round trips a compact share route", () => {
  const route = {
    region: "americas",
    country: "united_states",
    pageSize: 250,
    pinnedOnly: true,
    historyWindow: "24h",
  };
  const pins = [
    { region: "europe", playerKey: "p123abc" },
    { region: "europe", playerKey: "p456def" },
    { region: "americas", playerKey: "p789ghi" },
  ];

  const compact = serializeCompactShareRoute(route, pins, "US");

  expect(compact).toBe("1a.us.6y.5.e123abc,456def~a789ghi");
  expect(parseCompactShareRoute(compact)).toEqual({
    ...route,
    sharedPinsParam: "europe.p123abc,p456def~americas.p789ghi",
  });
});

test("omits the compact payload for the default unpinned view", () => {
  expect(serializeCompactShareRoute({
    region: "europe",
    country: "all",
    pageSize: 25,
    pinnedOnly: false,
    historyWindow: "off",
  })).toBe("");
});

test("falls back to a validated country slug when no country code is available", () => {
  const compact = serializeCompactShareRoute({
    region: "europe",
    country: "aland_islands",
    pageSize: 25,
    pinnedOnly: false,
    historyWindow: "off",
  });

  expect(compact).toBe("1e._aland_islands");
  expect(parseCompactShareRoute(compact).country).toBe("aland_islands");
});

test.each([
  "",
  "2e",
  "1x",
  "1e.not_a_country",
  "1e..not-base36!",
  "1e...z",
  "1e....x123",
  "1e....e",
])("rejects invalid compact share payload %p", (value) => {
  expect(parseCompactShareRoute(value)).toBeNull();
});
