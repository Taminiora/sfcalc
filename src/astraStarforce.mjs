import { getPrunedPolicyCandidates } from "./sfPolicyEvaluation.mjs";
import { RESTORE_LEVEL } from "./starforce.mjs";
import {
  MAX_TARGET_STAR,
  MIN_STAR,
  assertFiniteNumber,
  getAdjustedTap,
  getModeId,
  getTier,
  normalizeEvents,
} from "./sfTapMath.mjs";

export const ASTRA_ITEM_LEVEL = 200;
export const ASTRA_REPLACEMENT_COST = 1_000_000_000;

const ASTRA_CANDIDATE_LIMIT = 32;
const ASTRA_CACHE_LIMIT = 50;
const astraCandidateCache = new Map();
const astraResultCache = new Map();

function validateAstraRange({ startStar, targetStar }) {
  if (!Number.isInteger(startStar) || !Number.isInteger(targetStar)) {
    throw new Error("Start star and target star must be integers");
  }

  if (startStar < MIN_STAR || targetStar > MAX_TARGET_STAR || targetStar <= startStar) {
    throw new Error(`Star range must stay between ${MIN_STAR} and ${MAX_TARGET_STAR}`);
  }
}

function validateHitProbability(hitProbability) {
  assertFiniteNumber(hitProbability, "Hit probability");
  if (hitProbability <= 0 || hitProbability > 1) {
    throw new Error("Hit probability must be between 0 and 100%");
  }
}

function getEventsCacheParts(events) {
  const normalizedEvents = normalizeEvents(events);
  return [
    normalizedEvents.starCatch,
    normalizedEvents.costReduction30,
    normalizedEvents.boomReduction30,
  ];
}

function getCandidateCacheKey({ startStar, targetStar, events }) {
  return JSON.stringify([startStar, targetStar, ...getEventsCacheParts(events)]);
}

function getResultCacheKey({ startStar, targetStar, hitProbability, events }) {
  return JSON.stringify([startStar, targetStar, hitProbability, ...getEventsCacheParts(events)]);
}

