import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import Leaderboard from "./components/leaderboard/Leaderboard";

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
  expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/data/europe/v0001.json"),
    expect.objectContaining({ signal: undefined })
  );
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
