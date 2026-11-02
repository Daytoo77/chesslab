import React from 'react';

// A small white/black disc marking which side a player or line belongs to.
export default function SideDot({ side }) {
  return <span className={`side-dot ${side === 'w' ? 'w' : 'b'}`} aria-label={side === 'w' ? 'White' : 'Black'} role="img" />;
}
