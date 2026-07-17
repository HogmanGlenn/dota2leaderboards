import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react-dom/test-utils";
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

function getPageIndicator(page) {
  return screen.getByText((_, element) => (
    element.classList.contains("page-indicator")
      && element.textContent.startsWith(`Page ${page} of `)
  ));
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 768 });
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
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

test("rejects compact share links mixed with verbose route parameters", async () => {
  window.history.replaceState({}, "", "/?s=1a&limit=50");

  render(<App />);

  expect(await screen.findByText("Top Carry")).toBeInTheDocument();
  expect(window.location.search).toBe("");
  expect(screen.getByRole("button", { name: "Europe" })).toHaveAttribute("aria-pressed", "true");
});

test("clicking the title keeps rank change visibility", async () => {
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
  window.history.replaceState({}, "", "/?region=china&country=finland&limit=50&h=8h");

  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByRole("button", { name: "Dota 2 Leaderboards" }));

  await waitFor(() => expect(window.location.search).toBe("?h=8h"));
  expect(screen.getByRole("region", { name: "Player rankings" })).toHaveClass("leaderboard-card--history");
  expect(await screen.findAllByText("+4")).toHaveLength(1);
});

test("clicking the title returns the leaderboard to page one", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");

  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(getPageIndicator(2)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Dota 2 Leaderboards" }));

  await waitFor(() => expect(getPageIndicator(1)).toBeInTheDocument());
  expect(screen.getByText("Player 1")).toBeInTheDocument();
});

test("lets normal last pages shrink when fewer players remain", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");
  expect(document.querySelector(".page-indicator")).toHaveTextContent("Page 1 of 3");

  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  await userEvent.click(screen.getByRole("button", { name: "Next page" }));

  expect(getPageIndicator(3)).toBeInTheDocument();
  expect(document.querySelector(".page-indicator")).toHaveTextContent("Page 3 of 3");
  expect(document.querySelectorAll("[data-player-row='true']")).toHaveLength(10);
  expect(screen.getByText("Player 51")).toBeInTheDocument();
  expect(screen.getByText("Player 60")).toBeInTheDocument();
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

test("renders the full selected page for common show sizes", () => {
  const players = Array.from({ length: 300 }, (_, index) => ({
    rank: index + 1,
    name: `Dense Player ${index + 1}`,
    teamTag: "D2L",
    teamId: 5000 + index,
    countryCode: "FI",
    playerKey: `dense-${index}`,
  }));

  render(
    <Leaderboard
      players={players}
      rowsPerPage={250}
      effectiveRowsPerPage={250}
      showRelativeRank={false}
      isLoading={false}
      updatedAt={1740996781}
      error=""
      onRetry={() => {}}
      hasFilters={false}
    />
  );

  expect(document.querySelectorAll("[data-player-row='true']")).toHaveLength(250);
  expect(screen.getByText("Dense Player 250")).toBeInTheDocument();
});

test("native find keeps show and player area height unchanged while jumping pages", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");
  const body = screen.getByTestId("leaderboard-body");
  const initialHeight = body.style.height;

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 480 });
  fireEvent.resize(window);
  const findIndex = await screen.findByTestId("leaderboard-find-index");
  expect(screen.getByRole("region", { name: "Player rankings" })).not.toContainElement(findIndex);
  expect(findIndex).toHaveTextContent("Player 60");
  const target = Array.from(findIndex.querySelectorAll("[data-leaderboard-find-target]"))
    .find((element) => element.textContent.includes("Player 60"));
  const queryStart = target.textContent.indexOf("Player 60");

  const range = document.createRange();
  range.setStart(target.firstChild, queryStart);
  range.setEnd(target.firstChild, queryStart + "Player 60".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  fireEvent(document, new Event("selectionchange"));

  expect(getPageIndicator(1)).toBeInTheDocument();
  await waitFor(() => expect(getPageIndicator(3)).toBeInTheDocument());
  expect(window.location.search).toBe("");
  expect(screen.getByLabelText("Visible rows")).toHaveTextContent("25");
  expect(body.style.height).toBe(initialHeight);
  expect(document.querySelectorAll("[data-player-row='true']")).toHaveLength(25);
  expect(screen.getByText("Player 36")).toBeInTheDocument();
  await waitFor(() => {
    const playerRow = Array.from(document.querySelectorAll("[data-player-row='true']"))
      .find((row) => row.textContent.includes("Player 60"));

    expect(playerRow).toHaveClass("leaderboard-row--find-target");
    expect(document.activeElement).toBe(playerRow);
  });
});

