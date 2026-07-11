// Decides the bot's next move — from the human-opening book for the first
// few plies of a from-scratch game, otherwise from the engine — and hands
// the chosen SAN back via a callback. It never mutates the game or touches
// the clock/persistence/game-end logic; the caller applies the move exactly
// as before, so move ordering and side effects are unchanged.
import { useState } from 'react';
import { botMove } from '../playEngine.js';
import { bookContinuations } from '../data/openingNames.js';

export function useBotReply() {
  const [thinking, setThinking] = useState(false);

  // isStale(id) -> bool: the caller's own staleness check (reset/new-game guard).
  // onPicked(san): a move was chosen — apply it.
  // onFail(): no move could be produced (game over, engine error, etc).
  function requestMove(g, chosenBot, id, { isStale, onPicked, onFail }) {
    setThinking(true);
    const started = Date.now();

    if (!g.__startFen && g.history().length < 10) {
      const conts = bookContinuations(g.history());
      const legal = new Set(g.moves().map((s) => s.replace(/[+#]/g, '')));
      const candidates = conts.filter((s) => legal.has(s.replace(/[+#]/g, '')));
      if (candidates.length && Math.random() < 0.92) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        setTimeout(() => {
          if (isStale(id)) return;
          if (g.isGameOver()) { setThinking(false); onFail && onFail(); return; }
          setThinking(false);
          onPicked(pick);
        }, 350 + Math.random() * 400);
        return;
      }
    }

    botMove(g.fen(), chosenBot.params).then((r) => {
      if (isStale(id)) return;
      const minDelay = Math.max(0, 300 - (Date.now() - started) + Math.random() * 250);
      setTimeout(() => {
        if (isStale(id)) return;
        if (r && r.san && !g.isGameOver()) { setThinking(false); onPicked(r.san); }
        else { setThinking(false); onFail && onFail(); }
      }, minDelay);
    }).catch(() => { setThinking(false); onFail && onFail(); });
  }

  return { thinking, requestMove, setThinking };
}
