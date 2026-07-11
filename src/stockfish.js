// Tiered Stockfish loader:
//  0. Stockfish 17.1 lite (NNUE) EMBEDDED in the bundle — works offline, even
//     from a double-clicked .html file. This *is* the local engine now.
//  1. Same engine served from ./engine/ (classic worker, when hosted).
//  2. Same engine from CDN.
//  3. Stockfish 10 (asm.js) from CDN.
// The wasm path is passed to the worker via the URL hash: '#<wasmUrl>,worker'
// — the loader's official mechanism (nmrugg/stockfish.js).
import SF17_JS_TEXT from './engine-bin/stockfish-17.1-lite-single-03e3232.js?raw';
import SF17_WASM_ASSET from './engine-bin/stockfish-17.1-lite-single-03e3232.wasm?url';

const SF17_JS = 'stockfish-17.1-lite-single-03e3232.js';
const SF17_WASM = 'stockfish-17.1-lite-single-03e3232.wasm';
const LOCAL = './engine/';
const CDN17 = 'https://cdn.jsdelivr.net/npm/stockfish@17.1.0/src/';
const CDN10 = [
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
  'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
];

export class UciEngine {
  constructor(transport, name = 'Stockfish') {
    this.t = transport;
    this.name = name;
    this.listeners = new Set();
    this.q = Promise.resolve(); // command queue: serializes analyze() calls
    transport.setOnLine((line) => { for (const fn of [...this.listeners]) fn(String(line)); });
  }
  run(job) {
    const p = this.q.then(job, job);
    this.q = p.then(() => undefined, () => undefined);
    return p;
  }
  send(cmd) { this.t.post(cmd); }
  expect(pred, timeout = 25000) {
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => { this.listeners.delete(fn); reject(new Error('engine timeout')); }, timeout);
      const fn = (line) => {
        const r = pred(line);
        if (r !== undefined) { clearTimeout(to); this.listeners.delete(fn); resolve(r); }
      };
      this.listeners.add(fn);
    });
  }
  async init(timeout = 30000) {
    this.send('uci');
    await this.expect((l) => (l.includes('uciok') ? true : undefined), timeout);
    this.send('setoption name Threads value 1');
    this.send('setoption name UCI_ShowWDL value true');
    this.send('isready');
    await this.expect((l) => (l.includes('readyok') ? true : undefined), 10000);
  }
  // opts.elo: limit playing strength (UCI_LimitStrength/UCI_Elo, min 1320).
  // opts.skill: Skill Level 0-20 — goes far weaker than UCI_Elo's floor.
  // opts.depth: fixed-depth search instead of movetime (shallow = human-like).
  // Public API is queued: concurrent calls wait their turn instead of
  // corrupting each other's UCI streams.
  analyze(fen, movetime = 300, opts = {}) {
    return this.run(() => this._analyze(fen, movetime, opts));
  }
  _applyStrength(opts) {
    this.send('setoption name UCI_LimitStrength value ' + (opts.elo ? 'true' : 'false'));
    if (opts.elo) this.send('setoption name UCI_Elo value ' + Math.max(1320, opts.elo));
    this.send('setoption name Skill Level value ' + (opts.skill != null ? Math.max(0, Math.min(20, opts.skill)) : 20));
  }
  async _analyze(fen, movetime = 300, opts = {}) {
    this._applyStrength(opts);
    let last = null;
    const collector = (line) => {
      if (line.startsWith('info') && line.includes(' pv ')) {
        const d = line.match(/\bdepth (\d+)/);
        const sc = line.match(/\bscore (cp|mate) (-?\d+)/);
        if (sc) {
          const wdl = line.match(/\bwdl (\d+) (\d+) (\d+)/);
          last = {
            depth: d ? +d[1] : 0,
            cp: sc[1] === 'cp' ? +sc[2] : null,
            mate: sc[1] === 'mate' ? +sc[2] : null,
            pv: line.split(' pv ')[1].trim().split(/\s+/),
            wdl: wdl ? { w: +wdl[1], d: +wdl[2], l: +wdl[3] } : null,
          };
        }
      }
    };
    this.listeners.add(collector);
    this.send('position fen ' + fen);
    this.send(opts.depth ? 'go depth ' + opts.depth : 'go movetime ' + movetime);
    const best = await this.expect((l) => (l.startsWith('bestmove') ? l.split(/\s+/)[1] : undefined), movetime + 25000);
    this.listeners.delete(collector);
    return { best: best === '(none)' ? null : best, ...(last || { cp: 0, mate: null, pv: [], depth: 0 }) };
  }

  // Top-N lines for one position (MultiPV). Scores are side-to-move POV.
  analyzeMulti(fen, movetime = 800, n = 3) {
    return this.run(() => this._analyzeMulti(fen, movetime, n));
  }
  async _analyzeMulti(fen, movetime, n) {
    this._applyStrength({});
    this.send('setoption name MultiPV value ' + n);
    const lines = [];
    const collector = (line) => {
      if (line.startsWith('info') && line.includes(' pv ')) {
        const mp = line.match(/\bmultipv (\d+)/);
        const d = line.match(/\bdepth (\d+)/);
        const sc = line.match(/\bscore (cp|mate) (-?\d+)/);
        if (sc) {
          const idx = mp ? +mp[1] - 1 : 0;
          const wdl = line.match(/\bwdl (\d+) (\d+) (\d+)/);
          lines[idx] = {
            depth: d ? +d[1] : 0,
            cp: sc[1] === 'cp' ? +sc[2] : null,
            mate: sc[1] === 'mate' ? +sc[2] : null,
            pv: line.split(' pv ')[1].trim().split(/\s+/),
            wdl: wdl ? { w: +wdl[1], d: +wdl[2], l: +wdl[3] } : null,
          };
        }
      }
    };
    this.listeners.add(collector);
    this.send('position fen ' + fen);
    this.send('go movetime ' + movetime);
    await this.expect((l) => (l.startsWith('bestmove') ? true : undefined), movetime + 25000);
    this.listeners.delete(collector);
    this.send('setoption name MultiPV value 1');
    return lines.filter(Boolean);
  }

  // Live deepening MultiPV search for an analysis board (lichess-style): streams
  // updated lines as the depth climbs, until `depth` or stop(). Searches are
  // serialized on this engine via a promise chain so a new position cleanly
  // cancels the previous one. Returns { stop } — stop() resolves when settled.
  analyzeLive(fen, { multipv = 3, depth = 26 } = {}, onUpdate) {
    let stopFn = () => {};
    const chain = (this._liveChain || Promise.resolve()).then(() => new Promise((resolve) => {
      this.send('setoption name MultiPV value ' + multipv);
      const lines = [];
      let curDepth = 0;
      const collector = (line) => {
        if (!line.startsWith('info') || !line.includes(' pv ')) return;
        const mp = line.match(/\bmultipv (\d+)/);
        const d = line.match(/\bdepth (\d+)/);
        const sc = line.match(/\bscore (cp|mate) (-?\d+)/);
        if (!sc) return;
        const idx = mp ? +mp[1] - 1 : 0;
        const wdl = line.match(/\bwdl (\d+) (\d+) (\d+)/);
        lines[idx] = {
          depth: d ? +d[1] : 0,
          cp: sc[1] === 'cp' ? +sc[2] : null,
          mate: sc[1] === 'mate' ? +sc[2] : null,
          pv: line.split(' pv ')[1].trim().split(/\s+/),
          wdl: wdl ? { w: +wdl[1], d: +wdl[2], l: +wdl[3] } : null,
        };
        if (d) curDepth = Math.max(curDepth, +d[1]);
        if (onUpdate) onUpdate(lines.filter(Boolean), curDepth);
      };
      const fin = (line) => {
        if (!line.startsWith('bestmove')) return;
        this.listeners.delete(collector); this.listeners.delete(fin);
        resolve();
      };
      this.listeners.add(collector);
      this.listeners.add(fin);
      this.send('position fen ' + fen);
      this.send('go depth ' + depth);
      stopFn = () => this.send('stop');
    }));
    this._liveChain = chain;
    return { stop: () => { stopFn(); return chain; }, done: chain };
  }
}

