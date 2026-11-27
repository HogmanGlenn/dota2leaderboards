import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const rows = Array.from({ length: 105 }, (_, index) => ({
  rank: index + 1, name: `Player ${index + 1}`, country: "fi", team_id: index,
  player_key: `p${index}`, player_key_aliases: [`pold${index}`],
}));

function headElement(tag, id, attributes = {}) {
  const element = document.createElement(tag);
  element.id = id;
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  document.head.appendChild(element);
  return element;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  headElement("link", "test-canonical", { rel: "canonical", href: "https://dota2leaderboards.com/" });
  headElement("script", "seo-structured-data", { type: "application/ld+json" });
  headElement("script", "leaderboard-availability", { type: "application/json" }).textContent = JSON.stringify({
    europe: ["finland"], americas: ["finland"], china: ["china"], se_asia: ["china"],
  });
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => ({ fetched_at: 1_790_000_000, leaderboard: String(url).includes("/china/")
      ? [{ rank: 1, name: "China Player", country: "cn" }] : rows }),
  }));
});

afterEach(() => {
  ["test-canonical", "seo-structured-data", "leaderboard-availability"].forEach((id) => document.getElementById(id)?.remove());
  jest.restoreAllMocks();
});

test("direct crawlable pages show the same 25 rows and keep normal pagination, sharing, and history navigation", async () => {
  window.history.replaceState({}, "", "/europe/page/2/");
  render(<App />);
  expect(await screen.findByText("Player 26")).toBeInTheDocument();
  expect(screen.queryByText("Player 1")).not.toBeInTheDocument();
  expect(document.querySelectorAll("[data-player-row]")).toHaveLength(25);
  expect(screen.getByRole("button", { name: "Next page" })).toHaveAttribute("href", "/europe/page/3/");
  expect(screen.getByRole("button", { name: "Previous page" })).toHaveAttribute("href", "/europe/");
  const pushState = jest.spyOn(window.history, "pushState");
  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(await screen.findByText("Player 51")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/europe/page/3/");
  expect(pushState).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    window.history.replaceState({}, "", "/europe/page/2/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(await screen.findByText("Player 26")).toBeInTheDocument();
  expect(document.querySelector(".page-indicator")).toHaveTextContent("Page 2 of 5");
});

test("custom row counts keep the existing page size while canonicalizing the matching rank range", async () => {
  window.history.replaceState({}, "", "/europe/page/2/?limit=50");
  render(<App />);
  expect(await screen.findByText("Player 51")).toBeInTheDocument();
  expect(document.querySelectorAll("[data-player-row]")).toHaveLength(50);
  await waitFor(() => expect(document.getElementById("test-canonical")).toHaveAttribute("href", "https://dota2leaderboards.com/europe/page/3/"));
  await userEvent.type(screen.getByLabelText("Player or team"), "Player 105");
  expect(await screen.findByText("Player 105")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/europe/");
  expect(window.location.search).toBe("?limit=50");
});

test("country navigation links match generated destinations before any prefetch", async () => {
  window.history.replaceState({}, "", "/europe/finland/");
  render(<App />);
  await screen.findByText("Player 1");
  expect(screen.getByRole("link", { name: "Americas" })).toHaveAttribute("href", "/americas/finland/");
  expect(screen.getByRole("link", { name: "China" })).toHaveAttribute("href", "/china/");
  await userEvent.click(screen.getByRole("link", { name: "China" }));
  expect(await screen.findByText("China Player")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/china/");
  expect(screen.getByLabelText("Filter by country")).toHaveValue("");
});

test("schema, canonical, accessible heading, and displayed rows stay synchronized after region navigation", async () => {
  render(<App />);
  await screen.findByText("Player 1");
  await userEvent.click(screen.getByRole("link", { name: "China" }));
  await screen.findByText("China Player");
  await waitFor(() => {
    const schema = JSON.parse(document.getElementById("seo-structured-data").textContent)["@graph"][1];
    expect(schema.url).toBe("https://dota2leaderboards.com/china/");
    expect(schema.mainEntity.itemListElement.map((item) => item.name)).toEqual(["China Player"]);
    expect(schema.dateModified).toBe(new Date(1_790_000_000 * 1000).toISOString().replace(".000Z", "Z"));
  });
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dota 2 Leaderboard | China");
  expect(document.querySelector(".site-title")).toHaveTextContent("Dota 2 Leaderboards");
});

test("Ctrl+F still exposes every off-page player and preserves published keys and aliases", async () => {
  window.history.replaceState({}, "", "/europe/page/2/");
  render(<App />);
  await screen.findByText("Player 26");
  fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  const index = screen.getByTestId("leaderboard-find-index");
  expect(index.querySelectorAll("[data-find-key]")).toHaveLength(80);
  expect(index.querySelector('[data-find-key="p104"]')).toHaveTextContent("Player 105");
  expect(index.querySelector('[data-find-key="p0"]')).toHaveTextContent("Player 1");
  expect(index.querySelector('[data-find-key="p25"]')).not.toBeInTheDocument();
});
