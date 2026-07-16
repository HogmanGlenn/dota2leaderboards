import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import Flag from "./components/flag/Flag";
import Leaderboard from "./components/leaderboard/Leaderboard";
import { createPlayerKey } from "./utils/playerKey";
import { PIN_STORAGE_KEY } from "./utils/pins";
import { SAVED_SELECTIONS_KEY } from "./utils/savedSelections";

const payload = {
  time_posted: 1740996781,
  leaderboard: [
    { rank: 1, name: "Top Carry", team_id: 10, team_tag: "GG", country: "fi" },
    { rank: 2, name: "Mid Player", team_id: 11, team_tag: "Liquid", country: "se" },
  ],
};

function createPayload(size) {
  return {
    time_posted: 1740996781,
    leaderboard: Array.from({ length: size }, (_, index) => ({
      rank: index + 1,
      name: `Player ${index + 1}`,
      team_id: 100 + index,
      team_tag: "D2L",
      country: "fi",
    })),
  };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
  navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
});

afterEach(() => jest.restoreAllMocks());

test("loads and renders leaderboard data", async () => {
  render(<App />);

  expect(screen.getByRole("region", { name: "Player rankings" })).toHaveAttribute("aria-busy", "true");
  expect(await screen.findByText("Top Carry")).toBeInTheDocument();
  expect(screen.getByText("GG")).toBeInTheDocument();
  expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/data/europe/v0001.json"),
    expect.objectContaining({ signal: undefined })
  );
});

test("renders flags from the public SVG asset path", () => {
  render(<Flag countryCode="FI" />);

  const flag = document.querySelector(".flag-image");
  expect(flag).toBeInTheDocument();
  expect(flag).toHaveAttribute("src", expect.stringContaining("/flags/4x3/fi.svg"));
});

test("matches backend player key generation fixtures", () => {
  expect(createPlayerKey("europe", {
    name: "医者watson`",
    teamId: 9823272,
    countryCode: "KZ",
  })).toBe("p1o9lax3");
  expect(createPlayerKey("europe", {
    name: "  Player   One ",
    teamId: 42,
    countryCode: "FI",
  })).toBe("pge6p8b");
});

test("returns unknown paths to the homepage", async () => {
  window.history.replaceState({}, "", "/not-a-real-page");

  render(<App />);

  expect(window.location.pathname).toBe("/");
  expect(window.location.search).toBe("");
  expect(await screen.findByText("Top Carry")).toBeInTheDocument();
});

test("returns unknown query parameters to the homepage", async () => {
  window.history.replaceState({}, "", "/?not-a-filter=value");

  render(<App />);

  expect(window.location.pathname).toBe("/");
  expect(window.location.search).toBe("");
  expect(await screen.findByText("Top Carry")).toBeInTheDocument();
});

test("returns invalid query values to the homepage", async () => {
  window.history.replaceState({}, "", "/?region=moon&limit=none");

  render(<App />);

  expect(window.location.pathname).toBe("/");
  expect(window.location.search).toBe("");
  expect(await screen.findByText("Top Carry")).toBeInTheDocument();
});

test("returns an unknown country to the homepage after data loads", async () => {
  window.history.replaceState({}, "", "/?country=atlantis");

  render(<App />);

  expect(await screen.findByText("Top Carry")).toBeInTheDocument();
  await waitFor(() => expect(window.location.search).toBe(""));
  expect(window.location.pathname).toBe("/");
});

test("filters players by name or team", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.type(screen.getByLabelText("Player or team"), "liquid");

  await waitFor(() => expect(screen.queryByText("Top Carry")).not.toBeInTheDocument());
  expect(screen.getByText("Mid Player")).toBeInTheDocument();
});

test("clears the search field", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.type(screen.getByLabelText("Player or team"), "liquid");
  await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

  expect(screen.getByLabelText("Player or team")).toHaveValue("");
  expect(screen.getByText("Top Carry")).toBeInTheDocument();
});

test("clears typed country search text before a country is selected", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.type(screen.getByLabelText("Filter by country"), "fin");
  expect(screen.getByRole("button", { name: "Clear country search" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Clear country search" }));

  expect(screen.getByLabelText("Filter by country")).toHaveValue("");
});

test("stores the selected region in the query string", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByRole("button", { name: "Americas" }));

  await waitFor(() => expect(window.location.search).toBe("?region=americas"));
  await waitFor(() =>
    expect(screen.getByRole("region", { name: "Player rankings" })).toHaveAttribute("aria-busy", "false")
  );
  expect(window.location.hash).toBe("");
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/data/americas/v0001.json"),
    expect.any(Object)
  );
});

