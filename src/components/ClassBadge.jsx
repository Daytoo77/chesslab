import React from 'react';

// chess.com-style circular classification icon. Coloured disc + a crisp white
// glyph (or small SVG for the thumbs-up / book). Our own art, not chess.com's.
const THUMB = (
  <svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true">
    <path fill="#fff" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.96 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
  </svg>
);
const BOOK = (
  <svg viewBox="0 0 24 24" width="58%" height="58%" aria-hidden="true">
    <path fill="#fff" d="M12 6.5C10.6 5.6 8.8 5 7 5c-1.6 0-3.3.4-4.5 1.1v12.3C3.7 17.7 5.4 17.3 7 17.3c1.8 0 3.6.6 5 1.5 1.4-.9 3.2-1.5 5-1.5 1.6 0 3.3.4 4.5 1.1V6.1C20.3 5.4 18.6 5 17 5c-1.8 0-3.6.6-5 1.5z" />
  </svg>
);

const SYMBOL = {
  brilliant: '‼',
  great: '!',
  best: '★',
  excellent: THUMB,
  good: '✓',
  book: BOOK,
  forced: '✓',
  inaccuracy: '?!',
  miss: '✕',
  mistake: '?',
  blunder: '⁇',
};

export default function ClassBadge({ tag, size = 24, title }) {
  const content = SYMBOL[tag] ?? '·';
  const isText = typeof content === 'string';
  return (
    <span
      className={`cbadge cbadge-${tag}`}
      title={title || tag}
      style={{
        width: size, height: size, minWidth: size,
        fontSize: tag === 'inaccuracy' || tag === 'blunder' ? size * 0.42 : size * 0.56,
      }}
    >
      {isText ? content : content}
    </span>
  );
}
