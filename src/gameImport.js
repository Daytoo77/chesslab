// Fetch recent games from chess.com / lichess public APIs (both send CORS headers).
// Returns [{ id, white, black, result, speed, date, pgn, userColor }] newest first.

function monthUrl(user, d) {
  return `https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function fetchChessCom(username, max = 15) {
  const u = username.trim();
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const out = [];
  for (const url of [monthUrl(u, now), monthUrl(u, prev)]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const j = await res.json();
      for (const g of j.games || []) {
        if (!g.pgn) continue;
        const whiteIsUser = g.white.username.toLowerCase() === u.toLowerCase();
        out.push({
          id: g.url || String(g.end_time),
          white: `${g.white.username} (${g.white.rating})`,
          black: `${g.black.username} (${g.black.rating})`,
          result: g.white.result === 'win' ? '1-0' : g.black.result === 'win' ? '0-1' : '½-½',
          speed: g.time_class,
          date: new Date(g.end_time * 1000).toISOString().slice(0, 10),
          ts: g.end_time * 1000,
          pgn: g.pgn,
          userColor: whiteIsUser ? 'w' : 'b',
        });
      }
    } catch { /* try next month */ }
    if (out.length >= max) break;
  }
  out.sort((a, b) => b.ts - a.ts);
  if (!out.length) throw new Error('No games found — check the username (chess.com).');
  return out.slice(0, max);
}

export async function fetchLichess(username, max = 15) {
  const u = username.trim();
  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(u)}?max=${max}&pgnInJson=true&opening=false`, {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (!res.ok) throw new Error(res.status === 404 ? 'User not found on lichess.' : 'Lichess request failed.');
  const text = await res.text();
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const g = JSON.parse(line);
      const wName = (g.players.white.user && g.players.white.user.name) || 'Anonymous';
      const bName = (g.players.black.user && g.players.black.user.name) || 'Anonymous';
      const wr = g.players.white.rating ? ` (${g.players.white.rating})` : '';
      const br = g.players.black.rating ? ` (${g.players.black.rating})` : '';
      out.push({
        id: g.id,
        white: wName + wr,
        black: bName + br,
        result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½',
        speed: g.speed,
        date: new Date(g.createdAt).toISOString().slice(0, 10),
        ts: g.createdAt,
        pgn: g.pgn,
        userColor: wName.toLowerCase() === u.toLowerCase() ? 'w' : 'b',
      });
    } catch { /* skip bad line */ }
  }
  if (!out.length) throw new Error('No games found for that lichess user.');
  return out;
}
