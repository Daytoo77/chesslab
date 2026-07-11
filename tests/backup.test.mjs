import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportBackup, importBackup } from '../src/backup.js';

const mkStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    dump: () => Object.fromEntries(m),
  };
};

const SETTINGS = JSON.stringify({ state: { boardTheme: 'amethyst', geminiKey: 'SECRET-KEY' }, version: 0 });
const STATS = JSON.stringify({ state: { streak: 7 }, version: 0 });

test('export: strips the Gemini key, keeps everything else', () => {
  const st = mkStorage({ chesslab_settings_v1: SETTINGS, chesslab_stats_v2: STATS, chesslab_muted: 'false' });
  const b = exportBackup(st);
  assert.equal(b.app, 'chesslab');
  assert.ok(!JSON.stringify(b).includes('SECRET-KEY'), 'key must never appear in a backup');
  assert.ok(JSON.parse(b.stores.chesslab_settings_v1).state.boardTheme === 'amethyst');
  assert.ok(JSON.parse(b.stores.chesslab_stats_v2).state.streak === 7);
});

test('round trip: export -> import restores stats on a fresh device', () => {
  const src = mkStorage({ chesslab_settings_v1: SETTINGS, chesslab_stats_v2: STATS });
  const b = exportBackup(src);
  const dst = mkStorage({});
  const res = importBackup(b, dst);
  assert.equal(res.ok, true);
  assert.equal(JSON.parse(dst.getItem('chesslab_stats_v2')).state.streak, 7);
});

test('import: preserves the destination device key', () => {
  const b = exportBackup(mkStorage({ chesslab_settings_v1: SETTINGS }));
  const dst = mkStorage({ chesslab_settings_v1: JSON.stringify({ state: { geminiKey: 'MY-LOCAL-KEY' }, version: 0 }) });
  importBackup(b, dst);
  assert.equal(JSON.parse(dst.getItem('chesslab_settings_v1')).state.geminiKey, 'MY-LOCAL-KEY');
});

test('import: rejects garbage without touching storage', () => {
  const dst = mkStorage({ chesslab_stats_v2: STATS });
  for (const bad of [null, 42, { app: 'other' }, { app: 'chesslab', schema: 99, stores: {} }, { app: 'chesslab', schema: 1, stores: { evil_key: '{}' } }, { app: 'chesslab', schema: 1, stores: { chesslab_stats_v2: '{broken' } }]) {
    const res = importBackup(bad, dst);
    assert.equal(res.ok, false, JSON.stringify(bad));
  }
  assert.equal(JSON.parse(dst.getItem('chesslab_stats_v2')).state.streak, 7, 'storage untouched after rejections');
});
