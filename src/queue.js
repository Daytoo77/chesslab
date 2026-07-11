// The personal-coach loop, as pure functions (no store import — testable in
// plain node). Combines SRS dues, weakness profile, daily habits and goals
// into one scored "Do this now" queue, and computes per-motif trends.
import { MOTIF_META } from './motifs.js';

// state slices in, scored task list out (highest score = do first).
export function buildDailyQueue({
  dueLines = 0,           // opening lines due today (SRS)
  solvedToday = 0,        // tactics solved today
  dailyTacticGoal = 10,
  topWeakness = null,     // [motifKey, lifetimeCount] or null
  recentWeaknessCount = 0,// occurrences of that motif in the recent window
  analyzedToday = false,
  slowGameToday = false,
} = {}) {
  const q = [];
  if (dueLines > 0) {
    q.push({
      id: 'openings-due', icon: '♜', page: 'openings',
      label: `Review ${dueLines} due opening line${dueLines > 1 ? 's' : ''}`,
      sub: 'Spaced repetition works only if you show up on the due day.',
      score: 3 + Math.min(dueLines, 5) * 0.4,
    });
  }
  const remaining = Math.max(0, dailyTacticGoal - solvedToday);
  if (remaining > 0) {
    q.push({
      id: 'tactics-goal', icon: '⚔', page: 'tactics',
      label: `Solve ${remaining} more tactic${remaining > 1 ? 's' : ''}`,
      sub: solvedToday > 0 ? `${solvedToday} down — keep the streak alive.` : 'The daily habit that moves ratings most.',
      score: 2 + Math.min(remaining, 10) * 0.15,
    });
  }
  if (topWeakness && MOTIF_META[topWeakness[0]]) {
    const mm = MOTIF_META[topWeakness[0]];
    q.push({
      id: 'weakness-drill', icon: mm.icon, page: 'tactics', motif: topWeakness[0],
      label: `Drill your #1 leak: ${mm.label.toLowerCase()}`,
      sub: mm.advice,
      // recurring recently = urgent; a leak from months ago matters less
      score: 2.2 + Math.min(recentWeaknessCount, 4) * 0.6,
    });
  }
  if (!analyzedToday) {
    q.push({
      id: 'analyze', icon: '⚡', page: 'analyzer',
      label: 'Analyze one of your games',
      sub: 'Especially a loss — that is where the rating points hide.',
      score: 2.0,
    });
  }
  if (!slowGameToday) {
    q.push({
      id: 'slow-game', icon: '♞', page: 'play',
      label: 'Play one slow game',
      sub: '10 minutes or longer — blitz teaches habits, slow chess teaches thinking.',
      score: 1.5,
    });
  }
  return q.sort((a, b) => b.score - a.score);
}

// ---- Session mode: a guided block of training, split across the work that
// matters. Pure planning/progress math; the store holds the timestamps, so a
// session survives reloads for free. ----
const SESSION_SPLIT = [
  { cat: 'tactics',  page: 'tactics',  icon: '⚔', label: 'Tactics',          share: 0.34 },
  { cat: 'analysis', page: 'analyzer', icon: '⚡', label: 'Game review',      share: 0.33 },
  { cat: 'openings', page: 'openings', icon: '♜', label: 'Opening lines',    share: 0.17 },
  { cat: 'endgames', page: 'endgames', icon: '♚', label: 'Endgame drills',   share: 0.16 },
];

export function buildSession(totalMinutes) {
  const segs = SESSION_SPLIT.map((s) => ({ ...s, minutes: Math.max(1, Math.round(totalMinutes * s.share)) }));
  // rounding drift lands on the first (largest) segment so the sum is exact
  const drift = totalMinutes - segs.reduce((a, s) => a + s.minutes, 0);
  segs[0].minutes = Math.max(1, segs[0].minutes + drift);
  return segs;
}

export function sessionProgress(session, now = Date.now()) {
  if (!session) return null;
  const totalMin = session.segments.reduce((a, s) => a + s.minutes, 0);
  const elapsedMin = Math.max(0, Math.min(totalMin, (now - session.startedAt) / 60000));
  let acc = 0, current = null, segElapsed = 0;
  const perCat = {};
  for (let i = 0; i < session.segments.length; i++) {
    const seg = session.segments[i];
    const inSeg = Math.max(0, Math.min(seg.minutes, elapsedMin - acc));
    perCat[seg.cat] = (perCat[seg.cat] || 0) + inSeg;
    if (current == null && elapsedMin < acc + seg.minutes) { current = i; segElapsed = inSeg; }
    acc += seg.minutes;
  }
  const done = elapsedMin >= totalMin;
  return {
    totalMin,
    elapsedMin,
    pct: Math.round((elapsedMin / totalMin) * 100),
    current: done ? null : current,
    segElapsed,
    perCat,
    done,
  };
}

// Per-motif trend: compare the newer half of the recent window against the
// older half. Fewer occurrences recently = 'down' (improving).
export function motifTrends(profile) {
  const recent = (profile && profile.recent) || [];
  if (recent.length < 4) return {}; // not enough games to call a trend
  const half = Math.floor(recent.length / 2);
  const older = recent.slice(0, half);
  const newer = recent.slice(half);
  const sum = (list) => {
    const t = {};
    for (const g of list) for (const [k, c] of Object.entries(g.counts || {})) t[k] = (t[k] || 0) + c;
    return t;
  };
  const o = sum(older), n = sum(newer);
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  const out = {};
  for (const k of keys) {
    const oAvg = (o[k] || 0) / older.length;
    const nAvg = (n[k] || 0) / newer.length;
    out[k] = {
      olderAvg: +oAvg.toFixed(2),
      newerAvg: +nAvg.toFixed(2),
      dir: nAvg < oAvg - 0.05 ? 'down' : nAvg > oAvg + 0.05 ? 'up' : 'flat',
    };
  }
  return out;
}