test("escape closes the hidden native find index", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  expect(await screen.findByTestId("leaderboard-find-index")).toHaveTextContent("Player 60");

  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() => expect(screen.queryByTestId("leaderboard-find-index")).not.toBeInTheDocument());

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  expect(await screen.findByTestId("leaderboard-find-index")).toHaveTextContent("Player 60");
});

test("clicking the page closes native find and cancels a pending jump", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  const findIndex = await screen.findByTestId("leaderboard-find-index");
  const target = Array.from(findIndex.querySelectorAll("[data-leaderboard-find-target]"))
    .find((element) => element.textContent.includes("Player 60"));
  const queryStart = target.textContent.indexOf("Player 60");
  const range = document.createRange();
  range.setStart(target.firstChild, queryStart);
  range.setEnd(target.firstChild, queryStart + "Player 60".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  fireEvent(document, new Event("selectionchange"));

  fireEvent.pointerDown(document.body);

  await waitFor(() => expect(screen.queryByTestId("leaderboard-find-index")).not.toBeInTheDocument());
  await new Promise((resolve) => window.setTimeout(resolve, 220));
  expect(getPageIndicator(1)).toBeInTheDocument();
  expect(screen.queryByText("Player 60")).not.toBeInTheDocument();
});

test("closing native find clears the active find jump before pagination", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(90),
  });

  render(<App />);
  await screen.findByText("Player 25");

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  const findIndex = await screen.findByTestId("leaderboard-find-index");
  const target = Array.from(findIndex.querySelectorAll("[data-leaderboard-find-target]"))
    .find((element) => element.textContent.includes("Player 60"));
  const queryStart = target.textContent.indexOf("Player 60");
  const range = document.createRange();
  range.setStart(target.firstChild, queryStart);
  range.setEnd(target.firstChild, queryStart + "Player 60".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  fireEvent(document, new Event("selectionchange"));

  await waitFor(() => expect(getPageIndicator(3)).toBeInTheDocument());
  expect(screen.getByText("Player 60")).toBeInTheDocument();

  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() => expect(screen.queryByTestId("leaderboard-find-index")).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "Next page" }));

  expect(getPageIndicator(4)).toBeInTheDocument();
  expect(screen.queryByText("Player 60")).not.toBeInTheDocument();
  expect(screen.getByText("Player 76")).toBeInTheDocument();
});

test("pagination clears a stale native find jump even without escape", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(90),
  });

  render(<App />);
  await screen.findByText("Player 25");

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  const findIndex = await screen.findByTestId("leaderboard-find-index");
  const target = Array.from(findIndex.querySelectorAll("[data-leaderboard-find-target]"))
    .find((element) => element.textContent.includes("Player 60"));
  const queryStart = target.textContent.indexOf("Player 60");
  const range = document.createRange();
  range.setStart(target.firstChild, queryStart);
  range.setEnd(target.firstChild, queryStart + "Player 60".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  fireEvent(document, new Event("selectionchange"));

  await waitFor(() => expect(getPageIndicator(3)).toBeInTheDocument());
  expect(screen.getByText("Player 60")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Next page" }));

  expect(getPageIndicator(4)).toBeInTheDocument();
  expect(screen.queryByText("Player 60")).not.toBeInTheDocument();
  expect(screen.getByText("Player 76")).toBeInTheDocument();
  expect(screen.queryByTestId("leaderboard-find-index")).not.toBeInTheDocument();
});