const workerTransport = (w) => ({
  post: (c) => w.postMessage(c),
  setOnLine: (fn) => { w.onmessage = (e) => fn(typeof e.data === 'string' ? e.data : ''); },
});

async function makeEngine(worker, name, initTimeout) {
  const sf = new UciEngine(workerTransport(worker), name);
  try { await sf.init(initTimeout); return sf; }
  catch (e) { try { worker.terminate(); } catch { /* noop */ } throw e; }
}

function sf17Worker(jsText, wasmUrl) {
  const jsUrl = URL.createObjectURL(new Blob([jsText], { type: 'application/javascript' }));
  // Hash = '#<encodedWasmUrl>' ONLY. Appending ',worker' (as in the threaded
  // builds' sub-worker protocol) short-circuits this single build's entire
  // init — the worker boots dead silent. Cost us a 35s timeout per session.
  return new Worker(jsUrl + '#' + encodeURIComponent(wasmUrl));
}

// tier 0: fully embedded (the wasm asset is inlined into the bundle as a data: URL)
let wasmUrlPromise = null;
function getEmbeddedWasmUrl() {
  if (!wasmUrlPromise) {
    wasmUrlPromise = fetch(SF17_WASM_ASSET)
      .then((r) => r.arrayBuffer())
      .then((b) => URL.createObjectURL(new Blob([b], { type: 'application/wasm' })));
  }
  return wasmUrlPromise; // decoded once, shared by every pooled worker
}
async function tryEmbedded() {
  const wasmUrl = await getEmbeddedWasmUrl();
  return makeEngine(sf17Worker(SF17_JS_TEXT, wasmUrl), 'Stockfish 17 lite · embedded', 15000);
}

