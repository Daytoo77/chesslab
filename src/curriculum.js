// Content-organization helpers — pure functions over already-authored,
// already-validated data (DRILLS, opening lines). No new chess claims are
// made here: this only orders/filters/labels existing content.

// ---- Endgame curriculum: basic -> practical -> advanced ----
export const STAGE_ORDER = ['basic', 'practical', 'advanced'];
export const STAGE_LABEL = { basic: 'Basic', practical: 'Practical', advanced: 'Advanced' };

export function groupByStage(drills) {
  const groups = {};
  for (const d of drills) {
    const stage = d.stage || 'basic';
    (groups[stage] = groups[stage] || []).push(d);
  }
  return STAGE_ORDER.filter((s) => groups[s]).map((s) => ({ stage: s, label: STAGE_LABEL[s], drills: groups[s] }));
}

// The next drill to work on: first not-yet-done drill in stage order. Once
// every drill in a stage has at least one clear, the curriculum moves on.
// Returns null when everything is cleared (celebrate — don't nag).
export function nextDrill(drills, drillsDone = {}) {
  const ordered = [...drills].sort((a, b) => STAGE_ORDER.indexOf(a.stage || 'basic') - STAGE_ORDER.indexOf(b.stage || 'basic'));
  return ordered.find((d) => !drillsDone[d.id]) || null;
}

// ---- Opening traps: surface lines already authored as punishers/refutations
// so the player can jump straight to "know this or lose a piece" moments. ----
const TRAP_RE = /trap|punish|refut|blunder|poison|\?\?|\?!/i;

export function findTrapLines(lines) {
  return (lines || []).filter((l) => TRAP_RE.test(l.name || '') || (l.moves || []).some((m) => TRAP_RE.test(m.why || '')));
}