test("keeps the browser title stable when region changes", async () => {
  document.title = "Dota 2 Leaderboards";
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByRole("button", { name: "Americas" }));

  await waitFor(() => expect(window.location.search).toBe("?region=americas"));
  expect(document.title).toBe("Dota 2 Leaderboards");
});

test("keeps country, search, and visible row count when changing region", async () => {
  window.history.replaceState({}, "", "/?country=finland&limit=50");
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");

  await userEvent.type(screen.getByLabelText("Player or team"), "Player 2");
  await userEvent.click(screen.getByRole("button", { name: "Americas" }));

  await waitFor(() => expect(window.location.search).toBe("?region=americas&country=finland&limit=50"));
  expect(screen.getByLabelText("Player or team")).toHaveValue("Player 2");
  expect(screen.getByLabelText("Visible rows")).toHaveTextContent("50");
});

test("keeps existing country rows visible while a new region loads", async () => {
  window.history.replaceState({}, "", "/?country=finland");
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createPayload(30),
    })
    .mockReturnValueOnce(new Promise(() => {}));

  render(<App />);
  await screen.findByText("Player 1");

  await userEvent.click(screen.getByRole("button", { name: "Americas" }));

  await waitFor(() => expect(window.location.search).toBe("?region=americas&country=finland"));
  expect(screen.getByText("Player 1")).toBeInTheDocument();
  expect(document.querySelector(".MuiSkeleton-root")).not.toBeInTheDocument();
});

test("clicking the title resets the route", async () => {
  window.history.replaceState({}, "", "/?region=china&country=finland&limit=50");
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByRole("button", { name: "Dota 2 Leaderboards" }));

  await waitFor(() => expect(window.location.search).toBe(""));
  await waitFor(() =>
    expect(screen.getByRole("region", { name: "Player rankings" })).toHaveAttribute("aria-busy", "false")
  );
});

test("changes how many rows are visible", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");

  const rowsSelect = screen.getByLabelText("Visible rows");

  await userEvent.click(rowsSelect);
  expect(await screen.findByRole("option", { name: "60" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "50" }));

  await waitFor(() => expect(window.location.search).toBe("?limit=50"));
  expect(document.querySelectorAll("[data-player-row='true']")).toHaveLength(50);
  expect(screen.getByText("Player 50")).toBeInTheDocument();
});

test("shows relative and overall rank for country-filtered views", () => {
  render(
    <Leaderboard
      players={[
        { rank: 10, name: "Country One", teamTag: "", teamId: 1, countryCode: "FI" },
        { rank: 25, name: "Country Two", teamTag: "", teamId: 2, countryCode: "FI" },
      ]}
      rowsPerPage={25}
      showRelativeRank
      isLoading={false}
      updatedAt={1740996781}
      error=""
      onRetry={() => {}}
      hasFilters
    />
  );

  expect(screen.getByText("10")).toBeInTheDocument();
  expect(screen.getByText("25")).toBeInTheDocument();
});

