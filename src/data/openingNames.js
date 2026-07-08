// Compact opening-name book: SAN sequence -> name. Deepest match wins.
// Not exhaustive — tuned for common amateur play + this app's repertoire.
const BOOK = [
  ['e4', "King's Pawn Opening"],
  ['e4 e5', "King's Pawn Game"],
  ['e4 e5 Nf3', "King's Knight Opening"],
  ['e4 e5 Nf3 Nc6', "King's Knight: Normal Variation"],
  ['e4 e5 Nf3 Nc6 Bb5', 'Ruy López'],
  ['e4 e5 Nf3 Nc6 Bb5 a6', 'Ruy López: Morphy Defense'],
  ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7', 'Ruy López: Closed'],
  ['e4 e5 Nf3 Nc6 Bb5 a6 Bxc6', 'Ruy López: Exchange Variation'],
  ['e4 e5 Nf3 Nc6 Bb5 Nf6', 'Ruy López: Berlin Defense'],
  ['e4 e5 Nf3 Nc6 Bc4', 'Italian Game'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5', 'Italian: Giuoco Piano'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5 b4', 'Italian: Evans Gambit'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3', 'Giuoco Piano: Main Line'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'Italian: Two Knights Defense'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5', 'Two Knights: Knight Attack'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7', 'Two Knights: Fried Liver Attack'],
  ['e4 e5 Nf3 Nc6 d4', 'Scotch Game'],
  ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4', 'Scotch: Main Line'],
  ['e4 e5 Nf3 Nc6 Nc3', 'Three Knights Game'],
  ['e4 e5 Nf3 Nc6 Nc3 Nf6', 'Four Knights Game'],
  ['e4 e5 Nf3 Nf6', "Petrov's Defense"],
  ['e4 e5 Nf3 d6', 'Philidor Defense'],
  ['e4 e5 Bc4', "Bishop's Opening"],
  ['e4 e5 Bc4 Nf6', "Bishop's Opening: Berlin Defense"],
  ['e4 e5 Bc4 Nf6 d3', "Bishop's Opening: Vienna Hybrid"],
  ['e4 e5 Bc4 Bc5', "Bishop's Opening: Classical"],
  ['e4 e5 Nc3', 'Vienna Game'],
  ['e4 e5 Nc3 Nf6 f4', 'Vienna Gambit'],
  ['e4 e5 f4', "King's Gambit"],
  ['e4 e5 f4 exf4', "King's Gambit Accepted"],
  ['e4 e5 d4', 'Center Game'],
  ['e4 c5', 'Sicilian Defense'],
  ['e4 c5 Nf3', 'Sicilian: Open Approach'],
  ['e4 c5 Nf3 d6', 'Sicilian: Najdorf Setup'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian: Najdorf'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6', 'Sicilian: Dragon'],
  ['e4 c5 Nf3 Nc6', 'Sicilian: Old Sicilian'],
  ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6', 'Sicilian: Accelerated Dragon'],
  ['e4 c5 Nf3 e6', 'Sicilian: French Variation'],
  ['e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6', 'Sicilian: Taimanov'],
  ['e4 c5 c3', 'Sicilian: Alapin'],
  ['e4 c5 Nc3', 'Sicilian: Closed'],
  ['e4 c5 d4', 'Sicilian: Smith-Morra Gambit'],
  ['e4 e6', 'French Defense'],
  ['e4 e6 d4 d5', 'French: Normal Variation'],
  ['e4 e6 d4 d5 e5', 'French: Advance Variation'],
  ['e4 e6 d4 d5 exd5', 'French: Exchange Variation'],
  ['e4 e6 d4 d5 Nc3', 'French: Paulsen Variation'],
  ['e4 e6 d4 d5 Nc3 Nf6', 'French: Classical'],
  ['e4 e6 d4 d5 Nc3 Bb4', 'French: Winawer'],
  ['e4 e6 d4 d5 Nd2', 'French: Tarrasch'],
  ['e4 e6 Nf3 d5 e5', 'French: Alien-Gambit Setup'],
  ['e4 c6', 'Caro-Kann Defense'],
  ['e4 c6 d4 d5', 'Caro-Kann: Main Line'],
  ['e4 c6 d4 d5 e5', 'Caro-Kann: Advance Variation'],
  ['e4 c6 d4 d5 e5 Bf5', 'Caro-Kann: Advance, Classical'],
  ['e4 c6 d4 d5 exd5 cxd5', 'Caro-Kann: Exchange Variation'],
  ['e4 c6 d4 d5 exd5 cxd5 c4', 'Caro-Kann: Panov Attack'],
  ['e4 c6 d4 d5 Nc3', 'Caro-Kann: Classical Setup'],
  ['e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5', 'Caro-Kann: Classical'],
  ['e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6', 'Caro-Kann: Bronstein-Larsen'],
  ['e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7', 'Caro-Kann: Karpov Variation'],
  ['e4 c6 Nf3', 'Caro-Kann: Two Knights Setup'],
  ['e4 c6 Nf3 d5 exd5 cxd5 Ne5', 'Caro-Kann: Alien Gambit Line'],
  ['e4 c6 c4', 'Caro-Kann: Accelerated Panov'],
  ['e4 d5', 'Scandinavian Defense'],
  ['e4 d5 exd5 Qxd5', 'Scandinavian: Main Line'],
  ['e4 d5 exd5 Nf6', 'Scandinavian: Modern Variation'],
  ['e4 d6', 'Pirc Defense'],
  ['e4 d6 d4 Nf6 Nc3 g6', 'Pirc: Main Line'],
  ['e4 g6', 'Modern Defense'],
  ['e4 Nf6', 'Alekhine Defense'],
  ['e4 Nc6', 'Nimzowitsch Defense'],
  ['d4', "Queen's Pawn Opening"],
  ['d4 d5', "Queen's Pawn Game"],
  ['d4 d5 c4', "Queen's Gambit"],
  ['d4 d5 c4 dxc4', "Queen's Gambit Accepted"],
  ['d4 d5 c4 e6', "Queen's Gambit Declined"],
  ['d4 d5 c4 c6', 'Slav Defense'],
  ['d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4', 'Slav: Main Line'],
  ['d4 d5 c4 e6 Nc3 Nf6 Bg5', 'QGD: Classical'],
  ['d4 d5 Nf3', "Queen's Pawn: Zukertort"],
  ['d4 d5 Nf3 Nf6 e3', 'Colle System'],
  ['d4 d5 Bf4', 'London System'],
  ['d4 d5 Nf3 Nf6 Bf4', 'London System'],
  ['d4 Nf6 Bf4', 'London System: Indian Setup'],
  ['d4 Nf6 Nf3 d5 Bf4', 'London System'],
  ['d4 Nf6 Nf3 g6 Bf4', 'London vs King\'s Indian'],
  ['d4 Nf6 Nf3 e6 Bf4', 'London System'],
  ['d4 d5 e4', 'Blackmar-Diemer Gambit'],
  ['d4 Nf6', 'Indian Defense'],
  ['d4 Nf6 c4', 'Indian Game'],
  ['d4 Nf6 c4 e6', 'Indian: East Indian'],
  ['d4 Nf6 c4 e6 Nc3 Bb4', 'Nimzo-Indian Defense'],
  ['d4 Nf6 c4 e6 Nf3 b6', "Queen's Indian Defense"],
  ['d4 Nf6 c4 e6 g3', 'Catalan Opening'],
  ['d4 Nf6 c4 g6', "King's Indian / Grünfeld Complex"],
  ['d4 Nf6 c4 g6 Nc3 d5', 'Grünfeld Defense'],
  ['d4 Nf6 c4 g6 Nc3 Bg7', "King's Indian Defense"],
  ['d4 Nf6 c4 c5', 'Benoni Defense'],
  ['d4 Nf6 c4 c5 d5 b5', 'Benko Gambit'],
  ['d4 f5', 'Dutch Defense'],
  ['d4 d6', 'Old Indian Setup'],
  ['d4 g6', 'Modern Defense vs d4'],
  ['c4', 'English Opening'],
  ['c4 e5', 'English: Reversed Sicilian'],
  ['c4 c5', 'English: Symmetrical'],
  ['c4 Nf6', 'English: Anglo-Indian'],
  ['Nf3', 'Réti Opening'],
  ['Nf3 d5 c4', 'Réti: Main Line'],
  ['Nf3 d5 g3', "King's Indian Attack"],
  ['Nf3 Nf6 g3', "King's Indian Attack"],
  ['g3', "King's Fianchetto Opening"],
  ['b3', 'Nimzo-Larsen Attack'],
  ['f4', "Bird's Opening"],
  ['b4', 'Polish Opening'],
  ['e4 e5 Nf3 Nc6 Bc4 Nd4', 'Italian: Blackburne Shilling Gambit'],
  ['e4 e5 Ne2', 'Alapin Opening'],
  ['e4 f5', 'Fred Defense'],
  ['e4 b6', 'Owen Defense'],
];

// trie of SAN sequences
const root = {};
for (const [seq, name] of BOOK) {
  let node = root;
  for (const san of seq.split(' ')) {
    node.c = node.c || {};
    node = node.c[san] = node.c[san] || {};
  }
  node.name = name;
}

const strip = (s) => s.replace(/[+#?!]/g, '');

// Deepest book name matched by this SAN move list (or null).
export function openingName(sans) {
  let node = root;
  let best = null;
  for (const sanRaw of sans) {
    const san = strip(sanRaw);
    if (!node.c || !node.c[san]) break;
    node = node.c[san];
    if (node.name) best = node.name;
  }
  return best;
}

// Known book continuations after this SAN sequence — used as the bots'
// opening book so they play varied, human openings instead of engine moves.
export function bookContinuations(sans) {
  let node = root;
  for (const sanRaw of sans) {
    const san = strip(sanRaw);
    if (!node.c || !node.c[san]) return [];
    node = node.c[san];
  }
  return node.c ? Object.keys(node.c) : [];
}
