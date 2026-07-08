// Game Vault: build a personal opening tree from a (large) PGN export of your
// games. Aggregates are stored in IndexedDB — tens of thousands of games fit
// without touching localStorage limits.
import { Chess } from 'chess.js';

const DB = 'chesslab-vault';
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function kvSet(key, val) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function kvGet(key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const q = tx.objectStore('kv').get(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

const MAX_PLIES = 20; // first 10 moves: where opening prep lives

export function splitPgnGames(text) {
  return text.split(/\n\s*\n(?=\[)/).map((s) => s.trim()).filter((s) => s.includes('['));
}

const MAX_GAMES = 30000; // browser-practical cap for one indexing run

export async function buildTree(pgnText, username, onProgress) {
  let chunks = splitPgnGames(pgnText);
  let capped = false;
  if (chunks.length > MAX_GAMES) { chunks = chunks.slice(0, MAX_GAMES); capped = true; }
  const root = { n: 0, w: 0, d: 0, l: 0, c: {} };
  let games = 0, skipped = 0, asWhite = 0;
  const uname = (username || '').trim().toLowerCase();
  const referenceMode = !uname; // no username -> index ALL games (white POV reference tree)
  for (let gi = 0; gi < chunks.length; gi++) {
    try {
      const chunk = chunks[gi];
      const white = ((chunk.match(/\[White "(.*?)"\]/) || [])[1] || '').toLowerCase();
      const black = ((chunk.match(/\[Black "(.*?)"\]/) || [])[1] || '').toLowerCase();
      const result = (chunk.match(/\[Result "(.*?)"\]/) || [])[1] || '*';
      let color = referenceMode ? 'w' : null;
      if (uname && white.includes(uname)) color = 'w';
      else if (uname && black.includes(uname)) color = 'b';
      if (!color || result === '*') { skipped++; continue; }
      const g = new Chess();
      g.loadPgn(chunk);
      const hist = g.history();
      if (!hist.length) { skipped++; continue; }
      const score = result === '1/2-1/2' ? 'd' : (result === '1-0') === (color === 'w') ? 'w' : 'l';
      let node = root;
      node.n++; node[score]++;
      for (let i = 0; i < Math.min(hist.length, MAX_PLIES); i++) {
        const san = hist[i];
        node.c[san] = node.c[san] || { n: 0, w: 0, d: 0, l: 0, c: {} };
        node = node.c[san];
        node.n++; node[score]++;
      }
      games++;
      if (color === 'w') asWhite++;
    } catch { skipped++; }
    if (gi % 20 === 0) {
      if (onProgress) onProgress(gi / chunks.length);
      await new Promise((r) => setTimeout(r));
    }
  }
  return { games, skipped, asWhite, tree: root, username, referenceMode, capped, builtAt: Date.now() };
}

export function nodeAtPath(tree, path) {
  let node = tree;
  for (const san of path) {
    node = node && node.c ? node.c[san] : null;
    if (!node) return null;
  }
  return node;
}
export const scorePct = (n) => (n.n ? Math.round(((n.w + n.d / 2) / n.n) * 1000) / 10 : 0);

// Which move does the repertoire play at this path (if any line matches)?
export function repertoireMoveAt(openings, path) {
  for (const o of openings) {
    for (const l of o.lines) {
      if (l.moves.length <= path.length) continue;
      let match = true;
      for (let i = 0; i < path.length; i++) {
        if (l.moves[i].san.replace(/[+#]/g, '') !== path[i].replace(/[+#]/g, '')) { match = false; break; }
      }
      if (match) return { san: l.moves[path.length].san, opening: o.name, line: l.name };
    }
  }
  return null;
}
