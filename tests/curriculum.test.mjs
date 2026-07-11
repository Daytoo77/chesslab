import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByStage, nextDrill, findTrapLines } from '../src/curriculum.js';

const D = [
  { id: 'a', stage: 'basic' },
  { id: 'b', stage: 'basic' },
  { id: 'c', stage: 'practical' },
  { id: 'd', stage: 'advanced' },
];

test('groupByStage: orders basic -> practical -> advanced, drops empty stages', () => {
  const g = groupByStage(D);
  assert.deepEqual(g.map((x) => x.stage), ['basic', 'practical', 'advanced']);
  assert.equal(g[0].drills.length, 2);
});

test('groupByStage: missing stage defaults to basic', () => {
  const g = groupByStage([{ id: 'x' }]);
  assert.equal(g[0].stage, 'basic');
});

test('nextDrill: recommends the first undone drill, in stage order', () => {
  assert.equal(nextDrill(D, {}).id, 'a');
  assert.equal(nextDrill(D, { a: 1 }).id, 'b');
  assert.equal(nextDrill(D, { a: 1, b: 1 }).id, 'c');
});

test('nextDrill: null once everything is cleared', () => {
  assert.equal(nextDrill(D, { a: 1, b: 1, c: 1, d: 1 }), null);
});

test('findTrapLines: matches trap/punish/refutation naming', () => {
  const lines = [
    { id: '1', name: 'Main line — quiet development' },
    { id: '2', name: 'Punishing 3...Nxe4?!' },
    { id: '3', name: 'The Qh5 trap' },
    { id: '4', name: 'A safe line', moves: [{ san: 'e4', why: 'refutes the gambit' }] },
  ];
  const traps = findTrapLines(lines);
  assert.deepEqual(traps.map((l) => l.id).sort(), ['2', '3', '4']);
});

test('findTrapLines: empty/undefined input never throws', () => {
  assert.deepEqual(findTrapLines(undefined), []);
  assert.deepEqual(findTrapLines([]), []);
});
