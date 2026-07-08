import { useEffect, useRef, useState } from 'react';
import { getBoardEngine } from './stockfish.js';

// Live deepening analysis of one position (the analysis board). Returns
// { lines, depth } updating as the engine thinks; restarts cleanly whenever the
// fen changes. lines are raw { depth, cp, mate, pv } (side-to-move POV).
// UI updates are throttled (~5/s) — the engine emits dozens of info lines a
// second and re-rendering on every one janks the page.
export function useBoardEngine(fen, enabled, multipv = 3) {
  const [data, setData] = useState({ lines: [], depth: 0 });
  const handleRef = useRef(null);
  const engRef = useRef(null);

  useEffect(() => {
    if (!enabled || !fen) { setData({ lines: [], depth: 0 }); return; }
    let cancelled = false;
    let pending = null;
    setData({ lines: [], depth: 0 });
    const flush = setInterval(() => { if (pending && !cancelled) { setData(pending); pending = null; } }, 200);
    (async () => {
      try { if (!engRef.current) engRef.current = await getBoardEngine(); }
      catch { return; }
      if (cancelled) return;
      const eng = engRef.current;
      if (handleRef.current) { try { await handleRef.current.stop(); } catch { /* ignore */ } }
      if (cancelled) return;
      handleRef.current = eng.analyzeLive(fen, { multipv, depth: 28 }, (lines, depth) => {
        if (!cancelled) pending = { lines: lines.map((l) => ({ ...l })), depth };
      });
    })();
    return () => {
      cancelled = true;
      clearInterval(flush);
      if (handleRef.current) { try { handleRef.current.stop(); } catch { /* ignore */ } }
    };
  }, [fen, enabled, multipv]);

  return data;
}
