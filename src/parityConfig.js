export const PARITY_CONFIG = {
  analysis: {
    // Higher default budgets to reduce shallow tactical misses in short games.
    qualityMovetime: { fast: 450, strong: 1000, deep: 1800 },
    // More alternatives helps classify near-equal moves more like chess.com.
    multipv: 3,
    // Keep opening "Book" matching alive a bit longer.
    maxBookPly: 24,
    // Less aggressive eval clipping in decisive positions.
    evalClampCp: 2000,
  },
  classification: {
    // Corpus-calibrated bins (win% loss).
    bestEpsilon: 0.35,
    excellentMax: 1.8,
    goodMax: 4.8,
    inaccuracyMax: 9.5,
    mistakeMax: 19.0,
    // Confidence guardrails for near-equal alternatives.
    ambiguitySecondGapMax: 1.2,
    ambiguityWinLossMax: 2.2,
  },
};
