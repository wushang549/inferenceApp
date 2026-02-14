const DEFAULT_GLOBAL_MEAN = 3.6;
const DEFAULT_BAYES_M = 50;

export function clampToRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.max(1, Math.min(5, numeric));
}

export function getMatchLabel(score) {
  const value = clampToRating(score);
  if (value >= 4.6) {
    return "Great match";
  }
  if (value >= 4.0) {
    return "Good match";
  }
  if (value >= 3.3) {
    return "Worth a try";
  }
  return "Long shot";
}

export function computeGlobalMeanRating(statsByMovieId) {
  if (!statsByMovieId || statsByMovieId.size === 0) {
    return DEFAULT_GLOBAL_MEAN;
  }

  let weightedSum = 0;
  let totalCount = 0;

  for (const stats of statsByMovieId.values()) {
    const avg = Number(stats?.avg_rating);
    const count = Number(stats?.num_ratings);
    if (!Number.isFinite(avg)) {
      continue;
    }

    const safeCount = Number.isFinite(count) && count > 0 ? count : 0;
    if (safeCount > 0) {
      weightedSum += avg * safeCount;
      totalCount += safeCount;
    } else {
      weightedSum += avg;
      totalCount += 1;
    }
  }

  if (totalCount <= 0) {
    return DEFAULT_GLOBAL_MEAN;
  }

  return weightedSum / totalCount;
}

export function scoreMovieForRanking({
  predictedRating,
  communityAvg,
  communityCount,
  globalMean = DEFAULT_GLOBAL_MEAN,
  bayesM = DEFAULT_BAYES_M,
}) {
  const predClamped = clampToRating(predictedRating);
  const avg = Number(communityAvg);
  const nRaw = Number(communityCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : 0;
  const hasCommunity = Number.isFinite(avg) && n > 0;

  let bayesAvg = null;
  let finalScore;

  if (hasCommunity) {
    bayesAvg = (n / (n + bayesM)) * avg + (bayesM / (n + bayesM)) * globalMean;
    finalScore = 0.75 * predClamped + 0.25 * bayesAvg;
  } else {
    finalScore = predClamped - 0.25;
  }

  const penalty = 0.35 * Math.exp(-n / 20);
  finalScore -= penalty;

  return {
    predClamped,
    bayesAvg,
    finalScore,
    penalty,
    communityCount: n,
  };
}