test("partial native find keeps the selected page fully populated", async () => {
  const players = Array.from({ length: 120 }, (_, index) => ({
    rank: index + 1,
    name: index === 59 ? "Glete" : `Player ${index + 1}`,
    team_id: 100 + index,
    team_tag: "D2L",
    country: "fi",
  }));
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      time_posted: 1740996781,
      leaderboard: players,
    }),
  });

  render(<App />);
  await screen.findByText("Player 25");
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 120 });
  fireEvent.resize(window);
  Object.defineProperty(window, "scrollY", { configurable: true, value: 1000 });
  fireEvent.scroll(window);

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  const findIndex = await screen.findByTestId("leaderboard-find-index");
  const target = Array.from(findIndex.querySelectorAll("[data-leaderboard-find-target]"))
    .find((element) => element.textContent.includes("Glete"));
  const queryStart = target.textContent.toLocaleLowerCase().indexOf("gl");
  const range = document.createRange();
  range.setStart(target.firstChild, queryStart);
  range.setEnd(target.firstChild, queryStart + "gl".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  fireEvent(document, new Event("selectionchange"));

  await waitFor(() => expect(getPageIndicator(3)).toBeInTheDocument());
  const playerRows = Array.from(document.querySelectorAll("[data-player-row='true']"));

  expect(playerRows).toHaveLength(25);
  expect(playerRows[0]).toHaveTextContent("Player 50");
  expect(playerRows[0]).toHaveStyle("transform: translateY(0px)");
  expect(playerRows[24].style.transform).toBe("translateY(432px)");
  expect(screen.getByText("Glete")).toBeInTheDocument();
});

test("native find keeps next-match order stable with large show sizes", async () => {
  const players = Array.from({ length: 700 }, (_, index) => ({
    rank: index + 1,
    name: `Player ${index + 1}`,
    team_id: 1000 + index,
    team_tag: "D2L",
    country: "fi",
  }));
  players[299] = { ...players[299], name: "Gle First" };
  players[519] = { ...players[519], name: "Gle Second" };
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      time_posted: 1740996781,
      leaderboard: players,
    }),
  });

  render(<App />);
  await screen.findByText("Player 25");
  await userEvent.click(screen.getByLabelText("Visible rows"));
  await userEvent.click(screen.getByRole("option", { name: "250" }));
  await waitFor(() => expect(document.querySelectorAll("[data-player-row='true']")).toHaveLength(250));

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  const findIndex = await screen.findByTestId("leaderboard-find-index");
  const indexRows = Array.from(findIndex.querySelectorAll("[data-leaderboard-find-target]"));
  expect(indexRows).toHaveLength(450);

  const firstTarget = indexRows.find((element) => element.textContent.includes("Gle First"));
  const firstQueryStart = firstTarget.textContent.toLocaleLowerCase().indexOf("gle");
  const firstRange = document.createRange();
  firstRange.setStart(firstTarget.firstChild, firstQueryStart);
  firstRange.setEnd(firstTarget.firstChild, firstQueryStart + "gle".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(firstRange);
  fireEvent(document, new Event("selectionchange"));

  await waitFor(() => expect(getPageIndicator(2)).toBeInTheDocument());
  expect(screen.getByText("Gle First")).toBeInTheDocument();
  expect(screen.getByTestId("leaderboard-find-index")).toBe(findIndex);
  expect(findIndex.querySelectorAll("[data-leaderboard-find-target]")).toHaveLength(450);

  const secondTarget = indexRows.find((element) => element.textContent.includes("Gle Second"));
  const secondQueryStart = secondTarget.textContent.toLocaleLowerCase().indexOf("gle");
  const secondRange = document.createRange();
  secondRange.setStart(secondTarget.firstChild, secondQueryStart);
  secondRange.setEnd(secondTarget.firstChild, secondQueryStart + "gle".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(secondRange);
  fireEvent(document, new Event("selectionchange"));

  await waitFor(() => expect(getPageIndicator(3)).toBeInTheDocument());
  expect(screen.getByText("Gle Second")).toBeInTheDocument();
  expect(findIndex.querySelectorAll("[data-leaderboard-find-target]")).toHaveLength(450);
});

test("native find uses the committed rows immediately after reducing show size", async () => {
  const players = Array.from({ length: 300 }, (_, index) => ({
    countryCode: "FI",
    findKey: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    playerKey: `player-${index + 1}`,
    rank: index + 1,
    teamId: 1000 + index,
    teamTag: "D2L",
  }));

  const renderLeaderboard = (rowsPerPage) => (
    <Leaderboard
      players={players}
      findIndexPlayers={players}
      rowsPerPage={rowsPerPage}
      effectiveRowsPerPage={rowsPerPage}
      showRelativeRank={false}
      isLoading={false}
      updatedAt={1740996781}
      error=""
      onRetry={() => {}}
      hasFilters={false}
    />
  );

  const { rerender } = render(renderLeaderboard(250));
  expect(document.querySelectorAll("[data-player-row='true']")).toHaveLength(250);

  rerender(renderLeaderboard(25));
  expect(document.querySelectorAll("[data-player-row='true']")).toHaveLength(25);
  fireEvent.keyDown(window, { key: "f", ctrlKey: true });

  const findIndex = await screen.findByTestId("leaderboard-find-index");
  expect(findIndex.querySelectorAll("[data-leaderboard-find-target]")).toHaveLength(275);
  expect(findIndex).toHaveTextContent("Player 100");
});

