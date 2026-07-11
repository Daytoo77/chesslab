// Global state — zustand + persist (replaces the old hand-rolled stats.js).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const addDays = (n) => dayKey(new Date(Date.now() + n * 864e5));
const SRS_STEPS = [1, 3, 7, 14, 30, 60];

const initial = {
  tacticsSolved: 0,
  tacticsFailed: 0,
  streak: 0,
  bestStreak: 0,
  lastSolvedDay: null,
  solvedToday: [],
  todayKey: null,
  linesStudied: {},
  quizBest: {},
  gamesAnalyzed: 0,
  drillsDone: {},
  daily: {},
  rushBest: 0,
  srs: {},          // lineId -> { step, due }
  customLines: [],  // imported PGN repertoire lines
  blindfold: false,
  arrowsByLine: {}, // `${lineId}:${ply}` -> user-drawn arrows
  cplProfile: { count: [0, 0, 0, 0], sum: [0, 0, 0, 0] }, // buckets: moves 1-10 / 11-20 / 21-30 / 31+
  vsRecord: {},      // botId -> { w, d, l }
  bestWinElo: 0,     // strongest bot ever beaten
  puzzleRating: 1000,
  puzzleRatingHistory: [], // recent ratings, for the dashboard sparkline
  myPuzzles: [],     // blunders from analyzed games -> personal puzzles { id, fen, solution, motif, date }
  motifStats: {},    // motif -> { tries, solved } — the weakness radar
  woodpecker: { cycles: [] }, // [{ ms, errors, date }] — same set, faster every cycle
  savedGame: null,   // in-progress bot game (resume after closing the app)
  // --- Training plan (the structured improvement program) ---
  studyLog: {},          // dayKey -> { play, analysis, tactics, strategy, endgames } minutes
  weeklyGoalH: 7,        // weekly study-hour target (the guide recommends >= 7)
  dailyTacticGoal: 10,   // the guide: "at least 10 [puzzles] per day"
  lastSlowGameDay: null, // a slow game (>=10 min / casual) finished — daily habit
  lastAnalyzeDay: null,  // analyzed a game today — daily habit
  // cross-game weakness profile — recurring mistake motifs across analyzed games
  weaknessProfile: { lifetime: {}, recent: [] }, // recent: [{ date, counts }]
  // guided training session — persisted so it survives reloads (resume for free)
  session: null, // { startedAt, minutes, segments: [{ cat, page, icon, label, minutes }] }
};

export const STUDY_CATS = [
  { id: 'play',     label: 'Play slow games', pct: 50, page: 'play',     icon: '♞', note: '15|10 or longer — no blitz/bullet.' },
  { id: 'analysis', label: 'Analyse your games', pct: 20, page: 'analyzer', icon: '⚡', note: 'Your own games first, especially losses.' },
  { id: 'tactics',  label: 'Tactics', pct: 15, page: 'tactics',  icon: '⚔', note: 'A variety of motifs, untimed.' },
  { id: 'strategy', label: 'Strategy / middlegame', pct: 10, page: 'openings', icon: '♜', note: 'Plans, imbalances, a strategy book.' },
  { id: 'endgames', label: 'Endgames', pct: 5,  page: 'endgames', icon: '♚', note: 'Opposition, zugzwang, key mating nets.' },
];
const emptyDay = () => ({ play: 0, analysis: 0, tactics: 0, strategy: 0, endgames: 0 });

