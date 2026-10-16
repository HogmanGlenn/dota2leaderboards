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

test("keeps version-1 custom-link settings and maximum cross-region pin payloads compatible", () => {
  const regions = [["europe", "e"], ["americas", "a"], ["china", "c"], ["se_asia", "s"]];
  const countries = [["all", "", ""], ["finland", "fi", "FI"], ["aland_islands", "_aland_islands", ""]];
  const pins = Array.from({ length: 50 }, (_, index) => ({
    region: regions[index % regions.length][0], playerKey: `plegacy${index.toString(36)}`,
  }));
  const compactGroups = regions.map(([region, code]) => (
    `${code}${pins.filter((pin) => pin.region === region).map((pin) => pin.playerKey.slice(1)).join(",")}`
  )).join("~");
  const sharedPinsParam = regions.map(([region]) => (
    `${region}.${pins.filter((pin) => pin.region === region).map((pin) => pin.playerKey).join(",")}`
  )).join("~");

  for (const [region, code] of regions) {
    for (const [country, countryToken, countryCode] of countries) {
      for (const pageSize of [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]) {
        ["off", "8h", "24h", "7d", "30d"].forEach((historyWindow, historyIndex) => {
          for (const pinnedOnly of [false, true]) {
            const state = historyIndex * 2 + Number(pinnedOnly);
            const legacyPayload = `1${code}.${countryToken}.${pageSize === 25 ? "" : pageSize.toString(36)}.${state ? state.toString(36) : ""}.${compactGroups}`;
            const route = { region, country, pageSize, historyWindow, pinnedOnly };
            expect(parseCompactShareRoute(legacyPayload)).toEqual({ ...route, sharedPinsParam });
            expect(serializeCompactShareRoute(route, pins, countryCode)).toBe(legacyPayload);
          }
        });
      }
    }
  }
});
