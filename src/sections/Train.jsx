// "Training Plan" — the structured improvement program, turned into live,
// tracked tools. Every section here maps directly to the classic /r/chess
// "How to get better at chess" guide: the weekly 50/20/15/10/5 study split,
// the daily tactics habit, the in-game thinking checklist, middlegame planning,
// endgame essentials, opening principles, and "analyse your own games first".
import React, { useEffect, useMemo, useState } from 'react';
import { useStats, dayKey, weekKeys, weekStudy, weaknessTop, weaknessRecent, lineDue, STUDY_CATS } from '../store.js';
import { MOTIF_META } from '../motifs.js';
import { buildDailyQueue, buildSession, sessionProgress } from '../queue.js';
import { OPENINGS } from '../data/openings.js';
import { mergeOpenings } from '../data/openings2.js';
import { useUi } from '../settings.js';

const fmtMin = (m) => {
  m = Math.round(m);
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`;
};

// every-move thinking routine (most forcing first), straight from the guide
const CHECKLIST = [
  ['Checks', 'Can I give check — does any check actually achieve something?'],
  ['Threats to me', 'Am I in danger of being checked or losing material next move?'],
  ['Hanging pieces', 'Is anything of mine — or my opponent\'s — undefended or under-defended?'],
  ['Tactics', 'Any fork, pin, skewer, discovered attack or double attack in the position?'],
  ['Activity', 'Can I put a piece on a better square, an outpost, or an open file?'],
  ['Pawn levers', 'Can I blockade an enemy knight/bishop, or break with a pawn push?'],
];

const PLAN_STEPS = [
  ['Find the imbalances', 'Weak squares, hanging or passive pieces, pawn weaknesses, space, the bishop pair.'],
  ['Pick a target & wing', 'Decide where you play — kingside, queenside or centre — based on those imbalances.'],
  ['Place your pieces', 'Identify the best square for each piece to exploit the imbalance.'],
  ['Candidate moves → calculate', 'List the moves that get you there, calculate each, play the one that works — then re-evaluate after the reply.'],
];

const ENDGAME_KEYS = [
  ['Opposition', 'Kings facing off with one square between — the side NOT to move is squeezed back. The key to K+P endings.'],
  ['Zugzwang', 'A position where any move worsens your stance — you\'d love to pass, but you can\'t.'],
  ['Triangulation', 'Lose a tempo with the king (a 3-square loop) to hand the opponent the zugzwang.'],
  ['Outflanking', 'Side-step with the king to gain ground when you can\'t take the direct opposition.'],
];

const PRINCIPLES = [
  'Develop a new piece every move in the opening.',
  'Fight for the centre with pawns and pieces.',
  'Don\'t move the same minor piece twice early.',
  'Castle early — get your king safe.',
  'Connect your rooks; put them on open files.',
];

export default function Train() {
  const s = useStats();
  const setPage = useUi((u) => u.setPage);
  const requestTactics = useUi((u) => u.requestTactics);
  const today = dayKey();

  // --- weekly study plan (logged minutes vs the recommended split) ---
  const logged = weekStudy(s.studyLog);
  const totalLogged = Object.values(logged).reduce((a, b) => a + b, 0);
  const goalMin = s.weeklyGoalH * 60;
  const totalPct = Math.min(100, Math.round((totalLogged / goalMin) * 100));

  // --- today's habits, derived from real state ---
  const solvedToday = s.todayKey === today ? s.solvedToday.length : 0;
  const tacticPct = Math.min(100, Math.round((solvedToday / s.dailyTacticGoal) * 100));
  const slowGameDone = s.lastSlowGameDay === today;
  const analyzedToday = s.lastAnalyzeDay === today;

  // puzzles actually solved across the rolling week (honest count from `daily`)
  const puzzlesThisWeek = weekKeys().reduce((n, k) => n + (s.daily[k] || 0), 0);

  const [openChecklist, setOpenChecklist] = useState(true);

  // your #1 recurring leak across analyzed games (from the motif profile)
  const topWeak = weaknessTop(s.weaknessProfile, 1)[0];
  const topMeta = topWeak ? MOTIF_META[topWeak[0]] : null;

  // ----- the personalized "Do this now" queue -----
  const dueLines = useMemo(
    () => mergeOpenings(OPENINGS, s.customLines).reduce((n, o) => n + o.lines.filter((l) => lineDue(s.srs, l.id)).length, 0),
    [s.customLines, s.srs]
  );
  const queue = buildDailyQueue({
    dueLines,
    solvedToday,
    dailyTacticGoal: s.dailyTacticGoal,
    topWeakness: topWeak || null,
    recentWeaknessCount: topWeak ? (weaknessRecent(s.weaknessProfile, 5)[topWeak[0]] || 0) : 0,
    analyzedToday,
    slowGameToday: slowGameDone,
  });
  const goQueue = (t) => (t.motif ? requestTactics({ motif: t.motif }) : setPage(t.page));

  // ----- guided session: tick every 20s while one is running -----
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!s.session) return;
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, [s.session]);
  const prog = s.session ? sessionProgress(s.session, now) : null;

  const habits = [
    { done: tacticPct >= 100, label: `Solve ${s.dailyTacticGoal} tactics`, sub: `${solvedToday} / ${s.dailyTacticGoal} today`, page: 'tactics', pct: tacticPct },
    { done: slowGameDone, label: 'Play one slow game', sub: slowGameDone ? 'done today ✓' : '15|10 or longer', page: 'play', pct: slowGameDone ? 100 : 0 },
    { done: analyzedToday, label: 'Analyse a game', sub: analyzedToday ? 'done today ✓' : 'especially a loss', page: 'analyzer', pct: analyzedToday ? 100 : 0 },
  ];
  const habitsDone = habits.filter((h) => h.done).length;

  return (
    <div style={{ maxWidth: 920 }}>
      <h1 className="page-title">Training <span className="accent">Plan</span></h1>
      <p className="page-sub">
        A structured program beats random play. This turns the classic improvement routine into something you can
        actually track — log your week, keep the daily habit, and carry the thinking checklist into every game.
      </p>

      {/* ---------- Guided session ---------- */}
      <div className="panel" style={{ marginBottom: 16 }}>
        {!s.session ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>⏱ Training session</h3>
              <p className="small muted" style={{ margin: '4px 0 0' }}>A guided block: tactics → game review → openings → endgames. Time is logged to your weekly plan automatically.</p>
            </div>
            <div className="btn-row" style={{ marginTop: 0 }}>
              {[15, 30, 45].map((m) => (
                <button key={m} className={`btn ${m === 30 ? 'primary' : ''}`} onClick={() => s.startSession(m, buildSession(m))}>{m} min</button>
              ))}
            </div>
          </div>
        ) : prog && prog.done ? (
          <div className="banner ok big">
            🏁 <b>Session complete — {prog.totalMin} minutes.</b> Every segment is being logged to your weekly plan.
            <div className="btn-row">
              <button className="btn primary" onClick={() => s.endSession(prog.perCat)}>Log it ✓</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0 }}>⏱ Session running <span className="chip teal" style={{ marginLeft: 6 }}>{Math.round(prog.elapsedMin)} / {prog.totalMin} min</span></h3>
              <button className="btn btn-mini" onClick={() => s.endSession(prog.perCat)}>■ End early (logs {Math.round(prog.elapsedMin)} min)</button>
            </div>
            <div className="progressbar" style={{ marginTop: 10 }}><div style={{ width: `${prog.pct}%` }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {s.session.segments.map((seg, i) => {
                const state = prog.current === i ? 'now' : i < (prog.current ?? s.session.segments.length) ? 'done' : 'next';
                return (
                  <div key={seg.cat} className="queue-item" style={{ opacity: state === 'next' ? 0.55 : 1, borderColor: state === 'now' ? 'var(--gold)' : undefined }}>
                    <span className="queue-icon">{state === 'done' ? '✓' : seg.icon}</span>
                    <span style={{ flex: 1 }}>
                      <b>{seg.label}</b>
                      <span className="small muted"> — {seg.minutes} min{state === 'now' ? ` · ${Math.max(1, Math.round(seg.minutes - prog.segElapsed))} left` : ''}</span>
                    </span>
                    {state === 'now' && <button className="btn btn-mini primary" onClick={() => setPage(seg.page)}>Go →</button>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ---------- Do this now — the personalized queue ---------- */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>🎯 Do this now <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>— ranked by what moves your rating today</span></h3>
        {queue.length === 0 ? (
          <p className="small" style={{ color: 'var(--good)', margin: '10px 0 0' }}>✓ Everything done — goals hit, nothing due, habits complete. Enjoy a casual game.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {queue.map((t, i) => (
              <div key={t.id} className="queue-item">
                <span className="queue-rank">{i + 1}</span>
                <span className="queue-icon">{t.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{t.label}</b>
                  <span className="small muted"> — {t.sub}</span>
                </span>
                <button className="btn btn-mini" onClick={() => goQueue(t)}>Go →</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Your #1 leak (from the cross-game motif profile) ---------- */}
      {topMeta && (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'rgba(248,113,113,0.4)' }}>
          <h3 style={{ color: 'var(--bad)' }}>Your #1 leak — fix this first</h3>
          <p style={{ margin: '0 0 4px' }}><span style={{ fontSize: 18, marginRight: 6 }}>{topMeta.icon}</span><b>{topMeta.label}</b> <span className="muted">· flagged {topWeak[1]}× across your analyzed games</span></p>
          <p className="small" style={{ margin: '6px 0 12px' }}>{topMeta.advice}</p>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button className="btn btn-mini" onClick={() => setPage('tactics')}>Drill tactics →</button>
            <button className="btn btn-mini" onClick={() => setPage('analyzer')}>Review a game →</button>
          </div>
        </div>
      )}

      {/* ---------- Weekly study plan ---------- */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>This week's study plan</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="small muted">Weekly goal</span>
            <select
              value={s.weeklyGoalH}
              onChange={(e) => s.setWeeklyGoal(+e.target.value)}
              style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, font: 'inherit', fontSize: 13, padding: '4px 8px' }}
            >
              {[4, 7, 10, 14, 21].map((h) => <option key={h} value={h}>{h} h / week</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 0 6px' }}>
          <span className="small muted">Logged this week</span>
          <span className="small"><b style={{ color: totalPct >= 100 ? 'var(--good)' : 'var(--gold)' }}>{fmtMin(totalLogged)}</b> <span className="muted">/ {s.weeklyGoalH}h · {totalPct}%</span></span>
        </div>
        <div className="progressbar"><div style={{ width: `${totalPct}%`, background: totalPct >= 100 ? 'linear-gradient(90deg,var(--teal),var(--good))' : undefined }} /></div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STUDY_CATS.map((c) => {
            const rec = goalMin * c.pct / 100;
            const got = logged[c.id] || 0;
            const pct = Math.min(100, Math.round((got / Math.max(1, rec)) * 100));
            const met = got >= rec;
            return (
              <div key={c.id} className="train-cat">
                <div className="train-cat-head">
                  <span className="train-cat-title"><span className="train-cat-icon">{c.icon}</span> {c.label} <span className="muted" style={{ fontWeight: 500 }}>· {c.pct}%</span></span>
                  <span className="small" style={{ fontFamily: 'var(--mono)', color: met ? 'var(--good)' : 'var(--muted)' }}>
                    {fmtMin(got)} <span className="muted">/ {fmtMin(rec)}</span>
                  </span>
                </div>
                <div className="train-cat-bar"><div style={{ width: `${pct}%`, background: met ? 'var(--good)' : undefined }} /></div>
                <div className="train-cat-foot">
                  <span className="small muted train-cat-note">{c.note}</span>
                  <span className="train-cat-actions">
                    <button className="btn btn-mini" title="Log 15 min" onClick={() => s.logStudy(c.id, 15)}>+15m</button>
                    <button className="btn btn-mini" title="Log 30 min" onClick={() => s.logStudy(c.id, 30)}>+30m</button>
                    {got > 0 && <button className="btn btn-mini" title="Remove 15 min" onClick={() => s.logStudy(c.id, -15)}>−</button>}
                    <button className="btn btn-mini" onClick={() => setPage(c.page)}>Go →</button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 14, marginBottom: 0 }}>
          The 50 / 20 / 15 / 10 / 5 split comes from the standard improvement guide — work on <i>every</i> part of your game,
          not just openings. Log time as you study; the bars fill toward each category's share of your weekly goal.
        </p>
      </div>

      {/* ---------- Today's habits ---------- */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Today's habits</h3>
          <span className="small">
            {s.streak > 0 && <span className="chip" style={{ marginRight: 8 }}>🔥 {s.streak}-day streak</span>}
            <span className="muted">{puzzlesThisWeek} puzzles this week</span>
          </span>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {habits.map((h, i) => (
            <div key={i} className="habit-row">
              <span className="habit-check" style={{ color: h.done ? 'var(--good)' : 'var(--sub)' }}>{h.done ? '✓' : '○'}</span>
              <span style={{ flex: 1 }}>
                <span style={{ textDecoration: h.done ? 'line-through' : 'none', color: h.done ? 'var(--muted)' : 'var(--text)', fontWeight: 600 }}>{h.label}</span>
                <span className="small muted"> — {h.sub}</span>
              </span>
              {!h.done && <button className="btn btn-mini" onClick={() => setPage(h.page)}>Go →</button>}
            </div>
          ))}
        </div>
        <div className="progressbar" style={{ marginTop: 12 }}><div style={{ width: `${(habitsDone / habits.length) * 100}%`, background: habitsDone === habits.length ? 'linear-gradient(90deg,var(--teal),var(--good))' : undefined }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <span className="small muted">Daily tactics goal</span>
          <select
            value={s.dailyTacticGoal}
            onChange={(e) => s.setDailyTacticGoal(+e.target.value)}
            style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, font: 'inherit', fontSize: 13, padding: '3px 8px' }}
          >
            {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} / day</option>)}
          </select>
          <span className="small muted">— the guide recommends at least 10.</span>
        </div>
      </div>

      {/* ---------- The thinking checklist ---------- */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpenChecklist((o) => !o)}>
          <h3 style={{ margin: 0 }}>The thinking checklist <span className="muted" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>— run it every move</span></h3>
          <span className="muted">{openChecklist ? '▾' : '▸'}</span>
        </div>
        {openChecklist && (
          <>
            <ol className="checklist">
              {CHECKLIST.map(([k, v]) => (
                <li key={k}><b>{k}.</b> {v}</li>
              ))}
            </ol>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Start with the most forcing moves. With practice you'll run this faster and with fewer errors.
              It's also available as a one-tap aid on the board while you play.
            </p>
          </>
        )}
      </div>

      {/* ---------- Middlegame plan + endgames (two columns) ---------- */}
      <div className="train-two">
        <div className="panel">
          <h3>Enter the middlegame with a plan</h3>
          <p className="small muted" style={{ marginTop: 0 }}>A bad plan beats no plan. Once developed and castled:</p>
          <ol className="checklist tight">
            {PLAN_STEPS.map(([k, v]) => (
              <li key={k}><b>{k}</b> — {v}</li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Endgame essentials</h3>
            <button className="btn btn-mini" onClick={() => setPage('endgames')}>Drill →</button>
          </div>
          <dl className="defs">
            {ENDGAME_KEYS.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>
      </div>

      {/* ---------- Principles + openings ---------- */}
      <div className="train-two" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>Opening principles</h3>
          <ul className="checklist tight">
            {PRINCIPLES.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="small" style={{ marginBottom: 0 }}>
            <b style={{ color: 'var(--good)' }}>Favour</b> <span className="muted">theory-light lines — Italian, Scotch, Queen's Gambit, 1…e5, QGD.</span><br />
            <b style={{ color: 'var(--bad)' }}>Avoid</b> <span className="muted">theory mazes (Sicilian, King's Gambit, Grünfeld) and centre-ceding setups (KID/Modern) until stronger.</span>
          </p>
        </div>
        <div className="panel">
          <h3>Analyse your own games first</h3>
          <p className="small" style={{ marginTop: 0 }}>
            Going over your games — <b>especially your losses</b> — is where the points come from. For each mistake ask:
            <i> why</i> did I play it, does it recur, and how will I think differently next time?
          </p>
          <p className="small muted">
            Don't lean on the engine as a crutch: form your <i>own</i> assessment first, <i>then</i> check.
            The Game Analyzer has an "assess first" mode that hides the engine until you commit a verdict.
          </p>
          <button className="btn" onClick={() => setPage('analyzer')}>Open the Analyzer →</button>
        </div>
      </div>
    </div>
  );
}
