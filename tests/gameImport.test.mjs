import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRecentGames } from '../src/gameImport.js';

const PGN = '1. e4 e5 *';

// minimal stand-ins for the two public APIs
// (the monthly-archive API is asked for this month, then last month)
function mockFetch({ monthly = null, ndjson = null } = {}) {
  let months = 0;
  return async (url) => {
    if (url.includes('/pub/player/')) {
      if (!monthly) return { ok: false, status: 404 };
      return { ok: true, json: async () => ({ games: months++ === 0 ? monthly : [] }) };
    }
    if (!ndjson) return { ok: false, status: 404 };
    return { ok: true, text: async () => ndjson.map((g) => JSON.stringify(g)).join('\n') };
  };
}

const monthlyGame = (ts) => ({
  url: `m-${ts}`, end_time: ts / 1000, pgn: PGN, time_class: 'blitz',
  white: { username: 'Me', rating: 900, result: 'win' }, black: { username: 'Opp', rating: 880, result: 'checkmated' },
});
const ndGame = (ts) => ({
  id: `n-${ts}`, createdAt: ts, pgn: PGN, speed: 'rapid', winner: 'black',
  players: { white: { user: { name: 'Opp' }, rating: 1500 }, black: { user: { name: 'me' }, rating: 1490 } },
});

async function withFetch(fn, impl) {
  const orig = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = orig; }
}

test('fetchRecentGames: merges both sources newest first, with the user colour', async () => {
  const games = await withFetch(() => fetchRecentGames('me'), mockFetch({
    monthly: [monthlyGame(1_700_000_000_000)],
    ndjson: [ndGame(1_700_000_500_000)],
  }));
  assert.deepEqual(games.map((g) => g.id), ['n-1700000500000', 'm-1700000000000']);
  assert.deepEqual(games.map((g) => g.userColor), ['b', 'w']);
});

test('fetchRecentGames: a source without the user is skipped', async () => {
  const games = await withFetch(() => fetchRecentGames('me'), mockFetch({ ndjson: [ndGame(1)] }));
  assert.equal(games.length, 1);
});

test('fetchRecentGames: offline or unknown everywhere -> one generic error', async () => {
  await withFetch(
    () => assert.rejects(fetchRecentGames('ghost'), /No recent games found for that username/),
    async () => { throw new TypeError('Failed to fetch'); },
  );
});