test("drags and changes leaderboard pages with horizontal swipes", async () => {
  const players = Array.from({ length: 30 }, (_, index) => ({
    rank: index + 1,
    name: `Swipe Player ${index + 1}`,
    teamTag: "D2L",
    teamId: 100 + index,
    countryCode: "FI",
  }));

  render(
    <Leaderboard
      players={players}
      rowsPerPage={10}
      effectiveRowsPerPage={10}
      showRelativeRank={false}
      isLoading={false}
      updatedAt={1740996781}
      error=""
      onRetry={() => {}}
      hasFilters={false}
    />
  );

  const body = screen.getByTestId("leaderboard-body");
  jest.spyOn(body, "getBoundingClientRect").mockReturnValue({
    bottom: 360,
    height: 360,
    left: 0,
    right: 300,
    top: 0,
    width: 300,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  fireEvent.touchStart(body, { touches: [{ clientX: 280, clientY: 120 }] });
  fireEvent.touchMove(body, { touches: [{ clientX: 100, clientY: 125 }] });

  expect(body).toHaveStyle({ transform: "translate3d(-180px, 0, 0)" });

  fireEvent.touchEnd(body, { changedTouches: [{ clientX: 100, clientY: 125 }] });
  expect(body).toHaveClass("leaderboard-body--outgoing");
  expect(body).toHaveStyle({ transform: "translate3d(-300px, 0, 0)" });

  fireEvent.transitionEnd(body);

  expect(screen.getByText("Page 2")).toBeInTheDocument();
  expect(screen.getByText("Swipe Player 11")).toBeInTheDocument();
  await waitFor(() => expect(body).toHaveClass("leaderboard-body--incoming"));
  fireEvent.transitionEnd(body);

  fireEvent.touchStart(body, { touches: [{ clientX: 100, clientY: 120 }] });
  fireEvent.touchMove(body, { touches: [{ clientX: 280, clientY: 125 }] });
  expect(body).toHaveStyle({ transform: "translate3d(180px, 0, 0)" });

  fireEvent.touchEnd(body, { changedTouches: [{ clientX: 280, clientY: 125 }] });
  fireEvent.transitionEnd(body);

  expect(screen.getByText("Page 1")).toBeInTheDocument();
  expect(screen.getByText("Swipe Player 1")).toBeInTheDocument();
  await waitFor(() => expect(body).toHaveClass("leaderboard-body--incoming"));
  fireEvent.transitionEnd(body);
  expect(body).toHaveClass("leaderboard-body--idle");
});

test("leaves missing countries empty", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      time_posted: 1740996781,
      leaderboard: [{ rank: 1, name: "No Country", team_id: 10, team_tag: "NC" }],
    }),
  });

  render(<App />);

  expect(await screen.findByText("No Country")).toBeInTheDocument();
  expect(screen.queryByText("Unlisted")).not.toBeInTheDocument();
});

test("shows a retry action when loading fails", async () => {
  global.fetch.mockRejectedValueOnce(new Error("Network unavailable"));
  render(<App />);

  expect(await screen.findByText(/couldn't load this leaderboard/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
});

test("reveals advanced options", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByRole("button", { name: "More options" }));

  expect(screen.getByLabelText("Filter pinned")).toBeInTheDocument();
  expect(screen.getByLabelText("Show rank change")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /copy shareable link/i })).toBeInTheDocument();
});

test("clicking a player toggles a local pin and pinned-only filtering", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByText("Top Carry"));
  expect(JSON.parse(window.localStorage.getItem(PIN_STORAGE_KEY))).toHaveLength(1);

  await userEvent.click(screen.getByRole("button", { name: "More options" }));
  await userEvent.click(screen.getByLabelText("Filter pinned"));

  await waitFor(() => expect(screen.queryByText("Mid Player")).not.toBeInTheDocument());
  expect(screen.getByText("Top Carry")).toBeInTheDocument();
});

test("shared pins restore pinned-only views without overwriting local pins", async () => {
  const sharedKey = createPlayerKey("europe", {
    name: "Top Carry",
    teamId: 10,
    countryCode: "FI",
  });
  window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([{
    region: "europe",
    playerKey: "pexisting",
    name: "Existing",
    teamTag: "",
    countryCode: "",
    rank: 99,
  }]));
  window.history.replaceState({}, "", `/?p=1&pins=europe.${sharedKey}`);

  render(<App />);

  expect(await screen.findByText("Top Carry")).toBeInTheDocument();
  expect(screen.queryByText("Mid Player")).not.toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(PIN_STORAGE_KEY))[0].playerKey).toBe("pexisting");
});

test("shared pins are dropped when leaving the shared pinned view", async () => {
  const sharedKey = createPlayerKey("europe", {
    name: "Top Carry",
    teamId: 10,
    countryCode: "FI",
  });
  window.history.replaceState({}, "", `/?p=1&pins=europe.${sharedKey}`);

  render(<App />);
  expect(await screen.findByText("Top Carry")).toBeInTheDocument();
  expect(screen.queryByText("Mid Player")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "More options" }));
  await userEvent.click(screen.getByLabelText("Filter pinned"));

  await waitFor(() => expect(window.location.search).not.toContain("pins="));
  expect(screen.getByText("Mid Player")).toBeInTheDocument();
});

