// Promise-based client for the engine Web Worker (inlined into the single-file build).
import EngineWorker from './engineWorker.js?worker&inline';

let worker = null, seq = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new EngineWorker();
    worker.onmessage = (e) => {
      const { id, type, value } = e.data;
      const p = pending.get(id);
      if (!p) return;
      if (type === 'progress') { p.onProgress && p.onProgress(value); return; }
      pending.delete(id);
      if (type === 'result') p.resolve(value); else p.reject(new Error(value));
    };
  }
  return worker;
}

export function engineCall(cmd, payload, onProgress) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, cmd, payload });
  });
}

export const engineBest = (fen, opts) => engineCall('best', { fen, opts });
export const engineAnalyze = (pgn, color, onProgress) => engineCall('analyze', { pgn, color }, onProgress);
export const enginePv = (fen, plies, depth) => engineCall('pv', { fen, plies, depth });
