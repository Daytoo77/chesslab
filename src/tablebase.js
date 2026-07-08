// Lichess Syzygy tablebase probe (7 men or fewer). Optional & online-only —
// throttled (rate-limit friendly), retried once, deduped, cached.
import { pieceCount } from './engine.js';

const cache = new Map();
const inFlight = new Map();
let lastCall = 0;
const MIN_GAP = 1100; // ms between API calls — stays well under lichess rate limits
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(fen) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2500);
  try {
    const res = await fetch('https://tablebase.lichess.ovh/standard?fen=' + encodeURIComponent(fen), { signal: ctl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return { category: j.category, dtz: j.dtz };
  } finally { clearTimeout(t); }
}

export async function probeTablebase(fen) {
  if (pieceCount(fen) > 7) return null;
  if (cache.has(fen)) return cache.get(fen);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  if (inFlight.has(fen)) return inFlight.get(fen);
  const p = (async () => {
    const wait = lastCall + MIN_GAP - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      let out = null;
      try { out = await fetchOnce(fen); } catch { out = null; }
      if (!out) { await sleep(600); lastCall = Date.now(); try { out = await fetchOnce(fen); } catch { out = null; } }
      if (out) cache.set(fen, out);
      return out;
    } finally { inFlight.delete(fen); }
  })();
  inFlight.set(fen, p);
  return p;
}
