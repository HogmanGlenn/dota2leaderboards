import React from "react";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Flag from "../flag/Flag";
import { getCountryName } from "../../utils/countries";
import "./Leaderboard.css";

const DEFAULT_ROW_HEIGHT = 18;
const MOBILE_ROW_HEIGHT = 36;
const OVERSCAN_ROWS = 24;
const SWIPE_AXIS_THRESHOLD = 8;
const SWIPE_EDGE_RESISTANCE = 0.28;
const SWIPE_VELOCITY_THRESHOLD = 0.45;

const createIdleSwipeState = () => ({ direction: 0, offset: 0, phase: "idle" });

function formatUpdatedAt(timestamp) {
  if (!timestamp) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

function calculateRowHeight() {
  if (window.innerWidth <= 640) return MOBILE_ROW_HEIGHT;
  return Math.min(52, Math.max(18, (window.innerHeight - 274) / 25));
}

function LoadingRows() {
  return Array.from({ length: 25 }, (_, index) => (
    <div className="leaderboard-row" role="row" key={index}>
      <div className="leaderboard-cell rank-column" role="cell"><Skeleton width={30} /></div>
      <div className="leaderboard-cell player-column" role="cell"><Skeleton width={`${55 + (index % 3) * 12}%`} /></div>
      <div className="leaderboard-cell team-column" role="cell"><Skeleton width="55%" /></div>
      <div className="leaderboard-cell country-column" role="cell"><Skeleton width={72} /></div>
    </div>
  ));
}

const PlayerRow = React.memo(function PlayerRow({
  player,
  relativeRank,
  showRelativeRank,
  rankDelta,
  showRankDelta,
  isPinned,
  onTogglePinned,
  translateY,
}) {
  const togglePinned = () => onTogglePinned(player);
  const rankDeltaType = rankDelta?.type || "missing";
  const rankDeltaLabel = rankDelta?.label || "—";
  const rankDeltaElement = showRankDelta ? (
    <span
      className={[
        "rank-delta",
        `rank-delta--${rankDeltaType}`,
        rankDelta ? "" : "rank-delta--pending",
      ].filter(Boolean).join(" ")}
      aria-hidden={rankDelta ? undefined : "true"}
    >
      {rankDeltaLabel}
    </span>
  ) : null;
  const handleKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePinned();
  };

  return (
    <div
      className={[
        "leaderboard-row leaderboard-row--player",
        isPinned ? "leaderboard-row--pinned" : "",
      ].filter(Boolean).join(" ")}
      data-player-row="true"
      role="row"
      tabIndex={0}
      aria-selected={isPinned}
      style={{ transform: `translateY(${translateY}px)` }}
      onClick={togglePinned}
      onKeyDown={handleKeyDown}
    >
      <div className="leaderboard-cell rank-column" role="cell">
        {isPinned && <span className="pin-marker" aria-hidden="true">●</span>}
        {showRelativeRank ? (
          <span className="rank-pair">
            <span className="rank-relative">
              {relativeRank.toLocaleString()}
            </span>
            <span className="rank-with-change">
              <span className={player.rank <= 3 ? "rank rank--top" : "rank"}>
                {player.rank.toLocaleString()}
              </span>
              {rankDeltaElement}
            </span>
          </span>
        ) : (
          <span className="rank-with-change">
            <span className={player.rank <= 3 ? "rank rank--top" : "rank"}>
              {player.rank.toLocaleString()}
            </span>
            {rankDeltaElement}
          </span>
        )}
      </div>
      <div className="leaderboard-cell player-column" role="cell">
        <span className="player-name">{player.name}</span>
      </div>
      <div className="leaderboard-cell team-column" role="cell">
        {player.teamTag ? <span className="team-tag">{player.teamTag}</span> : <span className="muted">—</span>}
      </div>
      <div className="leaderboard-cell country-column" role="cell">
        {player.countryCode ? (
          <span className="country-cell">
            <Flag countryCode={player.countryCode} />
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
  rankDeltas = new Map(),
  showRankDelta = false,
  isPlayerPinned = () => false,
  onTogglePinned = () => {},
}) {
  const [page, setPage] = React.useState(0);
  const [rowHeight, setRowHeight] = React.useState(DEFAULT_ROW_HEIGHT);
  const [virtualRange, setVirtualRange] = React.useState({ start: 0, end: 80 });
  const [swipe, setSwipe] = React.useState(createIdleSwipeState);
  const bodyRef = React.useRef(null);
  const swipeStartRef = React.useRef(null);
  const swipeFrameRef = React.useRef(0);

  React.useEffect(() => {
    setPage(0);
    setSwipe(createIdleSwipeState());
  }, [players, rowsPerPage]);

  React.useEffect(() => () => {
    window.cancelAnimationFrame(swipeFrameRef.current);
  }, []);

  const maxPage = Math.max(0, Math.ceil(players.length / effectiveRowsPerPage) - 1);
  React.useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [maxPage, page]);

  const visiblePlayers = React.useMemo(
    () => players.slice(page * rowsPerPage, page * rowsPerPage + effectiveRowsPerPage),
    [effectiveRowsPerPage, page, players, rowsPerPage]
  );
  const lastUpdated = formatUpdatedAt(updatedAt);

  const handleTouchStart = React.useCallback((event) => {
    if (swipe.phase !== "idle" || event.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = {
      axis: null,
      lastTime: event.timeStamp,
      lastX: touch.clientX,
      offset: 0,
      velocity: 0,
      x: touch.clientX,
      y: touch.clientY,
    };
  }, [swipe.phase]);

  const handleTouchMove = React.useCallback((event) => {
    const start = swipeStartRef.current;
    if (!start || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const horizontalDistance = touch.clientX - start.x;
    const verticalDistance = touch.clientY - start.y;

    if (!start.axis) {
      const horizontalIntent = Math.abs(horizontalDistance);
      const verticalIntent = Math.abs(verticalDistance);
      if (Math.max(horizontalIntent, verticalIntent) < SWIPE_AXIS_THRESHOLD) return;
      start.axis = horizontalIntent > verticalIntent ? "horizontal" : "vertical";
    }

    if (start.axis !== "horizontal") return;

    const pullingPastStart = page === 0 && horizontalDistance > 0;
    const pullingPastEnd = page === maxPage && horizontalDistance < 0;
    const offset = pullingPastStart || pullingPastEnd
      ? horizontalDistance * SWIPE_EDGE_RESISTANCE
      : horizontalDistance;
    const elapsed = event.timeStamp - start.lastTime;

    if (elapsed > 0) {
      start.velocity = (touch.clientX - start.lastX) / elapsed;
    }
    start.lastTime = event.timeStamp;
    start.lastX = touch.clientX;
    start.offset = offset;
    setSwipe({ direction: 0, offset, phase: "dragging" });
  }, [maxPage, page]);

  const handleTouchEnd = React.useCallback(() => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.axis !== "horizontal") return;

    const width = bodyRef.current?.getBoundingClientRect().width || window.innerWidth;
    const direction = start.offset < 0 ? 1 : -1;
    const pageExists = direction > 0 ? page < maxPage : page > 0;
    const passedDistanceThreshold = Math.abs(start.offset) >= width * 0.2;
    const passedVelocityThreshold = Math.abs(start.offset) >= 18
      && Math.abs(start.velocity) >= SWIPE_VELOCITY_THRESHOLD
      && Math.sign(start.velocity) === Math.sign(start.offset);

    if (!pageExists || (!passedDistanceThreshold && !passedVelocityThreshold)) {
      setSwipe({ direction: 0, offset: 0, phase: "settling" });
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPage((currentPage) => currentPage + direction);
      setSwipe(createIdleSwipeState());
      return;
    }

    setSwipe({
      direction,
      offset: direction > 0 ? -width : width,
      phase: "outgoing",
    });
  }, [maxPage, page]);

  const handleTouchCancel = React.useCallback(() => {
    const wasDragging = swipeStartRef.current?.axis === "horizontal";
    swipeStartRef.current = null;
    if (wasDragging) setSwipe({ direction: 0, offset: 0, phase: "settling" });
  }, []);

  const handleSwipeTransitionEnd = React.useCallback((event) => {
    if (event.target !== event.currentTarget) return;

    if (swipe.phase === "outgoing") {
      const { direction } = swipe;
      const width = bodyRef.current?.getBoundingClientRect().width || window.innerWidth;
      setPage((currentPage) => currentPage + direction);
      setSwipe({
        direction,
        offset: direction > 0 ? width : -width,
        phase: "positioning",
      });

      window.cancelAnimationFrame(swipeFrameRef.current);
      swipeFrameRef.current = window.requestAnimationFrame(() => {
        swipeFrameRef.current = window.requestAnimationFrame(() => {
          setSwipe({ direction, offset: 0, phase: "incoming" });
        });
      });
      return;
    }

    if (swipe.phase === "incoming" || swipe.phase === "settling") {
      setSwipe(createIdleSwipeState());
    }
  }, [swipe]);

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
        showRankDelta ? "leaderboard-card--history" : "",
      ].filter(Boolean).join(" ")}
      aria-label="Player rankings"
      aria-busy={isLoading}
    >
      <div className="leaderboard-table" role="table" aria-label="Dota 2 player leaderboard">
        <div className="leaderboard-head" role="rowgroup">
          <div className="leaderboard-row leaderboard-row--head" role="row">
            <div className="leaderboard-cell rank-column" role="columnheader">Rank</div>
            <div className="leaderboard-cell player-column" role="columnheader">Player</div>
            <div className="leaderboard-cell team-column" role="columnheader">Team</div>
            <div className="leaderboard-cell country-column" role="columnheader">Country</div>
          </div>
        </div>
        <div
          className={`leaderboard-body leaderboard-body--${swipe.phase}`}
          data-testid="leaderboard-body"
          role="rowgroup"
          ref={bodyRef}
          style={{
            height: bodyHeight,
            transform: `translate3d(${swipe.offset}px, 0, 0)`,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onTransitionEnd={handleSwipeTransitionEnd}
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
                rankDelta={rankDeltas.get(player.playerKey)}
                showRankDelta={showRankDelta}
                isPinned={isPlayerPinned(player)}
                onTogglePinned={onTogglePinned}
                translateY={absoluteIndex * rowHeight}
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
            <span className="page-indicator" aria-live="polite">Page {page + 1}</span>
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
