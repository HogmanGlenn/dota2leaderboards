import React from "react";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import { getCountryName } from "../../utils/countries";
import "./Leaderboard.css";

const publicUrl = process.env.PUBLIC_URL || "";
const DEFAULT_ROW_HEIGHT = 18;
const OVERSCAN_ROWS = 24;

export function getFlagImageUrl(countryCode, size = "24x18") {
  if (!countryCode) return "";
  return `${publicUrl}/flags/${size}/${countryCode.toLowerCase()}.png`;
}

function formatUpdatedAt(timestamp) {
  if (!timestamp) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

function calculateRowHeight() {
  return Math.min(52, Math.max(18, (window.innerHeight - 274) / 25));
}

function LoadingRows() {
  return Array.from({ length: 25 }, (_, index) => (
    <div className="leaderboard-row" role="row" key={index}>
      <div className="leaderboard-cell rank-column" role="cell"><Skeleton width={30} /></div>
      <div className="leaderboard-cell" role="cell"><Skeleton width={`${55 + (index % 3) * 12}%`} /></div>
      <div className="leaderboard-cell team-column" role="cell"><Skeleton width="55%" /></div>
      <div className="leaderboard-cell" role="cell"><Skeleton width={72} /></div>
    </div>
  ));
}

const PlayerRow = React.memo(function PlayerRow({
  player,
  relativeRank,
  showRelativeRank,
  style,
}) {
  return (
    <div
      className="leaderboard-row leaderboard-row--player"
      data-player-row="true"
      role="row"
      style={style}
    >
      <div className="leaderboard-cell rank-column" role="cell">
        {showRelativeRank ? (
          <span className="rank-pair">
            <span className="rank-relative">
              {relativeRank.toLocaleString()}
            </span>
            <span className={player.rank <= 3 ? "rank rank--top" : "rank"}>
              {player.rank.toLocaleString()}
            </span>
          </span>
        ) : (
          <span className={player.rank <= 3 ? "rank rank--top" : "rank"}>
            {player.rank.toLocaleString()}
          </span>
        )}
      </div>
      <div className="leaderboard-cell" role="cell">
        <span className="player-name">{player.name}</span>
      </div>
      <div className="leaderboard-cell team-column" role="cell">
        {player.teamTag ? <span className="team-tag">{player.teamTag}</span> : <span className="muted">—</span>}
      </div>
      <div className="leaderboard-cell" role="cell">
        {player.countryCode ? (
          <span className="country-cell">
            <img src={getFlagImageUrl(player.countryCode)} alt="" />
            <span>{getCountryName(player.countryCode)}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
});

export default function Leaderboard({
  players,
  rowsPerPage,
  effectiveRowsPerPage = rowsPerPage,
  showRelativeRank,
  isLoading,
  updatedAt,
  error,
  onRetry,
  hasFilters,
}) {
  const [page, setPage] = React.useState(0);
  const [rowHeight, setRowHeight] = React.useState(DEFAULT_ROW_HEIGHT);
  const [virtualRange, setVirtualRange] = React.useState({ start: 0, end: 80 });
  const bodyRef = React.useRef(null);

  React.useEffect(() => setPage(0), [players, rowsPerPage]);

  const maxPage = Math.max(0, Math.ceil(players.length / effectiveRowsPerPage) - 1);
  React.useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [maxPage, page]);

  const visiblePlayers = React.useMemo(
    () => players.slice(page * rowsPerPage, page * rowsPerPage + effectiveRowsPerPage),
    [effectiveRowsPerPage, page, players, rowsPerPage]
  );
  const lastUpdated = formatUpdatedAt(updatedAt);

  React.useLayoutEffect(() => {
    const updateRowHeight = () => setRowHeight(calculateRowHeight());
    updateRowHeight();
    window.addEventListener("resize", updateRowHeight);
    return () => window.removeEventListener("resize", updateRowHeight);
  }, []);

  React.useLayoutEffect(() => {
    if (isLoading || visiblePlayers.length === 0) {
      setVirtualRange({ start: 0, end: 80 });
      return undefined;
    }

    let frameId = 0;
    const updateRange = () => {
      if (!bodyRef.current) return;

      const bodyTop = bodyRef.current.getBoundingClientRect().top + window.scrollY;
      const viewportTop = window.scrollY;
      const viewportBottom = viewportTop + window.innerHeight;
      const nextStart = Math.max(
        0,
        Math.floor((viewportTop - bodyTop) / rowHeight) - OVERSCAN_ROWS
      );
      const nextEnd = Math.min(
        visiblePlayers.length,
        Math.ceil((viewportBottom - bodyTop) / rowHeight) + OVERSCAN_ROWS
      );

      setVirtualRange((current) => (
        current.start === nextStart && current.end === nextEnd
          ? current
          : { start: nextStart, end: nextEnd }
      ));
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateRange);
    };

    updateRange();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [isLoading, rowHeight, visiblePlayers.length]);

  if (error) {
    return (
      <section className="state-card" role="alert">
        <h2>Couldn&apos;t load this leaderboard</h2>
        <p>{error}</p>
        <Button variant="contained" onClick={onRetry}>Try again</Button>
      </section>
    );
  }

  if (!isLoading && players.length === 0) {
    return (
      <section className="state-card">
        <h2>{hasFilters ? "No matching players" : "No players available"}</h2>
        <p>{hasFilters ? "Try a broader name, team tag, or country filter." : "This division has not published any players yet."}</p>
      </section>
    );
  }

  const renderedPlayers = visiblePlayers.slice(virtualRange.start, virtualRange.end);
  const bodyHeight = Math.max(visiblePlayers.length, isLoading ? 25 : 0) * rowHeight;

  return (
    <section
      className={[
        "leaderboard-card",
        showRelativeRank ? "leaderboard-card--relative" : "",
      ].filter(Boolean).join(" ")}
      aria-label="Player rankings"
      aria-busy={isLoading}
    >
      <div className="leaderboard-table" role="table" aria-label="Dota 2 player leaderboard">
        <div className="leaderboard-head" role="rowgroup">
          <div className="leaderboard-row leaderboard-row--head" role="row">
            <div className="leaderboard-cell rank-column" role="columnheader">Rank</div>
            <div className="leaderboard-cell" role="columnheader">Player</div>
            <div className="leaderboard-cell team-column" role="columnheader">Team</div>
            <div className="leaderboard-cell" role="columnheader">Country</div>
          </div>
        </div>
        <div
          className="leaderboard-body"
          role="rowgroup"
          ref={bodyRef}
          style={{ height: bodyHeight }}
        >
          {isLoading ? <LoadingRows /> : renderedPlayers.map((player, index) => {
            const absoluteIndex = virtualRange.start + index;
            const relativeRank = page * effectiveRowsPerPage + absoluteIndex + 1;

            return (
              <PlayerRow
                key={`${player.rank}-${player.name}-${player.teamId || "none"}-${absoluteIndex}`}
                player={player}
                relativeRank={relativeRank}
                showRelativeRank={showRelativeRank}
                style={{ transform: `translateY(${absoluteIndex * rowHeight}px)` }}
              />
            );
          })}
        </div>
      </div>
      {!isLoading && (
        <footer className="leaderboard-footer">
          <div className="page-controls" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              &lt;
            </button>
            <span>Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(maxPage, currentPage + 1))}
              disabled={page >= maxPage}
              aria-label="Next page"
            >
              &gt;
            </button>
          </div>
          {lastUpdated && (
            <time className="updated-at" dateTime={new Date(updatedAt * 1000).toISOString()}>
              Last updated {lastUpdated}
            </time>
          )}
        </footer>
      )}
    </section>
  );
}
