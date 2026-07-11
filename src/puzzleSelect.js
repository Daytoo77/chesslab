// Puzzle difficulty tiers + anti-repetition picker. Pure functions over a
// puzzle list and a rating function — no store/React import, fully testable.
export const TIERS = [
  { id: 'beginner', label: 'Beginner', min: 0, max: 900 },
  { id: 'club', label: 'Club', min: 900, max: 1400 },
  { id: 'advanced', label: 'Advanced', min: 1400, max: 1900 },
  { id: 'master', label: 'Master', min: 1900, max: Infinity },
];

export function tierOf(elo) {
  return TIERS.find((t) => elo >= t.min && elo < t.max) || TIERS[TIERS.length - 1];
}

export function filterByTier(puzzles, eloFn, tierId) {
  if (!tierId || tierId === 'all') return puzzles;
  const t = TIERS.find((x) => x.id === tierId);
  if (!t) return puzzles;
  return puzzles.filter((p) => { const e = eloFn(p); return e >= t.min && e < t.max; });
}

// Picks a random puzzle index (into `puzzles`), preferring ones whose id is
// NOT in `recentIds` (a ring buffer of the last N shown). Falls back to the
// full pool if every candidate has been shown recently (small pools, or a
// narrow tier) so it never gets stuck with nothing to offer.
export function pickNext(puzzles, recentIds = []) {
  if (!puzzles.length) return -1;
  const fresh = puzzles.map((p, i) => [p, i]).filter(([p]) => !recentIds.includes(p.id));
  const pool = fresh.length ? fresh : puzzles.map((p, i) => [p, i]);
  const [, idx] = pool[Math.floor(Math.random() * pool.length)];
  return idx;
}

// Ring-buffer push, capped at `size` (default 8) — recent enough to avoid
// back-to-back repeats without permanently excluding anything from a small set.
export function pushRecent(recentIds, id, size = 8) {
  const next = [...recentIds, id];
  return next.length > size ? next.slice(next.length - size) : next;
}