export const useStats = create(
  persist(
    (set, get) => ({
      ...initial,

      solvePuzzle: (id) =>
        set((s) => {
          const today = dayKey();
          const solvedToday = s.todayKey === today ? s.solvedToday : [];
          if (solvedToday.includes(id)) return {};
          const yest = dayKey(new Date(Date.now() - 864e5));
          const newDay = s.lastSolvedDay !== today;
          const streak = newDay ? (s.lastSolvedDay === yest ? s.streak + 1 : 1) : s.streak;
          return {
            todayKey: today,
            solvedToday: [...solvedToday, id],
            tacticsSolved: s.tacticsSolved + 1,
            daily: { ...s.daily, [today]: (s.daily[today] || 0) + 1 },
            lastSolvedDay: today,
            streak,
            bestStreak: Math.max(s.bestStreak, streak),
          };
        }),

      failPuzzle: () => set((s) => ({ tacticsFailed: s.tacticsFailed + 1 })),

      studyLine: (id) =>
        set((s) => (s.linesStudied[id] ? {} : { linesStudied: { ...s.linesStudied, [id]: true } })),

      quizDone: (id, pct) =>
        set((s) => {
          const prev = s.srs[id] || { step: -1 };
          // success climbs one step; failure drops TWO steps (not to zero):
          // one mouse-slip shouldn't nuke 60 days of memory.
          const step = pct === 100 ? Math.min(prev.step + 1, SRS_STEPS.length - 1) : Math.max(0, prev.step - 2);
          return {
            quizBest: { ...s.quizBest, [id]: Math.max(s.quizBest[id] || 0, pct) },
            srs: { ...s.srs, [id]: { step, due: addDays(SRS_STEPS[step]) } },
          };
        }),

      // Elo-style puzzle rating: K=32 vs the puzzle's own rating.
      ratePuzzle: (puzzleElo, solved) =>
        set((s) => {
          const expected = 1 / (1 + Math.pow(10, (puzzleElo - s.puzzleRating) / 400));
          const next = Math.round(Math.max(400, s.puzzleRating + 32 * ((solved ? 1 : 0) - expected)));
          return {
            puzzleRating: next,
            puzzleRatingHistory: [...s.puzzleRatingHistory, next].slice(-50),
          };
        }),

      // personal puzzles harvested from analyzed games (dedup by fen, newest first, cap 100)
      addMyPuzzles: (list) =>
        set((s) => {
          const known = new Set(s.myPuzzles.map((p) => p.fen));
          const fresh = list.filter((p) => !known.has(p.fen));
          if (!fresh.length) return {};
          return { myPuzzles: [...fresh, ...s.myPuzzles].slice(0, 100) };
        }),
      removeMyPuzzle: (id) => set((s) => ({ myPuzzles: s.myPuzzles.filter((p) => p.id !== id) })),

      recordMotif: (motif, solved) =>
        set((s) => {
          const m = s.motifStats[motif] || { tries: 0, solved: 0 };
          return { motifStats: { ...s.motifStats, [motif]: { tries: m.tries + 1, solved: m.solved + (solved ? 1 : 0) } } };
        }),

      woodpeckerDone: (ms, errors) =>
        set((s) => ({ woodpecker: { cycles: [...s.woodpecker.cycles, { ms, errors, date: dayKey() }].slice(-20) } })),

      saveGame: (data) => set({ savedGame: data }),
      clearSavedGame: () => set({ savedGame: null }),

      recordGame: (botId, result, botElo) =>
        set((s) => {
          const r = s.vsRecord[botId] || { w: 0, d: 0, l: 0 };
          return {
            vsRecord: { ...s.vsRecord, [botId]: { ...r, [result]: r[result] + 1 } },
            bestWinElo: result === 'w' ? Math.max(s.bestWinElo, botElo) : s.bestWinElo,
          };
        }),

      analyzeDone: () => set((s) => ({ gamesAnalyzed: s.gamesAnalyzed + 1, lastAnalyzeDay: dayKey() })),
      drillDone: (id) => set((s) => ({ drillsDone: { ...s.drillsDone, [id]: (s.drillsDone[id] || 0) + 1 } })),

      // --- Training plan ---
      logStudy: (cat, mins) =>
        set((s) => {
          const today = dayKey();
          const d = s.studyLog[today] || emptyDay();
          return { studyLog: { ...s.studyLog, [today]: { ...d, [cat]: Math.max(0, (d[cat] || 0) + mins) } } };
        }),
      setWeeklyGoal: (h) => set({ weeklyGoalH: Math.max(1, h) }),
      startSession: (minutes, segments) => set({ session: { startedAt: Date.now(), minutes, segments } }),
      // end (or finish) a session, crediting the actually-spent minutes per category
      endSession: (credits) =>
        set((s) => {
          if (!s.session) return {};
          const today = dayKey();
          const d = { ...(s.studyLog[today] || emptyDay()) };
          for (const [cat, mins] of Object.entries(credits || {})) {
            const m = Math.round(mins);
            if (m > 0) d[cat] = Math.max(0, (d[cat] || 0) + m);
          }
          return { session: null, studyLog: { ...s.studyLog, [today]: d } };
        }),
      setDailyTacticGoal: (n) => set({ dailyTacticGoal: Math.max(1, n) }),
      recordSlowGame: () => set({ lastSlowGameDay: dayKey() }),

      // tally a game's mistake-motif counts into the cross-game profile
      recordWeaknesses: (counts) =>
        set((s) => {
          if (!counts || !Object.keys(counts).length) return {};
          const lifetime = { ...s.weaknessProfile.lifetime };
          for (const [k, v] of Object.entries(counts)) lifetime[k] = (lifetime[k] || 0) + v;
          const recent = [{ date: dayKey(), counts }, ...s.weaknessProfile.recent].slice(0, 30);
          return { weaknessProfile: { lifetime, recent } };
        }),
      rushDone: (score) => set((s) => ({ rushBest: Math.max(s.rushBest, score) })),

      addCustomLines: (lines) => set((s) => ({ customLines: [...s.customLines, ...lines] })),
      removeCustomLine: (id) => set((s) => ({ customLines: s.customLines.filter((l) => l.id !== id) })),

      toggleBlindfold: () => set((s) => ({ blindfold: !s.blindfold })),
      setLineArrows: (key, arrows) =>
        set((s) => ({ arrowsByLine: { ...s.arrowsByLine, [key]: arrows && arrows.length ? arrows : undefined } })),
      recordProfile: (moves, color) =>
        set((s) => {
          const count = [...s.cplProfile.count], sum = [...s.cplProfile.sum];
          for (const m of moves) {
            if (m.color !== color || m.cpl == null) continue;
            const b = Math.min(3, Math.floor(m.index / 20)); // 20 plies = 10 moves
            count[b] += 1; sum[b] += Math.min(500, m.cpl);
          }
          return { cplProfile: { count, sum } };
        }),

      resetAll: () => set({ ...initial }),
    }),
    { name: 'chesslab_stats_v2' }
  )
);

