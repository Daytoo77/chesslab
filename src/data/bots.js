// Bot ladder. Below UCI_Elo's floor (1320) strength comes from Skill Level +
// shallow fixed-depth search + a dose of pure randomness; above it, from
// UCI_LimitStrength. "max" is the unthrottled engine.
export const BOTS = [
  { id: 'b400',  name: 'Pesto',    emoji: '🐣', elo: 400,  tagline: 'Just learned how the horsey moves.',        params: { skill: 0, depth: 1, random: 0.35 } },
  { id: 'b600',  name: 'Mila',     emoji: '🐥', elo: 600,  tagline: 'Hangs pieces, but with enthusiasm.',        params: { skill: 0, depth: 1, random: 0.15 } },
  { id: 'b800',  name: 'Rusty',    emoji: '🦊', elo: 800,  tagline: 'Knows what a fork is. Sometimes uses it.',  params: { skill: 1, depth: 2, random: 0.06 } },
  { id: 'b1000', name: 'Bruno',    emoji: '🐺', elo: 1000, tagline: 'Solid club beginner. Punishes free pieces.',params: { skill: 3, depth: 3 } },
  { id: 'b1200', name: 'Sage',     emoji: '🦉', elo: 1200, tagline: 'Careful and positional. Few freebies.',     params: { skill: 6, depth: 4 } },
  { id: 'b1400', name: 'Tiger',    emoji: '🐯', elo: 1400, tagline: 'Sharp club player. Will bite on mistakes.', params: { elo: 1400, movetime: 150 } },
  { id: 'b1600', name: 'Falka',    emoji: '🦅', elo: 1600, tagline: 'Sees most tactics. Keep your pieces safe.', params: { elo: 1600, movetime: 160 } },
  { id: 'b1800', name: 'Lynx',     emoji: '🐆', elo: 1800, tagline: 'Strong club level. Converts advantages.',   params: { elo: 1800, movetime: 180 } },
  { id: 'b2000', name: 'Orca',     emoji: '🦈', elo: 2000, tagline: 'Expert strength. Precision required.',      params: { elo: 2000, movetime: 200 } },
  { id: 'b2200', name: 'Drogon',   emoji: '🐉', elo: 2200, tagline: 'Master level. Tiny errors lose games.',     params: { elo: 2200, movetime: 240 } },
  { id: 'b2500', name: 'Unit-7',   emoji: '🤖', elo: 2500, tagline: 'Grandmaster strength. Good luck.',          params: { elo: 2500, movetime: 300 } },
  { id: 'bmax',  name: 'Stockfish',emoji: '👑', elo: 3200, tagline: 'Full power. Nobody beats this. Nobody.',    params: { movetime: 450 } },
];

export const botById = (id) => BOTS.find((b) => b.id === id) || BOTS[0];