function writeLimitedCache(cache, key, value) {
  cache.set(key, value);
  if (cache.size > ASTRA_CACHE_LIMIT) {
    const [oldestKey] = cache.keys();
    cache.delete(oldestKey);
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

function cloneResult(result) {
  return {
    ...result,
    strategy: result.strategy.map((row) => ({ ...row })),
  };
}

function getExpectedReplacementTotal(policy) {
  return policy.expectedMeso + policy.expectedBooms * ASTRA_REPLACEMENT_COST;
}

function getAstraCandidatePolicies({ startStar, targetStar, events }) {
  const normalizedEvents = normalizeEvents(events);
  const cacheKey = getCandidateCacheKey({ startStar, targetStar, events: normalizedEvents });
  const cached = astraCandidateCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const policies = getPrunedPolicyCandidates({
    itemLevel: ASTRA_ITEM_LEVEL,
    startStar,
    targetStar,
    events: normalizedEvents,
  });
  const selectedPolicies = new Map();
  const addPolicies = (candidates) => {
    for (const candidate of candidates.slice(0, ASTRA_CANDIDATE_LIMIT)) {
      selectedPolicies.set(JSON.stringify([...candidate.modeMap.entries()]), candidate);
    }
  };

  addPolicies(
    [...policies].sort(
      (left, right) =>
        getExpectedReplacementTotal(left) - getExpectedReplacementTotal(right) ||
        left.expectedBooms - right.expectedBooms,
    ),
  );
  addPolicies(
    [...policies].sort(
      (left, right) =>
        left.expectedBooms - right.expectedBooms ||
        getExpectedReplacementTotal(left) - getExpectedReplacementTotal(right),
    ),
  );
  addPolicies([...policies].sort((left, right) => left.expectedMeso - right.expectedMeso));

  const candidates = [...selectedPolicies.values()].map((policy) => ({
    ...policy,
    normalizedEvents,
  }));
  writeLimitedCache(astraCandidateCache, cacheKey, candidates);
  return candidates;
}

function addProbability(map, key, probability) {
  map.set(key, (map.get(key) ?? 0) + probability);
}

function getEventRaceProbabilities(tap) {
  const eventProbability = tap.successRate + tap.boomProbability;
  return {
    successBeforeBoomProbability: tap.successRate / eventProbability,
    boomBeforeSuccessProbability: tap.boomProbability / eventProbability,
  };
}

function getRaceOutcome({ star, targetStar, policy, memo }) {
  const cached = memo.get(star);
  if (cached) {
    return cached;
  }

  const mode = getModeId(policy.modeMap, star);
  const tier = getTier(star, mode);
  const tap = getAdjustedTap({
    itemLevel: ASTRA_ITEM_LEVEL,
    star,
    tier,
    events: policy.normalizedEvents,
  });
  const { successBeforeBoomProbability, boomBeforeSuccessProbability } =
    getEventRaceProbabilities(tap);
  let successProbability = 0;
  const boomTransitions = new Map();

  if (star + 1 >= targetStar) {
    successProbability += successBeforeBoomProbability;
  } else {
    const nextOutcome = getRaceOutcome({
      star: star + 1,
      targetStar,
      policy,
      memo,
    });
    successProbability += successBeforeBoomProbability * nextOutcome.successProbability;
    for (const [nextStar, probability] of nextOutcome.boomTransitions) {
      addProbability(boomTransitions, nextStar, successBeforeBoomProbability * probability);
    }
  }

  if (boomBeforeSuccessProbability > 0) {
    addProbability(
      boomTransitions,
      RESTORE_LEVEL[star] ?? star,
      boomBeforeSuccessProbability,
    );
  }

  const outcome = { successProbability, boomTransitions };
  memo.set(star, outcome);
  return outcome;
}

function createZeroMatrix(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

function multiplyMatrices(left, right) {
  const size = left.length;
  const result = createZeroMatrix(size);

  for (let row = 0; row < size; row += 1) {
    for (let mid = 0; mid < size; mid += 1) {
      if (left[row][mid] === 0) {
        continue;
      }
      for (let column = 0; column < size; column += 1) {
        result[row][column] += left[row][mid] * right[mid][column];
      }
    }
  }

  return result;
}

function multiplyVectorMatrix(vector, matrix) {
  const result = Array.from({ length: vector.length }, () => 0);

  for (let row = 0; row < vector.length; row += 1) {
    if (vector[row] === 0) {
      continue;
    }
    for (let column = 0; column < vector.length; column += 1) {
      result[column] += vector[row] * matrix[row][column];
    }
  }

  return result;
}

function buildBoomTransitionChain({ policy, startStar, targetStar }) {
  const memo = new Map();
  const states = [startStar];
  const seenStates = new Set(states);

  for (let index = 0; index < states.length; index += 1) {
    const outcome = getRaceOutcome({
      star: states[index],
      targetStar,
      policy,
      memo,
    });
    for (const nextStar of outcome.boomTransitions.keys()) {
      if (!seenStates.has(nextStar)) {
        seenStates.add(nextStar);
        states.push(nextStar);
      }
    }
  }

  const stateIndex = new Map(states.map((star, index) => [star, index]));
  const matrix = createZeroMatrix(states.length);
  for (const star of states) {
    const row = stateIndex.get(star);
    const outcome = getRaceOutcome({ star, targetStar, policy, memo });
    for (const [nextStar, probability] of outcome.boomTransitions) {
      matrix[row][stateIndex.get(nextStar)] += probability;
    }
  }

  return {
    matrix,
    startIndex: stateIndex.get(startStar),
  };
}

function createMatrixPowerEvaluator(chain) {
  const powers = [chain.matrix];
  const startVector = Array.from({ length: chain.matrix.length }, (_, index) =>
    index === chain.startIndex ? 1 : 0,
  );

  function ensurePowers(power) {
    while (2 ** powers.length <= power) {
      const lastPower = powers.at(-1);
      powers.push(multiplyMatrices(lastPower, lastPower));
    }
  }

  return function getFailureProbabilityAfterBooms(boomCount) {
    let power = boomCount + 1;
    let bit = 0;
    let vector = startVector;
    ensurePowers(power);

    while (power > 0) {
      if (power % 2 === 1) {
        vector = multiplyVectorMatrix(vector, powers[bit]);
      }
      power = Math.floor(power / 2);
      bit += 1;
    }

    return vector.reduce((sum, probability) => sum + probability, 0);
  };
}

function getRequiredBoomsForPolicy({ policy, startStar, targetStar, hitProbability }) {
  let low = 0;
  let high = Math.max(1, Math.ceil(policy.expectedBooms));
  const targetFailureProbability = 1 - hitProbability;
  const getFailureProbabilityAfterBooms = createMatrixPowerEvaluator(
    buildBoomTransitionChain({ policy, startStar, targetStar }),
  );

  while (
    getFailureProbabilityAfterBooms(high) - 1e-12 >
    targetFailureProbability
  ) {
    low = high + 1;
    high *= 2;
    if (high > 10_000_000) {
      throw new Error("Could not reach target odds for Astra strategy");
    }
  }

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (
      getFailureProbabilityAfterBooms(mid) - 1e-12 <=
      targetFailureProbability
    ) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  const achievedProbability = 1 - getFailureProbabilityAfterBooms(low);

  return {
    requiredBooms: low,
    achievedProbability,
  };
}

function chooseAstraPolicy({ startStar, targetStar, hitProbability, events }) {
  const candidates = getAstraCandidatePolicies({ startStar, targetStar, events });
  let best = null;

  for (const policy of candidates) {
    const boomResult = getRequiredBoomsForPolicy({
      policy,
      startStar,
      targetStar,
      hitProbability,
    });
    const percentileCost = policy.expectedMeso + boomResult.requiredBooms * ASTRA_REPLACEMENT_COST;
    const candidate = {
      ...policy,
      ...boomResult,
      percentileCost,
    };

    if (
      !best ||
      candidate.percentileCost < best.percentileCost ||
      (candidate.percentileCost === best.percentileCost &&
        (candidate.expectedBooms < best.expectedBooms ||
          (candidate.expectedBooms === best.expectedBooms &&
            candidate.expectedMeso < best.expectedMeso)))
    ) {
      best = candidate;
    }
  }

  return best;
}

export function calculateAstraStarforceProfileCosts({
  startStar,
  targetStar,
  hitProbability,
  events,
}) {
  validateAstraRange({ startStar, targetStar });
  validateHitProbability(hitProbability);

  const normalizedEvents = normalizeEvents(events);
  const cacheKey = getResultCacheKey({
    startStar,
    targetStar,
    hitProbability,
    events: normalizedEvents,
  });
  const cached = astraResultCache.get(cacheKey);
  if (cached) {
    return cloneResult(cached);
  }

  const bestPolicy = chooseAstraPolicy({
    startStar,
    targetStar,
    hitProbability,
    events: normalizedEvents,
  });
  const expectedReplacementCost = bestPolicy.expectedBooms * ASTRA_REPLACEMENT_COST;
  const expectedTotalCost = bestPolicy.expectedMeso + expectedReplacementCost;
  const result = {
    p50Cost: expectedTotalCost,
    p75Cost: expectedTotalCost,
    p85Cost: bestPolicy.percentileCost,
    p95Cost: expectedTotalCost,
    p50Booms: Math.floor(bestPolicy.expectedBooms),
    p75Booms: Math.ceil(bestPolicy.expectedBooms),
    p95Booms: bestPolicy.requiredBooms,
    availableSpares: null,
    requiredSpares: bestPolicy.requiredBooms,
    requiredBooms: bestPolicy.requiredBooms,
    achievedProbability: bestPolicy.achievedProbability,
    guaranteeMet: true,
    expectedMeso: bestPolicy.expectedMeso,
    expectedReplacementCost,
    expectedTotalCost,
    expectedBooms: bestPolicy.expectedBooms,
    replacementCostPerBoom: ASTRA_REPLACEMENT_COST,
    strategy: formatStrategyRows(bestPolicy.rows),
  };

  writeLimitedCache(astraResultCache, cacheKey, cloneResult(result));
  return result;
}

export function optimizeAstraStarforce({
  startStar,
  targetStar,
  sfFdGain,
  benchmarkFdPerMeso,
  hitProbability,
  events,
}) {
  assertFiniteNumber(sfFdGain, "SF FD gain");
  assertFiniteNumber(benchmarkFdPerMeso, "Benchmark FD per meso");

  const costs = calculateAstraStarforceProfileCosts({
    startStar,
    targetStar,
    hitProbability,
    events,
  });
  const totalExpectedCost = costs.p85Cost;
  const fdPerMeso = sfFdGain / totalExpectedCost;

  return {
    startStar,
    targetStar,
    itemLevel: ASTRA_ITEM_LEVEL,
    availableSpares: null,
    sfFdGain,
    expectedMeso: costs.expectedMeso,
    expectedReplacementCost: costs.expectedReplacementCost,
    expectedBooms: costs.expectedBooms,
    totalExpectedCost,
    fdPerMeso,
    benchmarkFdPerMeso,
    meetsBenchmark: fdPerMeso >= benchmarkFdPerMeso,
    requiredSpares: costs.requiredBooms,
    requiredBooms: costs.requiredBooms,
    achievedProbability: costs.achievedProbability,
    guaranteeMet: costs.guaranteeMet,
    strategy: costs.strategy,
  };
}
