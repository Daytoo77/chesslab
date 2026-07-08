// Web Worker entry: all heavy search runs here, off the main thread.
import { searchPosition, analyzeGame, getPv } from './engine.js';

self.onmessage = (e) => {
  const { id, cmd, payload } = e.data;
  try {
    if (cmd === 'analyze') {
      let lastPost = 0;
      const res = analyzeGame(payload.pgn, payload.color, (p) => {
        const now = Date.now();
        if (now - lastPost > 80 || p >= 1) { lastPost = now; self.postMessage({ id, type: 'progress', value: p }); }
      });
      self.postMessage({ id, type: 'result', value: res });
    } else if (cmd === 'best') {
      const r = searchPosition(payload.fen, payload.opts || {});
      self.postMessage({
        id, type: 'result',
        value: { move: r.move ? { from: r.move.from, to: r.move.to, san: r.move.san } : null, score: r.score },
      });
    } else if (cmd === 'pv') {
      self.postMessage({ id, type: 'result', value: getPv(payload.fen, payload.plies || 3, payload.depth || 2) });
    } else {
      self.postMessage({ id, type: 'error', value: 'unknown cmd ' + cmd });
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', value: String((err && err.message) || err) });
  }
};
