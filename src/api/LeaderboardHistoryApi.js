const publicUrl = process.env.PUBLIC_URL || "";

export async function getLeaderboardHistory(region = "europe", options = {}) {
  const response = await fetch(`${publicUrl}/data/${region}/history.v0001.json`, {
    cache: options.cache,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`History request failed (${response.status}).`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.players) || !Array.isArray(payload.samples)) {
    throw new Error("History data is not in the expected format.");
  }

  return payload;
}
