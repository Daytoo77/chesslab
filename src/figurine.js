// SAN -> figurine notation (♞f6 instead of Nf6) for move lists.
const FIG = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' };
export function fig(san) {
  return san.replace(/[KQRBN](?![a-z0-9]?=)/g, (c) => FIG[c] || c).replace(/=([QRBN])/g, (_, p) => '=' + FIG[p]);
}
