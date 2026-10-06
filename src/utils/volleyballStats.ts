/**
 * Volleyball Analytics: Comprehensive Passing Index (Quantity + Quality)
 *
 * Combines:
 * 1. Quality Component (Bayesian Stabilized Quality):
 *    Q_adj = (Sum of Scores + m * B) / (N + m)
 *    where m = 4 (prior attempt weight) and B = 2.0 (neutral 2-pass benchmark).
 *    This stabilizes sample sizes so a single 3-pass (1 attempt) does not skew the rating.
 *
 * 2. Quantity Component (Workload Volume Scaling):
 *    V(N) = 1 + 0.08 * ln(1 + N)
 *    Reward high reception volume under serve pressure.
 *
 * 3. Unified Passing Index (0–100 Scale):
 *    Passing Index = round( (Q_adj / 3.0) * 100 * (1 + 0.08 * ln(1 + N)) )
 *    Bounded within [0, 100].
 */

export function calculatePassingIndex(sum: number, attempts: number): number {
  if (!attempts || attempts <= 0) return 0;
  const priorWeight = 4;
  const baselineBenchmark = 2.0;
  const qAdj = (sum + priorWeight * baselineBenchmark) / (attempts + priorWeight);
  const volumeMultiplier = 1 + 0.08 * Math.log(1 + attempts);
  const rawIndex = (qAdj / 3.0) * 100 * volumeMultiplier;
  return Math.round(Math.min(100, Math.max(0, rawIndex)));
}

export function calculateAdjustedPassQuality(sum: number, attempts: number): number {
  if (!attempts || attempts <= 0) return 0;
  const priorWeight = 4;
  const baselineBenchmark = 2.0;
  return (sum + priorWeight * baselineBenchmark) / (attempts + priorWeight);
}
