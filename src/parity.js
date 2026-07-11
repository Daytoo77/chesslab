export function normalizeCounts(counts = {}) {
  const out = {};
  for (const [k, v] of Object.entries(counts || {})) out[k] = Number(v || 0);
  return out;
}

function absDelta(a, b) {
  if (a == null || b == null) return null;
  return Math.abs(a - b);
}

export function computeParityMetrics(expected, actual) {
  const eW = expected?.accuracy?.w ?? null;
  const eB = expected?.accuracy?.b ?? null;
  const aW = actual?.accuracy?.w ?? null;
  const aB = actual?.accuracy?.b ?? null;
  const rEW = expected?.rating?.w ?? null;
  const rEB = expected?.rating?.b ?? null;
  const rAW = actual?.rating?.w ?? null;
  const rAB = actual?.rating?.b ?? null;

  const tags = new Set([
    ...Object.keys(expected?.counts?.w || {}),
    ...Object.keys(expected?.counts?.b || {}),
    ...Object.keys(actual?.counts?.w || {}),
    ...Object.keys(actual?.counts?.b || {}),
  ]);

  const tagErrors = [];
  for (const t of tags) {
    const ew = expected?.counts?.w?.[t] || 0;
    const eb = expected?.counts?.b?.[t] || 0;
    const aw = actual?.counts?.w?.[t] || 0;
    const ab = actual?.counts?.b?.[t] || 0;
    tagErrors.push({ tag: t, whiteDelta: Math.abs(ew - aw), blackDelta: Math.abs(eb - ab), totalDelta: Math.abs(ew - aw) + Math.abs(eb - ab) });
  }
  tagErrors.sort((a, b) => b.totalDelta - a.totalDelta);

  return {
    accuracyDelta: { w: absDelta(eW, aW), b: absDelta(eB, aB) },
    ratingDelta: { w: absDelta(rEW, rAW), b: absDelta(rEB, rAB) },
    tagDeltaTotal: tagErrors.reduce((s, x) => s + x.totalDelta, 0),
    tagErrors,
  };
}

export function parityPasses(metrics, tolerance) {
  const accOk = (metrics.accuracyDelta.w == null || metrics.accuracyDelta.w <= tolerance.accuracyMaxDelta)
    && (metrics.accuracyDelta.b == null || metrics.accuracyDelta.b <= tolerance.accuracyMaxDelta);
  const ratingOk = (metrics.ratingDelta.w == null || metrics.ratingDelta.w <= tolerance.ratingMaxDelta)
    && (metrics.ratingDelta.b == null || metrics.ratingDelta.b <= tolerance.ratingMaxDelta);
  const tagsOk = metrics.tagDeltaTotal <= tolerance.tagDeltaTotalMax;
  return accOk && ratingOk && tagsOk;
}
