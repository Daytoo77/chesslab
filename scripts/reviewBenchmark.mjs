import fs from 'node:fs';
import path from 'node:path';
import { analyzeGame } from '../src/engine.js';
import { gameAccuracy, moveAccuracy, ratingFromAccuracy, winPct } from '../src/accuracy.js';
import { computeParityMetrics, parityPasses } from '../src/parity.js';

const ROOT = '/home/runner/work/chesslab/chesslab';
const corpusPath = path.join(ROOT, 'benchmark', 'corpus.json');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

function summarizeSide(res, color) {
  const moves = res.moves.filter((m) => m.color === color);
  const counts = {};
  for (const m of moves) if (m.tag) counts[m.tag] = (counts[m.tag] || 0) + 1;
  const accList = moves
    .filter((m) => m.cpl != null)
    .map((m) => moveAccuracy(50, 50 - (winPct(Math.min(1000, m.cpl)) - 50)));
  const acc = gameAccuracy(accList);
  return { counts, accuracy: acc, rating: ratingFromAccuracy(acc) };
}

function summarizeGame(pgn) {
  const asWhite = analyzeGame(pgn, 'w');
  const asBlack = analyzeGame(pgn, 'b');
  const sw = summarizeSide(asWhite, 'w');
  const sb = summarizeSide(asBlack, 'b');
  return {
    accuracy: { w: sw.accuracy, b: sb.accuracy },
    rating: { w: sw.rating, b: sb.rating },
    counts: { w: sw.counts, b: sb.counts },
  };
}

let fail = 0;
const report = [];
for (const c of corpus) {
  const actual = summarizeGame(c.pgn);
  const metrics = computeParityMetrics(c.expected, actual);
  const pass = parityPasses(metrics, c.tolerance);
  if (!pass) fail++;
  report.push({ id: c.id, pass, metrics, expected: c.expected, actual });
}

for (const r of report) {
  console.log(`\n[${r.pass ? 'PASS' : 'FAIL'}] ${r.id}`);
  console.log(`  accuracy Δ  w:${r.metrics.accuracyDelta.w?.toFixed?.(1) ?? 'n/a'} b:${r.metrics.accuracyDelta.b?.toFixed?.(1) ?? 'n/a'}`);
  console.log(`  rating Δ    w:${r.metrics.ratingDelta.w ?? 'n/a'} b:${r.metrics.ratingDelta.b ?? 'n/a'}`);
  console.log(`  tag Δ total ${r.metrics.tagDeltaTotal}`);
}

if (process.argv.includes('--json')) {
  const out = path.join(ROOT, 'benchmark', 'last-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
}

process.exitCode = fail ? 1 : 0;
