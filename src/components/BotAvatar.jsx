import React from 'react';

// Generated bot avatar: a monogram tile whose hue walks from cool green
// (beginner) through blue and violet to crimson (full-strength engine), with
// a strength meter along the bottom. No emoji, no image assets, works offline.
const MIN = 400;
const MAX = 3200;

export function botHue(elo) {
  const t = Math.min(1, Math.max(0, (elo - MIN) / (MAX - MIN)));
  return Math.round(150 + t * 200); // 150 = green … 350 = crimson
}

export default function BotAvatar({ bot, size = 44 }) {
  if (!bot) return null;
  const hue = botHue(bot.elo);
  const level = Math.max(1, Math.min(5, Math.ceil(((bot.elo - MIN) / (MAX - MIN)) * 5) || 1));
  const initials = bot.name.replace(/[^A-Za-z0-9]/g, '').slice(0, bot.name.length > 6 ? 1 : 2);
  return (
    <span
      className="bot-avatar"
      style={{ '--hue': hue, width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      <span className="bot-avatar-mono">{initials}</span>
      <span className="bot-avatar-meter">
        {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}
      </span>
    </span>
  );
}
