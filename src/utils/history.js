export const HISTORY_WINDOWS = {
  "8h": 8 * 60 * 60,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
};

export const HISTORY_OPTIONS = ["off", ...Object.keys(HISTORY_WINDOWS)];
// Snapshots are collected every eight hours. Never substitute a distant sample
// when an outage left the requested comparison period unobserved.
export const HISTORY_SAMPLE_TOLERANCE_SECONDS = 4 * 60 * 60;

export function createHistoryIndex(history) {
  if (!history || !Array.isArray(history.players) || !Array.isArray(history.samples)) {
    return { players: [], samples: [], keyToIndex: new Map() };
  }

  return {
    players: history.players,
    samples: history.samples.filter((sample) => sample && Number.isFinite(sample.t)),
    keyToIndex: new Map(history.players.map((key, index) => [key, index])),
  };
}

export function findHistorySample(samples, currentTimestamp, windowName) {
  const seconds = HISTORY_WINDOWS[windowName];
  if (!seconds || !Number.isFinite(currentTimestamp)) return null;

  const target = currentTimestamp - seconds;
  let best = null;
  samples.forEach((sample) => {
    if (!sample || !Number.isFinite(sample.t) || sample.t >= currentTimestamp) return;
    const distance = Math.abs(sample.t - target);
    if (distance > HISTORY_SAMPLE_TOLERANCE_SECONDS) return;
    if (!best || distance < Math.abs(best.t - target)
      || (distance === Math.abs(best.t - target) && sample.t < best.t)) best = sample;
  });
  return best;
}

export function getRankDelta(player, historyIndex, currentTimestamp, windowName) {
  const sample = findHistorySample(historyIndex.samples, currentTimestamp, windowName);
  if (!sample) return { label: "—", type: "missing" };

  if (!Array.isArray(sample.i) || !Array.isArray(sample.r)) {
    return { label: "—", type: "missing" };
  }

  let samplePosition = -1;
  for (const key of [player.playerKey, ...(player.playerKeyAliases || [])]) {
    const playerIndex = historyIndex.keyToIndex.get(key);
    if (playerIndex == null) continue;
    samplePosition = sample.i.indexOf(playerIndex);
    if (samplePosition >= 0) break;
  }
  if (samplePosition < 0) return { label: "new", type: "new" };

  const previousRank = sample.r[samplePosition];
  if (!Number.isFinite(previousRank) || previousRank < 1) return { label: "—", type: "missing" };

  const movement = previousRank - player.rank;
  if (movement > 0) return { label: `+${movement.toLocaleString()}`, type: "up" };
  if (movement < 0) return { label: `-${Math.abs(movement).toLocaleString()}`, type: "down" };
  return { label: "0", type: "same" };
}

export function createSimulatedHistory(players, currentTimestamp) {
  const timestamp = Number.isFinite(currentTimestamp)
    ? currentTimestamp - HISTORY_WINDOWS["30d"]
    : Math.floor(Date.now() / 1000) - HISTORY_WINDOWS["30d"];
  const keys = [];
  const indexes = [];
  const ranks = [];

  players.forEach((player, index) => {
    if (!player.playerKey) return;
    keys.push(player.playerKey);
    indexes.push(indexes.length);

    const pattern = index % 6;
    const movement = [12, -8, 3, -15, 0, 25][pattern];
    ranks.push(Math.max(1, player.rank + movement));
  });

  return {
    version: 1,
    interval_hours: 8,
    retention_days: 30,
    players: keys,
    samples: Object.values(HISTORY_WINDOWS).map((seconds) => ({
      t: timestamp + HISTORY_WINDOWS["30d"] - seconds, i: indexes, r: ranks,
    })),
  };
}