// tier 1: same-origin classic worker
async function trySf17Local() {
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) throw new Error('not http');
  const head = await fetch(LOCAL + SF17_JS, { method: 'HEAD' });
  if (!head.ok) throw new Error('no local engine');
  return makeEngine(new Worker(LOCAL + SF17_JS), 'Stockfish 17 lite · local', 30000);
}

// tier 2: CDN js + wasm glued in a blob worker
async function trySf17Cdn() {
  const [jsRes, wasmRes] = await Promise.all([
    fetch(CDN17 + SF17_JS, { cache: 'force-cache' }),
    fetch(CDN17 + SF17_WASM, { cache: 'force-cache' }),
  ]);
  if (!jsRes.ok || !wasmRes.ok) throw new Error('cdn17 fetch failed');
  const [jsText, wasmBuf] = await Promise.all([jsRes.text(), wasmRes.arrayBuffer()]);
  const wasmUrl = URL.createObjectURL(new Blob([wasmBuf], { type: 'application/wasm' }));
  return makeEngine(sf17Worker(jsText, wasmUrl), 'Stockfish 17 lite', 30000);
}

// tier 3: SF10 asm single file
async function trySf10() {
  let text = null;
  for (const url of CDN10) {
    try { const r = await fetch(url, { cache: 'force-cache' }); if (r.ok) { text = await r.text(); break; } } catch { /* next */ }
  }
  if (!text) throw new Error('stockfish-offline');
  const w = new Worker(URL.createObjectURL(new Blob([text], { type: 'application/javascript' })));
  return makeEngine(w, 'Stockfish 10', 20000);
}

let enginePromise = null;
let winningTier = null;
export function getStockfish() {
  if (!enginePromise) {
    enginePromise = (async () => {
      // local real files first: instant fail on file://, ~300ms boot on http
      for (const tier of [trySf17Local, tryEmbedded, trySf17Cdn, trySf10]) {
        try { const e = await tier(); winningTier = tier; return e; } catch { /* next tier */ }
      }
      throw new Error('stockfish-offline');
    })().catch((e) => { enginePromise = null; throw e; });
  }
  return enginePromise;
}

// Dedicated engine for PLAYING moves (bots, coach, sparring). Game analysis,
// the eval bar and "explore" all queue long jobs on the shared engine — a bot
// must never wait behind them, so it gets its own worker. It boots through its
// own tier chain, in PARALLEL with the shared engine (the wasm bytes are
// decoded once and reused), so the first bot move doesn't pay a double boot.
let playEnginePromise = null;
export function getPlayEngine() {
  if (!playEnginePromise) {
    playEnginePromise = (async () => {
      for (const tier of [trySf17Local, tryEmbedded, trySf17Cdn, trySf10]) {
        try { return await tier(); } catch { /* next tier */ }
      }
      return getStockfish(); // last resort: share
    })().catch((e) => { playEnginePromise = null; throw e; });
  }
  return playEnginePromise;
}

// Dedicated engine for the live analysis BOARD (engine-lines panel + live eval
// bar). Separate worker so a long deepening search never blocks the bot/coach
// (play engine) or the one-shot game analysis (pool).
let boardEnginePromise = null;
export function getBoardEngine() {
  if (!boardEnginePromise) {
    boardEnginePromise = (async () => {
      for (const tier of [trySf17Local, tryEmbedded, trySf17Cdn, trySf10]) {
        try { return await tier(); } catch { /* next tier */ }
      }
      return getStockfish();
    })().catch((e) => { boardEnginePromise = null; throw e; });
  }
  return boardEnginePromise;
}

// Worker pool for game analysis: positions are independent, so 2-3 engines
// divide the wall-clock time. Pool size adapts to the device.
let poolPromise = null;
export function getStockfishPool(max = 3) {
  if (!poolPromise) {
    poolPromise = (async () => {
      const first = await getStockfish();
      const hw = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
      const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;
      const n = Math.max(1, Math.min(max, hw - 1, mem >= 4 ? max : 1));
      const engines = [first];
      for (let i = 1; i < n && winningTier; i++) {
        try { engines.push(await winningTier()); } catch { break; }
      }
      return engines;
    })().catch((e) => { poolPromise = null; throw e; });
  }
  return poolPromise;
}
