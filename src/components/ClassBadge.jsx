import React from 'react';
import Icon from './Icon.jsx';

// Circular move-classification badge: coloured disc (colour from the --c-*
// tokens) carrying either the standard annotation mark (!!, !, ?!, ?, ??) or a
// stroke icon. Our own drawing, not another site's artwork.
const MARK = {
  brilliant: '!!',
  great: '!',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};
const ICON = {
  best: 'best',
  excellent: 'excellent',
  good: 'good',
  book: 'book',
  forced: 'forced',
  miss: 'miss',
};

export default function ClassBadge({ tag, size = 24, title }) {
  const mark = MARK[tag];
  return (
    <span
      className={`cbadge cbadge-${tag}`}
      title={title || tag}
      style={{
        width: size, height: size, minWidth: size,
        fontSize: mark && mark.length > 1 ? size * 0.42 : size * 0.56,
        letterSpacing: mark && mark.length > 1 ? '-0.04em' : undefined,
      }}
    >
      {mark || (ICON[tag]
        ? <Icon name={ICON[tag]} size={Math.round(size * 0.6)} strokeWidth={3} fill={tag === 'best' ? 'currentColor' : 'none'} />
        : '·')}
    </span>
  );
}
