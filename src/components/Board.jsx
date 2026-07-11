import React, { useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useStats } from '../store.js';
import { useSettings, themeById } from '../settings.js';

const PIECE_KEYS = ['wP','wN','wB','wR','wQ','wK','bP','bN','bB','bR','bQ','bK'];
const UNICODE = { P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' };

// crisp text pieces — zero extra bytes in the bundle
const unicodePieces = (() => {
  const o = {};
  for (const k of PIECE_KEYS) {
    const isWhite = k[0] === 'w';
    o[k] = ({ squareWidth }) => (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: squareWidth * 0.78, lineHeight: 1, userSelect: 'none',
        color: isWhite ? '#f6f1e6' : '#1c1a17',
        textShadow: isWhite ? '0 0 3px rgba(0,0,0,0.85), 0 1.5px 1.5px rgba(0,0,0,0.5)' : '0 0 3px rgba(255,255,255,0.35), 0 1.5px 1.5px rgba(0,0,0,0.4)',
      }}>{UNICODE[k[1]]}</div>
    );
  }
  return o;
})();

const DOT = { background: 'radial-gradient(circle, rgba(176, 125, 255,0.55) 22%, transparent 24%)' };
const RING = { background: 'radial-gradient(circle, transparent 56%, rgba(176, 125, 255,0.6) 60%, rgba(176, 125, 255,0.6) 72%, transparent 76%)' };
// pulsing red glow while the king is in check (keyframes live in index.css)
const CHECK = {
  background: 'radial-gradient(circle, rgba(224,80,80,0.85) 18%, rgba(224,80,80,0.45) 48%, transparent 72%)',
  animation: 'check-pulse 1.1s ease-in-out infinite',
};
const MARK = { boxShadow: 'inset 0 0 0 4px rgba(224,108,108,0.85)' };
const PREMOVE = { backgroundColor: 'rgba(125, 163, 224, 0.38)', boxShadow: 'inset 0 0 16px rgba(125, 163, 224, 0.45)' };

function kingInCheckSquare(fen) {
  try {
    const g = new Chess(fen);
    if (!g.inCheck()) return null;
    const turn = g.turn();
    const rows = g.board();
    for (const row of rows) for (const p of row) {
      if (p && p.type === 'k' && p.color === turn) return p.square;
    }
  } catch { /* invalid fen */ }
  return null;
}

