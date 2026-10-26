// Coach grounding blocks: compact, honest text built only from what the
// review already knows (FEN, engine lines, evals, move tags, repertoire
// notes). Any LLM coach can be fed these; nothing here talks to a model.
// Compact, honest grounding block built from what the app already knows.
export function buildCoachContext({ fen, lines, evalWhite, moves, cursor, playerColor }) {
  const stm = (fen || '').split(' ')[1] === 'b' ? 'Black' : 'White';
  const out = [`FEN: ${fen}`, `Side to move: ${stm}. The student plays ${playerColor === 'b' ? 'Black' : 'White'}.`];
  if (evalWhite != null) out.push(`Current engine eval: ${(evalWhite >= 0 ? '+' : '') + (evalWhite / 100).toFixed(2)}`);
  (lines || []).slice(0, 3).forEach((L, i) => {
    const sans = (L.sans || []).map((s) => s.san).join(' ');
    if (!sans) return;
    const ev = L.mate != null
      ? `mate in ${Math.abs(L.mate)} for ${L.mate > 0 ? 'White' : 'Black'}`
      : L.cpWhite != null ? (L.cpWhite >= 0 ? '+' : '') + (L.cpWhite / 100).toFixed(2) : '?';
    out.push(`Engine line ${i + 1} (${ev}): ${sans}`);
  });
  if (moves && cursor > 0) {
    const from = Math.max(0, cursor - 8);
    const rec = moves.slice(from, cursor).map((m, j) => {
      const i = from + j;
      const num = i % 2 === 0 ? `${i / 2 + 1}.` : '';
      const tag = m.tag && !['good', 'excellent', 'best', 'book', 'forced'].includes(m.tag) ? ` (${m.tag})` : '';
      return `${num}${m.san}${tag}`;
    }).join(' ');
    out.push(`Moves leading here, engine-tagged: ${rec}`);
    const last = moves[cursor - 1];
    if (last && last.bestSan && last.bestSan !== last.san) out.push(`Instead of the last move ${last.san}, the engine preferred ${last.bestSan}.`);
  }
  return out.join('\n');
}

// Grounding block for the OPENING TRAINER — no engine here, so we hand the coach
// the FEN plus the repertoire's OWN expert annotations (the `why` notes) and the
// intended continuation, then let it explain the ideas of the named opening.
export function buildOpeningContext({ fen, openingName, lineName, summary, moves, ply, userColor }) {
  const stm = (fen || '').split(' ')[1] === 'b' ? 'Black' : 'White';
  const out = [
    'This is an OPENING TRAINER position (opening study, no engine analysis attached).',
    `Opening: ${openingName}${lineName ? ' — ' + lineName : ''}.`,
    summary ? `Repertoire's summary of the opening: ${summary}` : '',
    `FEN: ${fen}`,
    `Side to move: ${stm}. In this repertoire the student plays ${userColor === 'b' ? 'Black' : 'White'}.`,
  ].filter(Boolean);
  if (moves && ply > 0) {
    const played = moves.slice(0, ply).map((m, i) => `${i % 2 === 0 ? `${i / 2 + 1}.` : ''}${m.san}`).join(' ');
    out.push(`Moves played to reach this position: ${played}`);
    const cur = moves[ply - 1];
    if (cur && cur.why) out.push(`The repertoire's note on the last move (${cur.san}): ${cur.why}`);
  } else {
    out.push('This is the starting position of the line.');
  }
  if (moves && ply < moves.length) {
    const nxt = moves[ply];
    out.push(`The repertoire's next intended move is ${nxt.san}${nxt.why ? ` — ${nxt.why}` : ''}.`);
  } else if (moves && moves.length) {
    out.push('This is the end of the prepared theory — the middlegame plans begin here.');
  }
  return out.join('\n');
}
