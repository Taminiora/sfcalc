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
  }));
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
  const targetOddsCost = bestPolicy.expectedMeso + bestPolicy.requiredSpares * replacementCostPerBoom;
  const reportedExpectedCost = replacementCostPerBoom > 0 ? expectedTotalCost : bestPolicy.expectedMeso;

  return {
    p50Cost: reportedExpectedCost,
    p75Cost: reportedExpectedCost,
    p95Cost: reportedExpectedCost,
    p85Cost: replacementCostPerBoom > 0 ? targetOddsCost : bestPolicy.expectedMeso,
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
    strategy: formatStrategyRows(bestPolicy.rows),
  };
}
