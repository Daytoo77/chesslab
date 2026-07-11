// Two-sided game clock: ticking, switching on move, and flag detection.
// Pure timing/state concern — knows nothing about chess rules. Extracted from
// Play.jsx so the clock can be read/reasoned about on its own.
import { useEffect, useRef, useState } from 'react';

export const TIME_CONTROLS = [
  { id: 'none', label: '∞ Casual', ms: null, inc: 0 },
  { id: '3+2', label: '3+2 Blitz', ms: 180e3, inc: 2e3 },
  { id: '5+0', label: '5 min Blitz', ms: 300e3, inc: 0 },
  { id: '10+0', label: '10 min Rapid', ms: 600e3, inc: 0 },
  { id: '15+10', label: '15+10 Rapid', ms: 900e3, inc: 10e3 },
];

export function fmtClock(ms) {
  if (ms == null) return '--:--';
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  if (ms < 20e3) return `${Math.floor(s / 60)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// `active`: gate the tick interval (e.g. phase === 'playing').
// `userColor`: whose low-time warning to fire for.
// `onFlag(color)`: called once when that side's clock hits zero.
// `onLowTime()`: called once when the user's own clock crosses 10s.
export function useGameClock({ active, userColor, onFlag, onLowTime }) {
  const [clocks, setClocks] = useState({ w: null, b: null });
  const clockRef = useRef({ w: null, b: null, inc: 0, runningSince: null, turn: 'w' });
  const lowTimeWarned = useRef(false);
  const flaggedRef = useRef(false);

  // Intentionally no dependency array — re-arms every render, matching the
  // original Play.jsx behavior (harmless: it clears the previous interval).
  useEffect(() => {
    if (!active || clockRef.current.w == null) return;
    const iv = setInterval(() => {
      const c = clockRef.current;
      if (c.runningSince == null || flaggedRef.current) return;
      const elapsed = Date.now() - c.runningSince;
      const remain = c[c.turn] - elapsed;
      setClocks({ w: c.turn === 'w' ? remain : c.w, b: c.turn === 'b' ? remain : c.b });
      if (remain <= 10e3 && !lowTimeWarned.current && c.turn === userColor) {
        lowTimeWarned.current = true;
        onLowTime && onLowTime();
      }
      if (remain <= 0) {
        c[c.turn] = 0;
        c.runningSince = null;
        flaggedRef.current = true;
        onFlag && onFlag(c.turn);
      }
    }, 100);
    return () => clearInterval(iv);
  });

  function start(tc, turn) {
    lowTimeWarned.current = false;
    flaggedRef.current = false;
    clockRef.current = { w: tc.ms, b: tc.ms, inc: tc.inc, runningSince: tc.ms ? Date.now() : null, turn };
    setClocks({ w: tc.ms, b: tc.ms });
  }

  // resume from a persisted snapshot (or fall back to a fresh clock for `tc`)
  function resume(saved, tc, turn) {
    lowTimeWarned.current = false;
    flaggedRef.current = false;
    clockRef.current = {
      w: saved ? saved.w : tc.ms, b: saved ? saved.b : tc.ms,
      inc: tc.inc, runningSince: (saved && saved.w != null) ? Date.now() : null, turn,
    };
    setClocks({ w: clockRef.current.w, b: clockRef.current.b });
  }

  function stop() { clockRef.current.runningSince = null; }

  function switchTurn(moverColor) {
    const c = clockRef.current;
    if (c.w == null) return;
    if (c.runningSince != null) {
      c[moverColor] = Math.max(0, c[moverColor] - (Date.now() - c.runningSince)) + c.inc;
    }
    c.turn = moverColor === 'w' ? 'b' : 'w';
    c.runningSince = Date.now();
    setClocks({ w: c.w, b: c.b });
  }

  // a live-corrected reading, for persistence (accounts for time since the last switch)
  function snapshot() {
    const c = clockRef.current;
    return {
      w: c.runningSince != null && c.turn === 'w' ? c.w - (Date.now() - c.runningSince) : c.w,
      b: c.runningSince != null && c.turn === 'b' ? c.b - (Date.now() - c.runningSince) : c.b,
    };
  }

  return { clocks, clockRef, start, resume, stop, switchTurn, snapshot };
}