test("native find distinguishes duplicate stable player identities", async () => {
  const duplicatePayload = createPayload(90);
  duplicatePayload.leaderboard[29] = {
    rank: 30,
    name: "Same Player",
    team_id: 777,
    team_tag: "D2L",
    country: "fi",
  };
  duplicatePayload.leaderboard[59] = {
    rank: 60,
    name: "Same Player",
    team_id: 777,
    team_tag: "D2L",
    country: "fi",
  };
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => duplicatePayload,
  });

  render(<App />);
  await screen.findByText("Player 25");

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  const findIndex = await screen.findByTestId("leaderboard-find-index");
  const matches = Array.from(findIndex.querySelectorAll("[data-leaderboard-find-target]"))
    .filter((element) => element.textContent.includes("Same Player"));
  expect(matches).toHaveLength(2);
  expect(matches[0].dataset.findKey).not.toBe(matches[1].dataset.findKey);

  const secondMatch = matches[1];
  const queryStart = secondMatch.textContent.indexOf("Same Player");
  const range = document.createRange();
  range.setStart(secondMatch.firstChild, queryStart);
  range.setEnd(secondMatch.firstChild, queryStart + "Same Player".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  fireEvent(document, new Event("selectionchange"));

  await waitFor(() => expect(getPageIndicator(3)).toBeInTheDocument());
  const selectedRow = document.querySelector(
    `[data-player-row="true"][data-find-key="${secondMatch.dataset.findKey}"]`
  );
  expect(selectedRow).toHaveClass("leaderboard-row--find-target");
  expect(selectedRow).toHaveTextContent("60");
});

