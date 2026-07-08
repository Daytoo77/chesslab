// Tiny persistent stats store (localStorage with in-memory fallback).
const KEY = 'chesslab_stats_v1';
const DEFAULTS = {
  tacticsSolved: 0,
  tacticsFailed: 0,
  streak: 0,
  bestStreak: 0,
  lastSolvedDay: null,
  solvedToday: [],
  todayKey: null,
  linesStudied: {},   // lineId -> true (study mode completed)
  quizBest: {},       // lineId -> best % score
  gamesAnalyzed: 0,
  drillsDone: {},     // drillId -> times completed
  daily: {},          // dayKey -> tactics solved that day
};

let mem = null;
const listeners = new Set();

function load() {
  if (mem) return mem;
  try {
    mem = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    mem = { ...DEFAULTS };
  }
  return mem;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* in-memory only */ }
  listeners.forEach((fn) => fn(mem));
}

export function getStats() { return { ...load() }; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function update(fn) {
  const s = load();
  fn(s);
  save();
}

export function recordPuzzleSolved(puzzleId) {
  update((s) => {
    const today = dayKey();
    if (s.todayKey !== today) { s.todayKey = today; s.solvedToday = []; }
    if (s.solvedToday.includes(puzzleId)) return;
    s.solvedToday.push(puzzleId);
    s.tacticsSolved += 1;
    s.daily[today] = (s.daily[today] || 0) + 1;
    if (s.lastSolvedDay !== today) {
      const yest = dayKey(new Date(Date.now() - 864e5));
      s.streak = s.lastSolvedDay === yest ? s.streak + 1 : 1;
      s.lastSolvedDay = today;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    }
  });
}

export function recordPuzzleFailed() { update((s) => { s.tacticsFailed += 1; }); }
export function recordLineStudied(lineId) { update((s) => { s.linesStudied[lineId] = true; }); }
export function recordQuiz(lineId, pct) {
  update((s) => { s.quizBest[lineId] = Math.max(s.quizBest[lineId] || 0, pct); });
}
export function recordGameAnalyzed() { update((s) => { s.gamesAnalyzed += 1; }); }
export function recordDrillDone(drillId) {
  update((s) => { s.drillsDone[drillId] = (s.drillsDone[drillId] || 0) + 1; });
}
export function resetStats() { update((s) => { Object.assign(s, JSON.parse(JSON.stringify(DEFAULTS))); }); }
