// Parity corpus gate — honest version.
//
// The REAL Game Review pipeline (analyzeWithStockfish) runs Stockfish as a
// WASM Web Worker and cannot execute under plain node. The original version
// of this script pretended otherwise: it ran the old PeSTO analyzer with a
// made-up accuracy formula and a ROOT path hardcoded to the GitHub CI runner,
// so its numbers never described the app.
//
// What this script actually does now:
//   1. Validates benchmark/corpus.json (PGN legality via chess.js, shape of
//      expected outputs + tolerances) — a meaningful CI gate.
//   2. If benchmark/last-report.json exists (produced by a real in-browser
//      run pasted from the app), it gates that report against tolerances.
// The metric/gating math lives in src/parity.js and is unit-tested.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { computeParityMetrics, parityPasses } from '../src/parity.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusPath = path.join(ROOT, 'benchmark', 'corpus.json');
const reportPath = path.join(ROOT, 'benchmark', 'last-report.json');

let fail = 0;

// ---- 1. corpus schema + PGN validation ----
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
for (const c of corpus) {
  const problems = [];
  if (!c.id) problems.push('missing id');
  try { new Chess().loadPgn(c.pgn); } catch { problems.push('PGN does not parse'); }
  for (const k of ['accuracy', 'rating', 'counts']) if (!c.expected || c.expected[k] == null) problems.push(`expected.${k} missing`);
  for (const k of ['accuracyMaxDelta', 'ratingMaxDelta', 'tagDeltaTotalMax']) if (!c.tolerance || typeof c.tolerance[k] !== 'number') problems.push(`tolerance.${k} missing`);
  if (problems.length) { fail++; console.log(`[FAIL] corpus ${c.id || '?'}: ${problems.join('; ')}`); }
  else console.log(`[ok] corpus ${c.id} — valid`);
}

// ---- 2. gate a real in-browser report, when one has been captured ----
if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  for (const r of report) {
    const c = corpus.find((x) => x.id === r.id);
    if (!c) { console.log(`[skip] report entry ${r.id} not in corpus`); continue; }
    const metrics = computeParityMetrics(c.expected, r.actual);
    const pass = parityPasses(metrics, c.tolerance);
    if (!pass) fail++;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${r.id} — acc d w:${metrics.accuracyDelta.w?.toFixed?.(1)} b:${metrics.accuracyDelta.b?.toFixed?.(1)} · rating d w:${metrics.ratingDelta.w} b:${metrics.ratingDelta.b} · tag d ${metrics.tagDeltaTotal}`);
  }
} else {
  console.log('\n(no benchmark/last-report.json — run a Game Review of each corpus PGN in the app and save {id, actual:{accuracy,rating,counts}} entries to gate real numbers)');
}

process.exitCode = fail ? 1 : 0;
