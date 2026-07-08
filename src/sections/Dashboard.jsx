import React from 'react';
import { PUZZLES } from '../data/puzzles.js';
import { OPENINGS } from '../data/openings.js';
import { mergeOpenings } from '../data/openings2.js';
import { DRILLS } from '../data/endgames.js';
import { BOTS } from '../data/bots.js';
import { useStats, dayKey, lineDue, weaknessTop, weaknessRecent } from '../store.js';
import { MOTIF_META } from '../motifs.js';
import { useUi } from '../settings.js';

function Sparkline({ data, w = 220, h = 44 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, display: 'block', marginTop: 8 }}>
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="1.8" />
    </svg>
  );
}

export default function Dashboard() {
  const s = useStats();
  const setPage = useUi((u) => u.setPage);
  const ALL = mergeOpenings(OPENINGS, s.customLines);
  const totalLines = ALL.reduce((n, o) => n + o.lines.length, 0);
  const studied = Object.keys(s.linesStudied).length;
  const quizzed = Object.keys(s.quizBest).length;
  const drillsDone = Object.keys(s.drillsDone).length;
  const today = dayKey();
  const solvedToday = s.todayKey === today ? s.solvedToday.length : 0;
  const dueLines = ALL.reduce((acc, o) => acc + o.lines.filter((l) => lineDue(s.srs, l.id)).length, 0);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    return { label: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()], v: s.daily[dayKey(d)] || 0 };
  });
  const maxV = Math.max(1, ...days.map((d) => d.v));
  const accuracy = s.tacticsSolved + s.tacticsFailed > 0
    ? Math.round((100 * s.tacticsSolved) / (s.tacticsSolved + s.tacticsFailed)) : null;
  const vsTotals = Object.values(s.vsRecord).reduce((a, r) => ({ w: a.w + r.w, d: a.d + r.d, l: a.l + r.l }), { w: 0, d: 0, l: 0 });
  const gamesVsBots = vsTotals.w + vsTotals.d + vsTotals.l;

  return (
    <div>
      <h1 className="page-title">Progress <span className="accent">Dashboard</span></h1>
      <p className="page-sub">The numbers that matter. Nothing else.</p>

      {(() => {
        // Coach du jour — the daily plan, computed from your actual state
        const puzzlesLeft = Math.max(0, 3 - solvedToday);
        const nextBot = BOTS.find((b) => b.elo > s.bestWinElo) || BOTS[BOTS.length - 1];
        const leastDrill = DRILLS.reduce((min, d) => ((s.drillsDone[d.id] || 0) < (s.drillsDone[min.id] || 0) ? d : min), DRILLS[0]);
        const items = [
          { done: puzzlesLeft === 0, label: puzzlesLeft === 0 ? 'Daily puzzles ✓' : `Solve today's ${puzzlesLeft} puzzle${puzzlesLeft > 1 ? 's' : ''}`, page: 'tactics' },
          { done: dueLines === 0, label: dueLines === 0 ? 'Opening reviews ✓' : `Daily drill: ${dueLines} line${dueLines > 1 ? 's' : ''} due (SRS)`, page: 'openings' },
          { done: false, label: `Play ${nextBot.emoji} ${nextBot.name} (${nextBot.elo === 3200 ? 'MAX' : nextBot.elo}) — your next ladder step`, page: 'play' },
          { done: false, label: `One endgame drill: ${leastDrill.name}`, page: 'endgames' },
        ];
        return (
          <div className="panel" style={{ marginBottom: 18, maxWidth: 640, borderColor: 'var(--gold)' }}>
            <h3>🎯 Coach du jour</h3>
            {items.map((it, i) => (
              <p key={i} className="small" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '7px 0' }}>
                <span style={{ width: 18 }}>{it.done ? '✅' : '⬜'}</span>
                <span style={{ flex: 1, textDecoration: it.done ? 'line-through' : 'none', color: it.done ? 'var(--muted)' : 'var(--text)' }}>{it.label}</span>
                {!it.done && <button className="btn" style={{ padding: '2px 12px' }} onClick={() => setPage(it.page)}>Go →</button>}
              </p>
            ))}
          </div>
        );
      })()}

      <div className="stat-grid">
        <div className="stat-card"><div className="v">{s.puzzleRating}</div><div className="l">⚡ PUZZLE RATING<Sparkline data={s.puzzleRatingHistory} /></div></div>
        <div className="stat-card"><div className="v">{gamesVsBots ? `+${vsTotals.w} =${vsTotals.d} −${vsTotals.l}` : '—'}</div><div className="l">🤖 VS BOTS{s.bestWinElo ? ` · BEST WIN ${s.bestWinElo === 3200 ? 'MAX' : s.bestWinElo}` : ''}</div></div>
        <div className="stat-card"><div className="v">{s.streak}<small> days</small></div><div className="l">🔥 TACTICS STREAK (best: {s.bestStreak})</div></div>
        <div className="stat-card"><div className="v">{solvedToday}<small> / 3</small></div><div className="l">TODAY'S PUZZLES</div></div>
        <div className="stat-card"><div className="v">{s.rushBest}</div><div className="l">⚡ TIME RUSH RECORD</div></div>
        <div className="stat-card"><div className="v">{s.tacticsSolved}</div><div className="l">PUZZLES SOLVED{accuracy != null ? ` · ${accuracy}% first-try` : ''}</div></div>
        <div className="stat-card"><div className="v">{dueLines}</div><div className="l">📅 LINES DUE FOR REVIEW (SRS)</div></div>
        <div className="stat-card"><div className="v">{studied}<small> / {totalLines}</small></div><div className="l">LINES STUDIED</div></div>
        <div className="stat-card"><div className="v">{quizzed}<small> / {totalLines}</small></div><div className="l">LINES QUIZ-TESTED</div></div>
        <div className="stat-card"><div className="v">{s.gamesAnalyzed}</div><div className="l">GAMES ANALYZED</div></div>
        <div className="stat-card"><div className="v">{drillsDone}<small> / {DRILLS.length}</small></div><div className="l">ENDGAME DRILLS MASTERED</div></div>
        <div className="stat-card"><div className="v">{PUZZLES.length}</div><div className="l">PATTERNS IN THE LIBRARY</div></div>
      </div>

      <div className="panel" style={{ marginTop: 18, maxWidth: 520 }}>
        <h3>Tactics — last 7 days</h3>
        <div className="bars">
          {days.map((d, i) => (
            <div className="bar-wrap" key={i}>
              <div className="bar" style={{ height: `${(d.v / maxV) * 100}%`, opacity: d.v ? 1 : 0.18 }} />
              <div className="bl">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18, maxWidth: 560 }}>
        <h3>Weakness heatmap — avg centipawn loss by game phase</h3>
        {s.cplProfile.count.every((c) => !c) ? (
          <p className="small muted">Analyze a few games (Game Analyzer) and your weak phase shows up here.</p>
        ) : (() => {
          const labels = ['Moves 1-10', '11-20', '21-30', '31+'];
          const avgs = s.cplProfile.count.map((c, i) => (c ? Math.round(s.cplProfile.sum[i] / c) : 0));
          const maxA = Math.max(1, ...avgs);
          const worst = avgs.indexOf(Math.max(...avgs));
          const advice = ['your opening prep — drill the Opening Explorer quizzes', 'early middlegame tactics — push the Tactics Trainer streak', 'late middlegame decisions — analyze more of your games', 'endgame technique — hit the Endgame Drills'][worst];
          return (
            <>
              <div className="bars" style={{ height: 70 }}>
                {avgs.map((a, i) => (
                  <div className="bar-wrap" key={i}>
                    <div className="bar" style={{ height: `${(a / maxA) * 100}%`, opacity: a ? 1 : 0.18, background: i === worst ? 'linear-gradient(180deg,#e06c6c,#a84444)' : undefined }} />
                    <div className="bl">{labels[i]}<br />{a} cp</div>
                  </div>
                ))}
              </div>
              <p className="small" style={{ marginTop: 10 }}>📌 You bleed the most in <b>{labels[worst].toLowerCase()}</b> — focus on {advice}.</p>
            </>
          );
        })()}
      </div>

      {(() => {
        const top = weaknessTop(s.weaknessProfile, 6);
        if (!top.length) return null;
        const recent = weaknessRecent(s.weaknessProfile, 5);
        const maxC = Math.max(...top.map(([, c]) => c));
        const lead = MOTIF_META[top[0][0]];
        return (
          <div className="panel" style={{ marginTop: 18, maxWidth: 560 }}>
            <h3>Recurring weaknesses — from your analyzed games</h3>
            {top.map(([k, c]) => {
              const mm = MOTIF_META[k]; if (!mm) return null;
              const rc = recent[k] || 0;
              return (
                <div key={k} style={{ margin: '9px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span className="small"><span style={{ marginRight: 5 }}>{mm.icon}</span><b>{mm.label}</b></span>
                    <span className="small muted" style={{ fontFamily: 'var(--mono)' }}>{c}× {rc > 0 && <span className="chip red" style={{ marginLeft: 6, padding: '1px 7px' }}>{rc} recent</span>}</span>
                  </div>
                  <div className="train-cat-bar" style={{ marginTop: 4 }}><div style={{ width: `${(c / maxC) * 100}%`, background: 'linear-gradient(90deg,var(--bad),#e58f2a)' }} /></div>
                </div>
              );
            })}
            <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>📌 Your biggest leak is <b>{lead.label.toLowerCase()}</b> — {lead.advice}</p>
          </div>
        );
      })()}

      {gamesVsBots > 0 && (
        <div className="panel" style={{ marginTop: 18, maxWidth: 560 }}>
          <h3>Bot ladder</h3>
          {BOTS.filter((b) => s.vsRecord[b.id]).map((b) => {
            const r = s.vsRecord[b.id];
            return (
              <p key={b.id} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span className="muted">{b.emoji} {b.name} ({b.elo === 3200 ? 'MAX' : b.elo})</span>
                <span><b style={{ color: 'var(--good)' }}>+{r.w}</b> <span className="muted">={r.d}</span> <b style={{ color: 'var(--bad)' }}>−{r.l}</b></span>
              </p>
            );
          })}
        </div>
      )}

      <div className="panel" style={{ marginTop: 18, maxWidth: 560 }}>
        <h3>Repertoire — quiz scores & next review</h3>
        {quizzed === 0 && <p className="small muted">No quizzes yet — Opening Explorer → "Quiz me".</p>}
        {ALL.map((o) =>
          o.lines.filter((l) => s.quizBest[l.id] != null).map((l) => (
            <p key={l.id} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span className="muted">{o.name} — {l.name}</span>
              <span>
                {lineDue(s.srs, l.id) ? <span className="chip red" style={{ marginRight: 8 }}>due</span> : null}
                <b style={{ color: s.quizBest[l.id] === 100 ? 'var(--good)' : 'var(--gold-soft)' }}>{s.quizBest[l.id]}%</b>
              </span>
            </p>
          ))
        )}
      </div>

      <div className="btn-row" style={{ marginTop: 20 }}>
        <button className="btn" onClick={() => { if (confirm('Reset all progress?')) s.resetAll(); }}>Reset all progress</button>
      </div>
    </div>
  );
}