test("saves the current selection with a user name", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByText("Top Carry"));
  await userEvent.click(screen.getByRole("button", { name: "More options" }));
  await userEvent.type(screen.getByLabelText("Selection name"), "My carries");
  await userEvent.click(screen.getByRole("button", { name: /save/i }));

  const saved = JSON.parse(window.localStorage.getItem(SAVED_SELECTIONS_KEY));
  expect(saved[0].name).toBe("My carries");
  expect(saved[0].pins).toHaveLength(1);
  await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toHaveClass("save-selection--saved"));
});

test("rank history loads lazily and renders deltas", async () => {
  const topCarryKey = createPlayerKey("europe", {
    name: "Top Carry",
    teamId: 10,
    countryCode: "FI",
  });
  const historyPayload = {
    version: 1,
    interval_hours: 8,
    retention_days: 30,
    players: [topCarryKey],
    samples: [{
      t: payload.time_posted - 8 * 60 * 60,
      i: [0],
      r: [5],
    }],
  };
  global.fetch = jest.fn((url) => Promise.resolve({
    ok: true,
    status: 200,
    json: async () => (String(url).includes("history.v0001.json") ? historyPayload : payload),
  }));

  render(<App />);
  await screen.findByText("Top Carry");

  expect(fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("history.v0001.json"),
    expect.any(Object)
  );

  await userEvent.click(screen.getByRole("button", { name: "More options" }));
  await userEvent.click(screen.getByLabelText("Show rank change"));
  await userEvent.click(screen.getByRole("option", { name: "8 hours" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/data/europe/history.v0001.json"),
    expect.any(Object)
  ));
  expect(await screen.findAllByText("+4")).toHaveLength(1);
});

test("does not show stale rank deltas while switching regions", async () => {
  const topCarryKey = createPlayerKey("europe", {
    name: "Top Carry",
    teamId: 10,
    countryCode: "FI",
  });
  const americasPlayerKey = createPlayerKey("americas", {
    name: "Americas Player",
    teamId: 20,
    countryCode: "US",
  });
  const europeHistory = {
    version: 1,
    interval_hours: 8,
    retention_days: 30,
    players: [topCarryKey],
    samples: [{
      t: payload.time_posted - 8 * 60 * 60,
      i: [0],
      r: [5],
    }],
  };
  let resolveAmericas;
  const americasRequest = new Promise((resolve) => {
    resolveAmericas = resolve;
  });
  let resolveAmericasHistory;
  const americasHistoryRequest = new Promise((resolve) => {
    resolveAmericasHistory = resolve;
  });
  const americasPayload = {
    time_posted: payload.time_posted,
    leaderboard: [{ rank: 1, name: "Americas Player", team_id: 20, team_tag: "AM", country: "us" }],
  };
  const americasHistory = {
    version: 1,
    interval_hours: 8,
    retention_days: 30,
    players: [americasPlayerKey],
    samples: [{
      t: payload.time_posted - 8 * 60 * 60,
      i: [0],
      r: [7],
    }],
  };

  global.fetch = jest.fn((url) => {
    const href = String(url);
    if (href.includes("/data/europe/history.v0001.json")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => europeHistory });
    }
    if (href.includes("/data/americas/v0001.json")) return americasRequest;
    if (href.includes("/data/americas/history.v0001.json")) return americasHistoryRequest;
    return Promise.resolve({ ok: true, status: 200, json: async () => payload });
  });

  window.history.replaceState({}, "", "/?h=8h");
  render(<App />);
  expect(await screen.findAllByText("+4")).toHaveLength(1);

  await userEvent.click(screen.getByRole("button", { name: "Americas" }));

  expect(screen.getByText("+4")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Player rankings" })).toHaveClass("leaderboard-card--history");

  resolveAmericas({
    ok: true,
    status: 200,
    json: async () => americasPayload,
  });
  expect(await screen.findByText("Americas Player")).toBeInTheDocument();
  expect(screen.queryByText("+4")).not.toBeInTheDocument();

  resolveAmericasHistory({
    ok: true,
    status: 200,
    json: async () => americasHistory,
  });
  expect(await screen.findByText("+6")).toBeInTheDocument();
});

test("share copies a compact personalized link", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByText("Top Carry"));
  await userEvent.click(screen.getByRole("button", { name: "More options" }));
  await userEvent.click(screen.getByRole("button", { name: /copy shareable link/i }));

  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    expect.stringContaining("pins=europe.")
  ));
  await waitFor(() => expect(screen.getByRole("button", { name: /copy shareable link/i })).toHaveAttribute("title", "Copied"));
});
