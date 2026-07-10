// AI Coach — Gemini-powered conversational analysis. Bring-your-own-key:
// the API key lives ONLY in this browser's localStorage (settings store);
// it is never bundled, committed, or sent anywhere except Google's API.
//
// Anti-hallucination design: every request carries a fresh ENGINE DATA block
// (FEN, live Stockfish lines, evals, move tags) and the system prompt forbids
// claims that aren't grounded in it — same philosophy as the offline narrator.
const MODEL = 'gemini-2.5-flash';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM = `You are the ChessLab Coach: a warm, encouraging chess coach with grandmaster-level understanding, talking to an improving club player.

HARD RULES:
- Ground your answer in the DATA block provided with the question (FEN, and — when present — engine lines, evals, move tags, or repertoire notes). Never invent concrete tactical variations or specific evaluations that aren't supported by the data.
- When the data includes engine lines/evals, defer to them. When it is an OPENING TRAINER position (no engine lines), you MAY draw on well-known principles and standard theory of the named opening to explain plans and ideas — but still describe the actual position on the board, and don't fabricate exact winning lines.
- If you genuinely can't answer from the position, say so briefly and suggest what to look at. Never bluff.
- Use SAN notation (Nf3, exd5, O-O). Evals are from White's point of view.
- Explain through concepts — pawn structure, king safety, piece activity, outposts, space, tempo, weak squares — in plain, vivid language a club player understands.
- Be concise: 2-6 short sentences unless the student explicitly asks for depth. Plain text only, no markdown, no bullet lists.
- Be encouraging and honest: acknowledge good ideas, name mistakes without sugarcoating, and always give ONE concrete takeaway.`;

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

export async function askCoach({ apiKey, context, messages }) {
  if (!apiKey) throw new Error('No API key configured');
  const contents = messages.map((m) => ({
    role: m.role === 'coach' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));
  // fresh grounding rides with the LAST user turn, so follow-ups track the board
  const last = contents[contents.length - 1];
  last.parts[0].text = `POSITION DATA:\n${context}\n\nSTUDENT QUESTION: ${last.parts[0].text}`;
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 1600, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err && err.error && err.error.message ? err.error.message : `HTTP ${res.status}`;
    throw new Error(/API key/i.test(msg) ? 'Invalid API key — check it in Settings.' : msg);
  }
  const data = await res.json();
  const txt = ((data.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!txt) throw new Error('The coach returned an empty answer — try again.');
  return txt.replace(/\*\*/g, ''); // belt-and-braces: strip stray markdown bold
}
