// Central tuning config for Game Review analysis + classification.
// The config-file indirection came from the parity PR (good structure);
// the VALUES are the verified baseline: classification bins are the published
// chess.com-style thresholds, empirically validated against Selim's real
// Game Review screenshots (3 games + Byrne-Fischer 1956). Do not change them
// without an in-app corpus run (see benchmark/) proving the change helps.
export const PARITY_CONFIG = {
  analysis: {
    qualityMovetime: { fast: 300, strong: 600, deep: 1200 },
    multipv: 2,
    maxBookPly: 16,
    evalClampCp: 1000,
    // WDL-derived win% is plumbed through (stockfish.js parses `wdl`), but
    // stays OFF until a corpus run shows it beats the logistic cp curve the
    // bins were calibrated on. Flipping this changes every classification.
    useWdl: false,
    // short games get a modest movetime boost — cheap, deeper where it matters
    shortGameBoost: 1.35,
    shortGameMaxPly: 24,
  },
  classification: {
    bestEpsilon: 0.5,
    excellentMax: 2,
    goodMax: 5,
    inaccuracyMax: 10,
    mistakeMax: 20,
  },
};
