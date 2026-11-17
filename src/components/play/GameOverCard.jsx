import React from 'react';
import Icon from '../Icon.jsx';

export default function GameOverCard({ result, hintsUsed, canReview, onReview, onCopyPgn }) {
  if (!result) return null;
  return (
    <div className={`gameover-card ${result.outcome === 'w' ? 'win' : result.outcome === 'l' ? 'loss' : 'draw'}`}>
      <div className="go-title">
        <Icon name={result.outcome === 'w' ? 'win' : result.outcome === 'l' ? 'loss' : 'draw'} size={22} />
        {result.outcome === 'w' ? 'You won!' : result.outcome === 'l' ? 'You lost' : 'Draw'}
      </div>
      <div className="go-reason">{result.reason}{hintsUsed > 0 ? ` · ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} used` : ''}</div>
      <div className="btn-row">
        {canReview && <button className="btn primary" onClick={onReview}><Icon name="review" size={16} /> Game Review</button>}
        <button className="btn" onClick={onCopyPgn}><Icon name="copy" size={16} /> Copy PGN</button>
      </div>
    </div>
  );
}