test("clicking the title clears a stale native find jump", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");

  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  const findIndex = await screen.findByTestId("leaderboard-find-index");
  const target = Array.from(findIndex.querySelectorAll("[data-leaderboard-find-target]"))
    .find((element) => element.textContent.includes("Player 60"));
  const queryStart = target.textContent.indexOf("Player 60");
  const range = document.createRange();
  range.setStart(target.firstChild, queryStart);
  range.setEnd(target.firstChild, queryStart + "Player 60".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  fireEvent(document, new Event("selectionchange"));

  await waitFor(() => expect(getPageIndicator(3)).toBeInTheDocument());
  expect(screen.getByText("Player 60")).toBeInTheDocument();

  window.getSelection().removeAllRanges();
  await userEvent.click(screen.getByRole("button", { name: "Dota 2 Leaderboards" }));

  await waitFor(() => expect(getPageIndicator(1)).toBeInTheDocument());
  expect(screen.getByText("Player 1")).toBeInTheDocument();
  expect(screen.queryByText("Player 60")).not.toBeInTheDocument();

  const nextFindIndex = await screen.findByTestId("leaderboard-find-index");
  const nextTarget = Array.from(nextFindIndex.querySelectorAll("[data-leaderboard-find-target]"))
    .find((element) => element.textContent.includes("Player 60"));
  const nextQueryStart = nextTarget.textContent.indexOf("Player 60");
  const nextRange = document.createRange();
  nextRange.setStart(nextTarget.firstChild, nextQueryStart);
  nextRange.setEnd(nextTarget.firstChild, nextQueryStart + "Player 60".length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(nextRange);
  fireEvent(document, new Event("selectionchange"));

  await waitFor(() => expect(getPageIndicator(3)).toBeInTheDocument());
  expect(screen.getByText("Player 60")).toBeInTheDocument();
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

test("native find windows align to displayed rank buckets with duplicate ranks", async () => {
  const leadingPlayers = Array.from({ length: 1595 }, (_, index) => ({
    rank: index + 1,
    name: `Leading Player ${index + 1}`,
    teamTag: "D2L",
    teamId: 1000 + index,
    countryCode: "FI",
    playerKey: `leading-${index}`,
  }));
  const bucketRanks = [
    1596, 1597, 1598, 1599, 1600, 1601, 1602, 1602, 1604, 1604,
    1604, 1607, 1608, 1609, 1610, 1610, 1610, 1613, 1614, 1615,
    1616, 1617, 1618, 1619, 1620, 1621, 1622, 1623, 1623, 1625,
    1626, 1626, 1628,
  ];
  const bucketPlayers = bucketRanks.map((rank, index) => ({
    rank,
    name: rank === 1615 ? "Glete" : `Rank ${rank} Player ${index}`,
    teamTag: "D2L",
    teamId: 3000 + index,
    countryCode: "FI",
    playerKey: `bucket-${index}`,
  }));
  const players = [...leadingPlayers, ...bucketPlayers];
  const glete = players.find((player) => player.name === "Glete");

  render(
    <Leaderboard
      players={players}
      findJump={{ findKey: glete.playerKey }}
      rowsPerPage={25}
      effectiveRowsPerPage={25}
      showRelativeRank={false}
      isLoading={false}
      updatedAt={1740996781}
      error=""
      onRetry={() => {}}
      hasFilters={false}
    />
  );

  await waitFor(() => expect(screen.getByText("Glete")).toBeInTheDocument());
  const playerRows = Array.from(document.querySelectorAll("[data-player-row='true']"));

  expect(playerRows).toHaveLength(25);
  expect(playerRows[0]).toHaveTextContent("1600");
  expect(playerRows[0]).not.toHaveTextContent("1599");
  expect(document.activeElement).toHaveTextContent("Glete");
});

test("native find uses rank buckets for first-row page boundaries", async () => {
  const players = Array.from({ length: 1625 }, (_, index) => ({
    rank: index + 1,
    name: `Boundary Rank Player ${index + 1}`,
    teamTag: "D2L",
    teamId: 4000 + index,
    countryCode: "FI",
    playerKey: `rank-boundary-${index}`,
  }));
  players[1598] = {
    ...players[1598],
    rank: 1598,
    name: "Rank 1598 Duplicate",
  };
  players[1599] = {
    ...players[1599],
    rank: 1600,
    name: "therealsad-",
  };

  render(
    <Leaderboard
      players={players}
      findJump={{ findKey: players[1599].playerKey }}
      rowsPerPage={25}
      effectiveRowsPerPage={25}
      showRelativeRank={false}
      isLoading={false}
      updatedAt={1740996781}
      error=""
      onRetry={() => {}}
      hasFilters={false}
    />
  );

  await waitFor(() => expect(getPageIndicator(65)).toBeInTheDocument());
  const playerRows = Array.from(document.querySelectorAll("[data-player-row='true']"));

  expect(playerRows).toHaveLength(25);
  expect(playerRows[0]).toHaveTextContent("therealsad-");
  expect(playerRows[0]).toHaveTextContent(/1\s?600/);
  expect(document.activeElement).toHaveTextContent("therealsad-");
});

test("native find does not shift a visible exact page-boundary rank", async () => {
  const players = Array.from({ length: 50 }, (_, index) => ({
    rank: index + 1,
    name: `Boundary Player ${index + 1}`,
    teamTag: "D2L",
    teamId: 2000 + index,
    countryCode: "FI",
    playerKey: `boundary-${index}`,
  }));

  render(
    <Leaderboard
      players={players}
      findJump={{ findKey: players[24].playerKey }}
      rowsPerPage={25}
      effectiveRowsPerPage={25}
      showRelativeRank={false}
      isLoading={false}
      updatedAt={1740996781}
      error=""
      onRetry={() => {}}
      hasFilters={false}
    />
  );

  await waitFor(() => expect(document.activeElement).toHaveTextContent("Boundary Player 25"));
  const playerRows = Array.from(document.querySelectorAll("[data-player-row='true']"));

  expect(playerRows[0]).toHaveTextContent("Boundary Player 1");
  expect(playerRows[24]).toHaveTextContent("Boundary Player 25");
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

  expect(getPageIndicator(2)).toBeInTheDocument();
  expect(screen.getByText("Swipe Player 11")).toBeInTheDocument();
  await waitFor(() => expect(body).toHaveClass("leaderboard-body--incoming"));
  fireEvent.transitionEnd(body);

  fireEvent.touchStart(body, { touches: [{ clientX: 100, clientY: 120 }] });
  fireEvent.touchMove(body, { touches: [{ clientX: 280, clientY: 125 }] });
  expect(body).toHaveStyle({ transform: "translate3d(180px, 0, 0)" });

  fireEvent.touchEnd(body, { changedTouches: [{ clientX: 280, clientY: 125 }] });
  fireEvent.transitionEnd(body);

  expect(getPageIndicator(1)).toBeInTheDocument();
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

test("pinning a player keeps the current page when pinned filtering is off", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => createPayload(60),
  });

  render(<App />);
  await screen.findByText("Player 25");

  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(getPageIndicator(2)).toBeInTheDocument();

  await userEvent.click(screen.getByText("Player 30"));

  expect(JSON.parse(window.localStorage.getItem(PIN_STORAGE_KEY))).toHaveLength(1);
  expect(getPageIndicator(2)).toBeInTheDocument();
  expect(screen.getByText("Player 30")).toBeInTheDocument();
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
  const initialDeltaPlaceholders = Array.from(document.querySelectorAll(".rank-delta"));

  expect(initialDeltaPlaceholders).toHaveLength(2);
  expect(initialDeltaPlaceholders.every((element) => element.classList.contains("rank-delta--pending"))).toBe(true);

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
  expect(document.querySelectorAll(".rank-delta")).toHaveLength(2);
});

test("keeps the previous region intact until the next region and history are ready", async () => {
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
  await userEvent.click(screen.getByRole("button", { name: "More options" }));
  const initialRows = Array.from(document.querySelectorAll("[data-player-row='true']"));
  const initialBodyHeight = screen.getByTestId("leaderboard-body").style.height;

  await userEvent.click(screen.getByRole("button", { name: "Americas" }));

  expect(screen.getByText("+4")).toBeInTheDocument();
  expect(screen.getByText("Top Carry")).toBeInTheDocument();
  expect(screen.queryByText("Loading history")).not.toBeInTheDocument();
  expect(document.querySelectorAll("[data-player-row='true']")).toHaveLength(initialRows.length);
  expect(screen.getByTestId("leaderboard-body").style.height).toBe(initialBodyHeight);
  expect(screen.getByRole("region", { name: "Player rankings" })).toHaveClass("leaderboard-card--history");

  await act(async () => {
    resolveAmericas({
      ok: true,
      status: 200,
      json: async () => americasPayload,
    });
    await Promise.resolve();
  });
  expect(screen.getByText("Top Carry")).toBeInTheDocument();
  expect(screen.getByText("+4")).toBeInTheDocument();
  expect(screen.queryByText("Americas Player")).not.toBeInTheDocument();

  await act(async () => {
    resolveAmericasHistory({
      ok: true,
      status: 200,
      json: async () => americasHistory,
    });
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(await screen.findByText("Americas Player")).toBeInTheDocument();
  expect(await screen.findByText("+6")).toBeInTheDocument();
  expect(screen.queryByText("+4")).not.toBeInTheDocument();
});

test("share copies a compact personalized link", async () => {
  render(<App />);
  await screen.findByText("Top Carry");

  await userEvent.click(screen.getByText("Top Carry"));
  await userEvent.click(screen.getByRole("button", { name: "More options" }));
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name: /copy shareable link/i }));
  });

  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    expect.stringMatching(/\/?s=1e\.{4}e[a-z0-9]+$/)
  ));
  await waitFor(() => expect(screen.getByRole("button", { name: /copy shareable link/i })).toHaveAttribute("title", "Copied"));
});

test("compact share links restore the personalized view", async () => {
  const topCarryKey = createPlayerKey("europe", {
    name: "Top Carry",
    teamId: 10,
    countryCode: "FI",
  });
  window.history.replaceState({}, "", `/?s=1e.fi..1.e${topCarryKey.slice(1)}`);

  render(<App />);

  await screen.findByText("Top Carry");
  expect(screen.getByLabelText("Filter by country")).toHaveValue("Finland");
  expect(screen.getByLabelText("Visible rows")).toHaveTextContent("25");
  await userEvent.click(screen.getByRole("button", { name: "More options" }));
  expect(screen.getByRole("checkbox", { name: "Filter pinned" })).toBeChecked();
});