// SRS helper: is this line due for review?
export function lineDue(srs, id) {
  const e = srs[id];
  if (!e) return true;               // never quizzed -> due
  return e.due <= dayKey();
}
export function srsLabel(srs, id) {
  const e = srs[id];
  if (!e) return 'new';
  return e.due <= dayKey() ? 'due' : `next: ${e.due.slice(5)}`;
}

// The 7 day-keys of the rolling week (oldest first, today last).
export function weekKeys() {
  return [...Array(7)].map((_, i) => dayKey(new Date(Date.now() - (6 - i) * 864e5)));
}
// Cross-game weakness profile helpers.
// Lifetime motifs, most-frequent first: [[motif, count], ...]
export function weaknessTop(weaknessProfile, n = 5) {
  const lt = (weaknessProfile && weaknessProfile.lifetime) || {};
  return Object.entries(lt).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
}
// Motif counts over the most recent N analyzed games (the "are you fixing it?" window).
export function weaknessRecent(weaknessProfile, games = 5) {
  const recent = (weaknessProfile && weaknessProfile.recent) || [];
  const out = {};
  for (const g of recent.slice(0, games)) for (const [k, v] of Object.entries(g.counts || {})) out[k] = (out[k] || 0) + v;
  return out;
}

// Sum logged study minutes per category over the rolling week.
export function weekStudy(studyLog) {
  const out = { play: 0, analysis: 0, tactics: 0, strategy: 0, endgames: 0 };
  for (const k of weekKeys()) {
    const d = studyLog && studyLog[k];
    if (!d) continue;
    for (const c of Object.keys(out)) out[c] += d[c] || 0;
  }
  return out;
}