// getMoves(square) -> verbose move list for that square (or null/[]).
// onDrop(from, to, promotion?) -> bool. `premove` = {from,to} shown in blue.
export default function Board({ fen, onDrop, orientation = 'white', lastMove, arrows = [], draggable = true, getMoves, onArrowsChange, premove, onPremoveCancel }) {
  const blindfold = useStats((s) => s.blindfold);
  const { boardTheme, showLegal, coords, animMs, autoQueen, pieceSet, boardHl } = useSettings();
  const theme = themeById(boardTheme);
  const hlF = boardHl === 'subtle' ? 0.6 : boardHl === 'bold' ? 1.35 : 1; // highlight intensity
  const hiddenPieces = useMemo(() => {
    const o = {};
    for (const k of PIECE_KEYS) o[k] = () => <div style={{ width: '100%', height: '100%' }} />;
    return o;
  }, []);
  const [selected, setSelected] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [marks, setMarks] = useState([]); // right-click square highlights
  const [pendingPromo, setPendingPromo] = useState(null); // { from, to } via click-to-move

  const interactive = draggable && !!onDrop;
  const hintFrom = selected || dragFrom;
  const targets = interactive && getMoves && hintFrom ? getMoves(hintFrom) || [] : [];
  const checkSq = useMemo(() => kingInCheckSquare(fen), [fen]);

  const squareStyles = {};
  if (lastMove) {
    // elegant glow — soft inner bloom on the origin, brighter ring + bloom on
    // the destination; alpha scales with the highlight-intensity setting
    squareStyles[lastMove.from] = {
      backgroundColor: `rgba(176, 125, 255,${Math.min(1, 0.32 * hlF)})`,
      boxShadow: `inset 0 0 14px rgba(212, 184, 255,${Math.min(1, 0.28 * hlF)})`,
    };
    squareStyles[lastMove.to] = {
      backgroundColor: `rgba(176, 125, 255,${Math.min(1, 0.45 * hlF)})`,
      boxShadow: `inset 0 0 0 2px rgba(212, 184, 255,${Math.min(1, 0.55 * hlF)}), inset 0 0 20px rgba(212, 184, 255,${Math.min(1, 0.35 * hlF)})`,
    };
  }
  if (premove) {
    squareStyles[premove.from] = { ...(squareStyles[premove.from] || {}), ...PREMOVE };
    squareStyles[premove.to] = { ...(squareStyles[premove.to] || {}), ...PREMOVE };
  }
  if (checkSq) squareStyles[checkSq] = { ...(squareStyles[checkSq] || {}), ...CHECK };
  if (hintFrom) squareStyles[hintFrom] = { ...(squareStyles[hintFrom] || {}), boxShadow: 'inset 0 0 0 3px rgba(176, 125, 255,0.85), inset 0 0 18px rgba(212, 184, 255,0.35)' };
  if (showLegal) for (const m of targets) squareStyles[m.to] = { ...(squareStyles[m.to] || {}), ...(m.captured ? RING : DOT) };
  for (const sq of marks) squareStyles[sq] = { ...(squareStyles[sq] || {}), ...MARK };

  function tryMove(from, to) {
    const ms = getMoves ? getMoves(from) || [] : [];
    const m = ms.find((t) => t.to === to);
    if (m && m.promotion && !autoQueen) { setPendingPromo({ from, to }); return true; }
    return onDrop(from, to, m && m.promotion ? 'q' : undefined);
  }

  function handleSquareClick(sq) {
    if (marks.length) setMarks([]);
    if (!interactive) return;
    if (pendingPromo) { setPendingPromo(null); return; }
    if (selected) {
      const m = targets.find((t) => t.to === sq);
      if (m) { tryMove(selected, sq); setSelected(null); return; }
      if (sq === selected) { setSelected(null); return; }
    }
    const ms = getMoves ? getMoves(sq) : null;
    setSelected(ms && ms.length ? sq : null);
  }

  function handleRightClick(sq) {
    if (premove && onPremoveCancel) { onPremoveCancel(); return; }
    setMarks((cur) => (cur.includes(sq) ? cur.filter((s) => s !== sq) : [...cur, sq]));
  }

  // Drag-promotion: the board pops its own picker; click-promotion: we trigger it.
  function handlePromotionSelect(piece, from, to) {
    const f = from || (pendingPromo && pendingPromo.from);
    const t = to || (pendingPromo && pendingPromo.to);
    setPendingPromo(null);
    if (!piece || !f || !t) return false;
    return !!onDrop(f, t, piece[1].toLowerCase());
  }

  // Only pop the dialog for moves that are actually legal promotions.
  function promotionCheck(from, to, piece) {
    if (!/P$/.test(piece || '')) return false;
    const lastRank = piece[0] === 'w' ? '8' : '1';
    if (to[1] !== lastRank) return false;
    if (getMoves) { const ms = getMoves(from) || []; return ms.some((m) => m.to === to && m.promotion); }
    return true;
  }

  return (
    <div className="board-shell">
      <Chessboard
        position={fen}
        onPieceDrop={(s, t) => {
          setSelected(null); setDragFrom(null);
          return onDrop ? onDrop(s, t, 'q') : false;
        }}
        onSquareClick={handleSquareClick}
        onSquareRightClick={handleRightClick}
        onPieceDragBegin={(_, sq) => setDragFrom(sq)}
        onPieceDragEnd={() => setDragFrom(null)}
        boardOrientation={orientation}
        arePiecesDraggable={interactive}
        autoPromoteToQueen={autoQueen}
        onPromotionCheck={promotionCheck}
        onPromotionPieceSelect={handlePromotionSelect}
        showPromotionDialog={!!pendingPromo}
        promotionToSquare={pendingPromo ? pendingPromo.to : null}
        showBoardNotation={coords}
        customNotationStyle={{ fontSize: '11px', fontWeight: 600, opacity: 0.85 }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        customSquareStyles={squareStyles}
        customArrows={arrows}
        onArrowsChange={onArrowsChange}
        customArrowColor="rgba(176, 125, 255,0.85)"
        customPieces={blindfold ? hiddenPieces : pieceSet === 'unicode' ? unicodePieces : undefined}
        customBoardStyle={{ borderRadius: 8 }}
        animationDuration={animMs}
      />
    </div>
  );
}
