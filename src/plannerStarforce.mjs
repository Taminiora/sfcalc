import {
  calculateSpareProbability,
  findRequiredSpares,
  getBoomPercentile,
} from "./sfBoomProbability.mjs";
import { formatStarforceStrategyForSource } from "./sfPolicyEvaluation.mjs";
import {
  getBestPolicyForBenchmark,
  getBestPolicyForSpareCount,
  getCheapestPolicy,
} from "./sfStrategySelection.mjs";
import {
  MAX_TARGET_STAR,
  MIN_STAR,
  assertFiniteNumber,
  normalizeEvents,
} from "./sfTapMath.mjs";

export { calculateSpareProbability, findRequiredSpares, formatStarforceStrategyForSource };

const OPTIMIZE_STARFORCE_CACHE_LIMIT = 50;
const optimizeStarforceCache = new Map();

function validateStarRange({ itemLevel, startStar, targetStar }) {
  assertFiniteNumber(itemLevel, "Item level");

  if (!Number.isInteger(startStar) || !Number.isInteger(targetStar)) {
    throw new Error("Start star and target star must be integers");
  }

  if (startStar < MIN_STAR || targetStar > MAX_TARGET_STAR || targetStar <= startStar) {
    throw new Error(`Star range must stay between ${MIN_STAR} and ${MAX_TARGET_STAR}`);
  }
}

function validateSpareCount(spareCount) {
  if (!Number.isInteger(spareCount) || spareCount < 0) {
    throw new Error("Spare count must be a non-negative integer");
  }
}

function validateHitProbability(hitProbability) {
  assertFiniteNumber(hitProbability, "Hit probability");
  if (hitProbability <= 0 || hitProbability > 1) {
    throw new Error("Hit probability must be between 0 and 100%");
  }
}

function formatStrategyRows(rows) {
  return rows.map((row) => ({
    star: row.star,
    nextStar: row.nextStar,
    mode: row.mode,
    ...(row.displayMode ? { displayMode: row.displayMode } : {}),
    tapCost: row.tapCost,
    successRate: row.successRate,
    boomProbability: row.boomProbability,
    failureProbability: row.failureProbability,
    expectedMeso: row.expectedMeso,
    expectedBooms: row.expectedBooms,
    mesoVariance: row.mesoVariance,
    boomVariance: row.boomVariance,
  }));
}

function normalQuantile(probability) {
  if (probability <= 0) {
    return -Infinity;
  }
  if (probability >= 1) {
    return Infinity;
  }

  // Abramowitz and Stegun 26.2.17, mirrored around 0.5.
  const numerator = [2.515517, 0.802853, 0.010328];
  const denominator = [1.432788, 0.189269, 0.001308];
  const tailProbability = probability < 0.5 ? probability : 1 - probability;
  const t = Math.sqrt(-2 * Math.log(tailProbability));
  const z =
    t -
    (numerator[0] + t * (numerator[1] + t * numerator[2])) /
      (1 + t * (denominator[0] + t * (denominator[1] + t * denominator[2])));

  return probability < 0.5 ? -z : z;
}

function getLognormalPercentile(mean, variance, percentile) {
  if (!Number.isFinite(mean) || mean <= 0 || !Number.isFinite(variance) || variance <= 0) {
    return mean;
  }

  const coefficientOfVariationSquared = variance / mean ** 2;
  const sigmaSquared = Math.log(1 + coefficientOfVariationSquared);
  const logMean = Math.log(mean) - sigmaSquared / 2;

  return Math.exp(logMean + normalQuantile(percentile) * Math.sqrt(sigmaSquared));
}

function cloneOptimizeResult(result) {
  return {
    ...result,
    boomDistribution: new Map(result.boomDistribution),
    strategy: result.strategy.map((row) => ({ ...row })),
  };
}

function getOptimizeStarforceCacheKey({
  itemLevel,
  startStar,
  targetStar,
  sfFdGain,
  benchmarkFdPerMeso,
  hitProbability,
  events,
  replacementCostPerBoom = 0,
}) {
  const normalizedEvents = normalizeEvents(events);
  return JSON.stringify([
    itemLevel,
    startStar,
    targetStar,
    sfFdGain,
    benchmarkFdPerMeso,
    hitProbability,
    normalizedEvents.starCatch,
    normalizedEvents.costReduction30,
    normalizedEvents.boomReduction30,
    replacementCostPerBoom,
  ]);
}

function readOptimizeStarforceCache(cacheKey) {
  const cached = optimizeStarforceCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  optimizeStarforceCache.delete(cacheKey);
  optimizeStarforceCache.set(cacheKey, cached);
  return cloneOptimizeResult(cached);
}

function writeOptimizeStarforceCache(cacheKey, result) {
  optimizeStarforceCache.set(cacheKey, cloneOptimizeResult(result));
  if (optimizeStarforceCache.size > OPTIMIZE_STARFORCE_CACHE_LIMIT) {
    const [oldestKey] = optimizeStarforceCache.keys();
    optimizeStarforceCache.delete(oldestKey);
  }
}

