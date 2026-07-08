// Tactics library. Every puzzle is validated programmatically:
// the solution line is legal and ends in checkmate or a decisive material gain.
// `solution` alternates player move / scripted opponent reply.
export const PUZZLES = [
  {
    id: 'back-rank',
    title: 'One Door, No Exit',
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    solution: ['Rd8#'],
    motif: 'Back-rank mate',
    hint: 'The black king has no luft — his own pawns are the prison bars.',
    explanation:
      "Rd8# exploits the classic back-rank weakness: the f7-g7-h7 pawns block every escape square, so a single rook check along the 8th rank is mate. Pattern to remember: whenever the enemy king sits behind unmoved pawns, count the defenders of the back rank — if your heavy piece outnumbers them, the rank is yours.",
  },
  {
    id: 'smothered',
    title: 'The Suffocated King',
    fen: '6rk/6pp/8/4N3/8/8/6PP/6K1 w - - 0 1',
    solution: ['Nf7#'],
    motif: 'Smothered mate',
    hint: 'The king is buried by his own army. Only one piece can check without being captured.',
    explanation:
      "Nf7# is a smothered mate: the king on h8 is completely walled in by his own rook and pawns, so the knight — the only piece that attacks 'through' a crowd — delivers mate alone. The full classic version (Philidor's Legacy) forces this setup with Qg8+! Rxg8 first. Whenever a king is cornered with no flight squares, look for a knight check.",
  },
  {
    id: 'royal-fork',
    title: 'Two Targets, One Knight',
    fen: '8/4kp2/3q4/8/8/6N1/5PPP/6K1 w - - 0 1',
    solution: ['Nf5+', 'Ke8', 'Nxd6+'],
    motif: 'Knight fork (royal fork)',
    hint: 'Find the square from which the knight attacks both king and queen at once.',
    explanation:
      'Nf5+ forks king and queen: f5 attacks both e7 and d6, the check forces the king to step away, and the queen falls. Knight forks work because a knight attacks squares of one color from a square of the other — the queen on d6 could never capture its attacker. Drill: in any position, scan which enemy pieces stand a knight-move apart from each other.',
  },
  {
    id: 'skewer',
    title: 'X-Ray Through the King',
    fen: '3q4/7p/5kp1/8/7P/8/3B1PP1/6K1 w - - 0 1',
    solution: ['Bg5+', 'Kf5', 'Bxd8'],
    motif: 'Skewer',
    hint: 'King and queen share a diagonal. Check the king and the queen is left behind.',
    explanation:
      "Bg5+ is a skewer — the reverse of a pin. The king and queen stand on the same h4–d8 diagonal with the king in front: the check forces the king to move, exposing the queen behind it. Note the detail that makes it work: the h4-pawn protects g5, so Kxg5 is illegal. Always check whether your skewering piece is defended.",
  },
  {
    id: 'discovered',
    title: 'The Mask Drops',
    fen: '4kb1r/5ppp/8/4N3/8/8/5PPP/4R1K1 w k - 0 1',
    solution: ['Ng6', 'Be7', 'Nxh8'],
    motif: 'Discovered check',
    hint: 'The knight is a mask in front of your rook. Move it somewhere profitable.',
    explanation:
      "Ng6! is a discovered check: the knight steps off the e-file, the rook on e1 checks the king, and Black cannot deal with both problems — hxg6 is illegal because the rook check must be answered first. After the forced block Be7, Nxh8 wins the exchange. Discovered checks let the moving piece do anything it wants for free: always ask what your 'mask' piece could grab.",
  },
  {
    id: 'pin-pile',
    title: 'Pile on the Pinned',
    fen: 'r3k3/pp3ppp/2n5/1B6/3P4/8/5PPP/6K1 w - - 0 1',
    solution: ['d5', 'a6', 'dxc6', 'axb5', 'cxb7', 'Ra7', 'b8=Q+', 'Ke7', 'Qxa7+'],
    motif: 'Pin — attacking the pinned piece',
    hint: 'The c6-knight cannot move. What do you do to a piece that cannot run?',
    explanation:
      'The knight on c6 is absolutely pinned by the b5-bishop — it cannot legally move. The winning idea is not to capture it immediately but to attack it again with d5!. A pinned piece is effectively paralyzed, so every new attacker counts double. The pawn crashes through: dxc6 and cxb7 nets a piece and creates an unstoppable passed pawn against the a8-rook.',
  },
  {
    id: 'greek-gift',
    title: 'The Greek Gift',
    fen: 'rnb2rk1/ppppqppp/8/8/3P4/3B1N2/PPP2PPP/2BQ1RK1 w - - 0 1',
    solution: ['Bxh7+', 'Kxh7', 'Ng5+', 'Kg8', 'Qh5', 'Re8', 'Qh7+', 'Kf8', 'Qh8#'],
    motif: 'Greek gift sacrifice (Bxh7+)',
    hint: 'The classic bishop sacrifice on h7. Three pieces take part: bishop, knight, queen.',
    explanation:
      "Bxh7+! is the Greek gift, the most famous attacking pattern in chess. The recipe needs three ingredients: a bishop hitting h7, a knight that reaches g5 with check, and a queen with a road to h5. After Kxh7, Ng5+ Kg8, Qh5 the threat of Qh7# is decisive — the king hunt ends with Qh7+ Kf8 Qh8#. Before sacrificing, always verify the king can't escape via e7/f5 and that no defender reaches the h-file in time.",
  },
  {
    id: 'breakthrough',
    title: 'Three vs Three Breakthrough',
    fen: '7k/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
    solution: ['b6', 'cxb6', 'a6', 'bxa6', 'c6', 'b5', 'c7', 'b4', 'c8=Q+'],
    motif: 'Pawn breakthrough',
    hint: 'Sacrifice two pawns so the third becomes a queen. Start in the middle.',
    explanation:
      'b6! is the textbook pawn breakthrough: White gives up two pawns to clear the road for the third. After cxb6 a6! bxa6 c6, the c-pawn is past every defender and queens by force (the mirror works too: axb6 is met by c6!). The pattern only works because the black king is outside the square of the c-pawn — count the king race before you commit.',
  },
  {
    id: 'battery-mate',
    title: 'Knight Opens, Queen Finishes',
    fen: '5rk1/5ppp/8/5N1Q/8/8/6P1/6KR w - - 0 1',
    solution: ['Ne7+', 'Kh8', 'Qxh7#'],
    motif: 'Battery mate (Anastasia pattern)',
    hint: 'First drive the king into the corner with a knight check, then look at h7.',
    explanation:
      'Ne7+ forces Kh8 (f7 is covered by the queen), and then Qxh7# works only because of the battery: the rook on h1 backs up the queen along the h-file, so Kxh7 would be moving into check. This knight-on-e7 + heavy-piece-on-the-h-file construction is the Anastasia family of mates. The lesson: a defended queen can stand right next to the enemy king.',
  },
  {
    id: 'double-check',
    title: 'Two Checks, Zero Answers',
    fen: '3qkb1r/3p2pp/8/8/2B1N3/8/5PPP/4R1K1 w - - 0 1',
    solution: ['Nd6#'],
    motif: 'Double check',
    hint: 'One knight move gives check twice at the same time. The king cannot block or capture two attackers.',
    explanation:
      "Nd6# is a double check: the knight attacks e8 directly while unmasking the e1-rook. Against a double check the only legal answer is a king move — blocking or capturing can never parry both attackers — and here every square is taken: d8 and f8 by Black's own pieces, d7 by the pawn, f7 by the c4-bishop, e7 by the rook. Double check is the most forcing move in chess; hunt for it whenever your pieces line up behind each other.",
  },
  {
    id: 'ladder-rook',
    title: 'The Lawnmower',
    fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1',
    solution: ['Rb8#'],
    motif: 'Lawnmower (two-rook) mate',
    hint: 'One rook seals the 7th rank. The other one mows the 8th.',
    explanation: 'Rb8# is the lawnmower mate: the a7-rook fences off the 7th rank, so the second rook simply checks along the 8th — nothing can block, nothing can run. With two rooks (or rook+queen), alternate ranks like mowing a lawn and the king never escapes the edge.',
  },
  {
    id: 'queen-king-mate',
    title: 'The Final Squeeze',
    fen: '6k1/8/6K1/8/8/8/8/3Q4 w - - 0 1',
    solution: ['Qd8#'],
    motif: 'Queen + king mate',
    hint: 'The kings stand face to face — finish on the back rank.',
    explanation: 'Qd8# works because your king controls f7, g7 and h7 — the queen only has to seal the 8th rank. Remember the K+Q technique: box the king to the edge with queen-a-knight\'s-move-away, bring your king, mate. And never stalemate: always leave one square until your king arrives.',
  },
];
