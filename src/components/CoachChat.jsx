// Interactive Q&A with the Gemini coach, alongside the analysis board.
// Every question is grounded in the CURRENT position + live engine lines.
import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../settings.js';
import { askCoach, buildCoachContext } from '../coach.js';

const SUGGESTIONS = [
  'Why was my last move a mistake?',
  "What's the plan in this position?",
  'What should I watch out for here?',
];

export default function CoachChat({ fen, lines, evalWhite, moves, cursor, playerColor }) {
  const geminiKey = useSettings((s) => s.geminiKey);
  const set = useSettings((s) => s.set);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [keyDraft, setKeyDraft] = useState('');
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [msgs, busy]);

  async function send(text) {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput('');
    setError(null);
    const context = buildCoachContext({ fen, lines, evalWhite, moves, cursor, playerColor });
    const history = [...msgs, { role: 'user', text: q }];
    setMsgs(history);
    setBusy(true);
    try {
      const reply = await askCoach({ apiKey: geminiKey, context, messages: history });
      setMsgs((m) => [...m, { role: 'coach', text: reply }]);
    } catch (e) {
      setError(String(e.message || e));
      setMsgs((m) => m.slice(0, -1)); // put the question back so they can retry
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  if (!geminiKey) {
    return (
      <div className="panel coach-chat">
        <h3>🧑‍🏫 AI Coach</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Chat about any position with a Gemini-powered coach that sees the live engine lines.
          Paste a Google AI Studio API key — it is stored <b>only in this browser</b>, never in the app's code.
        </p>
        <div className="coach-input-row">
          <input type="password" placeholder="Gemini API key" value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && keyDraft.trim()) set({ geminiKey: keyDraft.trim() }); }} />
          <button className="btn primary" disabled={!keyDraft.trim()} onClick={() => set({ geminiKey: keyDraft.trim() })}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel coach-chat">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>🧑‍🏫 AI Coach <span className="chip teal" style={{ marginLeft: 6 }}>Gemini · sees the engine</span></h3>
        {msgs.length > 0 && <button className="btn btn-mini" onClick={() => { setMsgs([]); setError(null); }}>Clear</button>}
      </div>
      <div className="coach-log" ref={logRef}>
        {msgs.length === 0 && (
          <p className="small muted" style={{ margin: '8px 0' }}>
            Ask anything about the position on the board. The coach reads the live engine lines,
            so its advice is grounded — not guessed.
          </p>
        )}
        {msgs.map((m, i) => <div key={i} className={`coach-msg ${m.role}`}>{m.text}</div>)}
        {busy && <div className="coach-msg coach"><span className="thinking-dots"><span>●</span><span>●</span><span>●</span></span></div>}
      </div>
      {error && <div className="small" style={{ color: 'var(--bad)', margin: '4px 0 8px' }}>⚠ {error}</div>}
      {msgs.length === 0 && !busy && (
        <div className="coach-sugg">
          {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <div className="coach-input-row">
        <input value={input} placeholder="Ask the coach… e.g. why couldn't I take that pawn?"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          disabled={busy} />
        <button className="btn primary" onClick={() => send()} disabled={busy || !input.trim()}>Ask</button>
      </div>
    </div>
  );
}