export function optimizeStarforce({
  itemLevel,
  startStar,
  targetStar,
  sfFdGain,
  benchmarkFdPerMeso,
  hitProbability,
  events,
  replacementCostPerBoom = 0,
}) {
  validateStarRange({ itemLevel, startStar, targetStar });
  assertFiniteNumber(sfFdGain, "SF FD gain");
  assertFiniteNumber(benchmarkFdPerMeso, "Benchmark FD per meso");
  validateHitProbability(hitProbability);

  const normalizedEvents = normalizeEvents(events);
  const cacheKey = getOptimizeStarforceCacheKey({
    itemLevel,
    startStar,
    targetStar,
    sfFdGain,
    benchmarkFdPerMeso,
    hitProbability,
    events: normalizedEvents,
    replacementCostPerBoom,
  });
  const cachedResult = readOptimizeStarforceCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const bestPolicy = getBestPolicyForBenchmark({
    itemLevel,
    startStar,
    targetStar,
    sfFdGain,
    benchmarkFdPerMeso,
    hitProbability,
    events: normalizedEvents,
    replacementCostPerBoom,
  });
  const totalExpectedCost =
    bestPolicy.expectedMeso + bestPolicy.expectedBooms * replacementCostPerBoom;
  const fdPerMeso = sfFdGain / totalExpectedCost;

  const result = {
    startStar,
    targetStar,
    itemLevel,
    availableSpares: bestPolicy.availableSpares,
    sfFdGain,
    expectedMeso: bestPolicy.expectedMeso,
    expectedReplacementCost: bestPolicy.expectedBooms * replacementCostPerBoom,
    expectedBooms: bestPolicy.expectedBooms,
    totalExpectedCost,
    fdPerMeso,
    benchmarkFdPerMeso,
    meetsBenchmark: fdPerMeso >= benchmarkFdPerMeso,
    requiredSpares: bestPolicy.requiredSpares,
    achievedProbability: bestPolicy.achievedProbability,
    guaranteeMet: bestPolicy.guaranteeMet,
    boomDistribution: bestPolicy.boomDistribution,
    strategy: formatStrategyRows(bestPolicy.rows),
  };
  writeOptimizeStarforceCache(cacheKey, result);
  return cloneOptimizeResult(result);
}

export function calculateStarforceProfileCosts({
  itemLevel,
  startStar,
  targetStar,
  spareCount,
  hitProbability,
  events,
  replacementCostPerBoom = 0,
}) {
  validateStarRange({ itemLevel, startStar, targetStar });
  validateHitProbability(hitProbability);
  if (spareCount !== undefined) {
    validateSpareCount(spareCount);
  }

  const bestPolicy =
    spareCount === undefined
      ? getCheapestPolicy({
          itemLevel,
          startStar,
          targetStar,
          hitProbability,
          events,
          replacementCostPerBoom,
        })
      : getBestPolicyForSpareCount({
          itemLevel,
          startStar,
          targetStar,
          spareCount,
          hitProbability,
          events,
          replacementCostPerBoom,
        });
  const p50Booms = getBoomPercentile(bestPolicy.boomDistribution, 0.5);
  const p75Booms = getBoomPercentile(bestPolicy.boomDistribution, 0.75);
  const p95Booms = getBoomPercentile(bestPolicy.boomDistribution, 0.95);
  const expectedReplacementCost = bestPolicy.expectedBooms * replacementCostPerBoom;
  const expectedTotalCost = bestPolicy.expectedMeso + expectedReplacementCost;
  const p50MesoCost = getLognormalPercentile(bestPolicy.expectedMeso, bestPolicy.mesoVariance, 0.5);
  const p75MesoCost = getLognormalPercentile(bestPolicy.expectedMeso, bestPolicy.mesoVariance, 0.75);
  const p95MesoCost = getLognormalPercentile(bestPolicy.expectedMeso, bestPolicy.mesoVariance, 0.95);
  const targetOddsMesoCost = getLognormalPercentile(
    bestPolicy.expectedMeso,
    bestPolicy.mesoVariance,
    hitProbability,
  );
  const targetOddsCost = targetOddsMesoCost + bestPolicy.requiredSpares * replacementCostPerBoom;
  const reportedExpectedCost = replacementCostPerBoom > 0 ? expectedTotalCost : bestPolicy.expectedMeso;

  return {
    p50Cost: p50MesoCost + (replacementCostPerBoom > 0 ? expectedReplacementCost : 0),
    p75Cost: p75MesoCost + (replacementCostPerBoom > 0 ? expectedReplacementCost : 0),
    p95Cost: p95MesoCost + (replacementCostPerBoom > 0 ? expectedReplacementCost : 0),
    pTargetCost: replacementCostPerBoom > 0 ? targetOddsCost : targetOddsMesoCost,
    p50Booms,
    p75Booms,
    p95Booms,
    availableSpares: bestPolicy.availableSpares,
    requiredSpares: bestPolicy.requiredSpares,
    achievedProbability: bestPolicy.achievedProbability,
    guaranteeMet: bestPolicy.guaranteeMet,
    expectedMeso: bestPolicy.expectedMeso,
    expectedReplacementCost,
    expectedTotalCost,
    expectedBooms: bestPolicy.expectedBooms,
    mesoVariance: bestPolicy.mesoVariance,
    boomVariance: bestPolicy.boomVariance,
    strategy: formatStrategyRows(bestPolicy.rows),
  };
}
