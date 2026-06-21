import { getBaseCost, getTierOptions, RESTORE_LEVEL } from "./starforce.mjs";

const MIN_STAR = 0;
const MAX_TARGET_STAR = 25;
const MODE_START_STAR = 15;
const MODE_END_STAR = 21;
const MODE_IDS = ["1", "2", "3", "4"];
const STAR_CATCH_MULTIPLIER = 1.05;
const COST_REDUCTION_MULTIPLIER = 0.7;
const BOOM_REDUCTION_MULTIPLIER = 0.7;
const RECOVERY_ANCHOR_STARS = [12, 15, 17, 19];
const OPTIMIZE_STARFORCE_CACHE_LIMIT = 50;
const optimizeStarforceCache = new Map();

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function roundToHundreds(value) {
  return 100 * Math.round(value / 100);
}

function addToMap(map, key, value) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function getRecoverySum(valuesByStar, restoreStar, star) {
  if (restoreStar === undefined) {
    return 0;
  }

  let sum = 0;
  for (let recoveryStar = restoreStar; recoveryStar < star; recoveryStar += 1) {
    sum += valuesByStar.get(recoveryStar) ?? 0;
  }
  return sum;
}

function getModeStars(startStar, targetStar) {
  const upperStar = Math.min(MODE_END_STAR, targetStar - 1);
  if (upperStar < MODE_START_STAR) {
    return [];
  }

  const stars = [];
  for (let star = MODE_START_STAR; star <= upperStar; star += 1) {
    stars.push(star);
  }
  return stars;
}

function generateModePolicies(length, prefix = []) {
  if (prefix.length === length) {
    return [prefix];
  }

  return MODE_IDS.flatMap((mode) => generateModePolicies(length, [...prefix, mode]));
}

function getTier(star, modeId) {
  const tiers = getTierOptions(star);
  const tier = tiers.find((option) => option.id === modeId) ?? tiers[0];
  if (!tier) {
    throw new Error(`No tier available for star ${star}`);
  }
  return tier;
}

function getAdjustedTap({ itemLevel, star, tier, events }) {
  const undiscountedTapCost = getBaseCost(itemLevel, star) * tier.costMultiplier;
  const tapCost = roundToHundreds(
    events.costReduction30
      ? undiscountedTapCost * COST_REDUCTION_MULTIPLIER
      : undiscountedTapCost,
  );
  const successRate = tier.successRate * (events.starCatch && star >= 12 ? STAR_CATCH_MULTIPLIER : 1);
  const boomReduction =
    events.boomReduction30 && star >= MODE_START_STAR && star <= MODE_END_STAR
      ? BOOM_REDUCTION_MULTIPLIER
      : 1;
  const boomProbability = (1 - successRate) * tier.boomGivenNoSuccess * boomReduction;

  return {
    tapCost,
    successRate,
    boomProbability,
    failureProbability: Math.max(0, 1 - successRate - boomProbability),
  };
}

function getModeMap(modeStars, policy) {
  const modeMap = new Map();
  modeStars.forEach((star, index) => {
    modeMap.set(star, policy[index]);
  });
  return modeMap;
}

function getModeId(modeMap, star) {
  return modeMap.get(star) ?? "Base";
}

function getReachableStars({ itemLevel, startStar, targetStar, events, modeMap }) {
  const reachableStars = new Set([startStar]);
  let changed = true;

  while (changed) {
    changed = false;

    for (let star = MIN_STAR; star < targetStar; star += 1) {
      if (!reachableStars.has(star)) {
        continue;
      }

      const nextStar = star + 1;
      if (nextStar < targetStar && !reachableStars.has(nextStar)) {
        reachableStars.add(nextStar);
        changed = true;
      }

      const mode = getModeId(modeMap, star);
      const tier = getTier(star, mode);
      const adjustedTap = getAdjustedTap({ itemLevel, star, tier, events });
      const restoreStar = RESTORE_LEVEL[star];
      if (adjustedTap.boomProbability > 0 && restoreStar !== undefined && !reachableStars.has(restoreStar)) {
        reachableStars.add(restoreStar);
        changed = true;
      }
    }
  }

  return reachableStars;
}

function evaluatePolicy({ itemLevel, startStar, targetStar, events, modeMap }) {
  const mesoToNextByStar = new Map();
  const boomsToNextByStar = new Map();
  const targetRows = [];
  const strategyRows = [];
  const reachableStars = getReachableStars({ itemLevel, startStar, targetStar, events, modeMap });

  for (let star = MIN_STAR; star < targetStar; star += 1) {
    const mode = getModeId(modeMap, star);
    const tier = getTier(star, mode);
    const adjustedTap = getAdjustedTap({ itemLevel, star, tier, events });
    const restoreStar = RESTORE_LEVEL[star];
    const recoveryMeso = getRecoverySum(mesoToNextByStar, restoreStar, star);
    const recoveryBooms = getRecoverySum(boomsToNextByStar, restoreStar, star);
    const expectedMeso =
      (adjustedTap.tapCost + adjustedTap.boomProbability * recoveryMeso) /
      adjustedTap.successRate;
    const expectedBooms =
      (adjustedTap.boomProbability * (1 + recoveryBooms)) / adjustedTap.successRate;

    mesoToNextByStar.set(star, expectedMeso);
    boomsToNextByStar.set(star, expectedBooms);

    const row = {
      star,
      nextStar: star + 1,
      mode,
      ...(modeMap.has(star) && !reachableStars.has(star) ? { displayMode: "*" } : {}),
      tier,
      ...adjustedTap,
      expectedMeso,
      expectedBooms,
    };

    if (modeMap.has(star) || (star > MODE_END_STAR && reachableStars.has(star))) {
      strategyRows.push(row);
    }

    if (star >= startStar) {
      targetRows.push(row);
    }
  }

  const expectedMeso = targetRows.reduce((sum, row) => sum + row.expectedMeso, 0);
  const expectedBooms = targetRows.reduce((sum, row) => sum + row.expectedBooms, 0);

  return {
    rows: strategyRows,
    expectedMeso,
    expectedBooms,
  };
}

function applyReachableDisplay({ rows, itemLevel, startStar, targetStar, events, modeMap }) {
  const reachableStars = getReachableStars({ itemLevel, startStar, targetStar, events, modeMap });

  return rows
    .filter((row) => modeMap.has(row.star) || (row.star > MODE_END_STAR && reachableStars.has(row.star)))
    .map((row) => {
      const { displayMode: _displayMode, ...rest } = row;
      if (modeMap.has(row.star) && !reachableStars.has(row.star)) {
        return { ...rest, displayMode: "*" };
      }
      return rest;
    });
}

export function formatStarforceStrategyForSource(strategy, source = {}) {
  if (!Array.isArray(strategy)) {
    return [];
  }

  const itemLevel = Number(source.itemLevel);
  const startStar = Number(source.startStar);
  const targetStar = Number(source.targetStar);
  if (!Number.isFinite(itemLevel) || !Number.isInteger(startStar) || !Number.isInteger(targetStar)) {
    return strategy;
  }

  const rows = strategy.map((row) => ({
    ...row,
    star: Number(row.star),
    nextStar: Number(row.nextStar),
    mode: row.mode === undefined ? "Base" : String(row.mode),
  }));
  const modeMap = new Map(
    rows
      .filter((row) => row.star >= MODE_START_STAR && row.star <= MODE_END_STAR)
      .map((row) => [row.star, row.mode]),
  );

  return applyReachableDisplay({
    rows,
    itemLevel,
    startStar,
    targetStar,
    events: normalizeEvents(source.events ?? {}),
    modeMap,
  });
}

function createTailTotals() {
  return new Map(RECOVERY_ANCHOR_STARS.map((star) => [star, { meso: 0, booms: 0 }]));
}

function getTailTotal(tailTotals, restoreStar) {
  return tailTotals.get(restoreStar) ?? { meso: 0, booms: 0 };
}

function appendTailTotals(tailTotals, star, row) {
  const nextTailTotals = new Map();
  for (const anchorStar of RECOVERY_ANCHOR_STARS) {
    const current = tailTotals.get(anchorStar) ?? { meso: 0, booms: 0 };
    nextTailTotals.set(
      anchorStar,
      star >= anchorStar
        ? {
            meso: current.meso + row.expectedMeso,
            booms: current.booms + row.expectedBooms,
          }
        : current,
    );
  }
  return nextTailTotals;
}

function advancePolicyState({
  state,
  itemLevel,
  startStar,
  events,
  modeStars,
  star,
  mode,
}) {
  const tier = getTier(star, mode);
  const adjustedTap = getAdjustedTap({ itemLevel, star, tier, events });
  const restoreStar = RESTORE_LEVEL[star];
  const recovery = getTailTotal(state.tailTotals, restoreStar);
  const expectedMeso =
    (adjustedTap.tapCost + adjustedTap.boomProbability * recovery.meso) /
    adjustedTap.successRate;
  const expectedBooms =
    (adjustedTap.boomProbability * (1 + recovery.booms)) / adjustedTap.successRate;
  const usesMode = modeStars.has(star);
  const row = {
    star,
    nextStar: star + 1,
    mode,
    tier,
    ...adjustedTap,
    expectedMeso,
    expectedBooms,
  };
  const modeMap = new Map(state.modeMap);
  if (usesMode) {
    modeMap.set(star, mode);
  }

  return {
    modeMap,
    rows: usesMode || star > MODE_END_STAR ? [...state.rows, row] : state.rows,
    expectedMeso: state.expectedMeso + (star >= startStar ? expectedMeso : 0),
    expectedBooms: state.expectedBooms + (star >= startStar ? expectedBooms : 0),
    tailTotals: appendTailTotals(state.tailTotals, star, row),
  };
}

function getDominanceValues(state) {
  const values = [state.expectedMeso, state.expectedBooms];
  for (const anchorStar of RECOVERY_ANCHOR_STARS) {
    const tail = state.tailTotals.get(anchorStar) ?? { meso: 0, booms: 0 };
    values.push(tail.meso, tail.booms);
  }
  return values;
}

function dominatesPolicyState(left, right) {
  const leftValues = getDominanceValues(left);
  const rightValues = getDominanceValues(right);
  let hasStrictImprovement = false;

  for (let index = 0; index < leftValues.length; index += 1) {
    if (leftValues[index] > rightValues[index]) {
      return false;
    }
    if (leftValues[index] < rightValues[index]) {
      hasStrictImprovement = true;
    }
  }

  return hasStrictImprovement;
}

function prunePolicyStates(states) {
  const frontier = [];

  for (const candidate of states) {
    let isDominated = false;
    for (let index = frontier.length - 1; index >= 0; index -= 1) {
      const existing = frontier[index];
      if (dominatesPolicyState(existing, candidate)) {
        isDominated = true;
        break;
      }
      if (dominatesPolicyState(candidate, existing)) {
        frontier.splice(index, 1);
      }
    }

    if (!isDominated) {
      frontier.push(candidate);
    }
  }

  return frontier;
}

function getPrunedPolicyCandidates({ itemLevel, startStar, targetStar, events }) {
  const normalizedEvents = normalizeEvents(events);
  const modeStars = new Set(getModeStars(startStar, targetStar));
  let frontier = [
    {
      modeMap: new Map(),
      rows: [],
      expectedMeso: 0,
      expectedBooms: 0,
      tailTotals: createTailTotals(),
    },
  ];

  for (let star = MIN_STAR; star < targetStar; star += 1) {
    const modes = modeStars.has(star) ? MODE_IDS : ["Base"];
    const nextStates = [];
    for (const state of frontier) {
      for (const mode of modes) {
        nextStates.push(
          advancePolicyState({
            state,
            itemLevel,
            startStar,
            events: normalizedEvents,
            modeStars,
            star,
            mode,
          }),
        );
      }
    }
    frontier = prunePolicyStates(nextStates);
  }

  return frontier.map((candidate) => ({
    rows: applyReachableDisplay({
      rows: candidate.rows,
      itemLevel,
      startStar,
      targetStar,
      events: normalizedEvents,
      modeMap: candidate.modeMap,
    }),
    expectedMeso: candidate.expectedMeso,
    expectedBooms: candidate.expectedBooms,
    modeMap: candidate.modeMap,
    normalizedEvents,
  }));
}

function getStateKey(star, booms) {
  return `${star}:${booms}`;
}

function parseStateKey(key) {
  const [star, booms] = key.split(":").map(Number);
  return { star, booms };
}

function calculateBoomDistribution({
  itemLevel,
  startStar,
  targetStar,
  modeMap,
  events,
  maxBooms = 500,
  epsilon = 1e-12,
}) {
  let activeStates = new Map([[getStateKey(startStar, 0), 1]]);
  const distribution = new Map();

  for (let iteration = 0; iteration < 200_000; iteration += 1) {
    const nextStates = new Map();
    let activeProbability = 0;

    for (const [key, probability] of activeStates) {
      if (probability < epsilon) {
        continue;
      }

      const { star, booms } = parseStateKey(key);
      const mode = getModeId(modeMap, star);
      const tier = getTier(star, mode);
      const tap = getAdjustedTap({ itemLevel, star, tier, events });
      const eventProbability = tap.successRate + tap.boomProbability;
      const successBeforeBoomProbability = tap.successRate / eventProbability;
      const boomBeforeSuccessProbability = tap.boomProbability / eventProbability;

      if (star + 1 >= targetStar) {
        addToMap(distribution, booms, probability * successBeforeBoomProbability);
      } else {
        addToMap(
          nextStates,
          getStateKey(star + 1, booms),
          probability * successBeforeBoomProbability,
        );
      }

      if (boomBeforeSuccessProbability > 0 && booms < maxBooms) {
        const restoreStar = RESTORE_LEVEL[star];
        addToMap(
          nextStates,
          getStateKey(restoreStar ?? star, booms + 1),
          probability * boomBeforeSuccessProbability,
        );
      }
    }

    for (const probability of nextStates.values()) {
      activeProbability += probability;
    }

    activeStates = nextStates;
    if (activeProbability < epsilon) {
      break;
    }
  }

  return distribution;
}

function calculateSpareCapProbability({
  itemLevel,
  startStar,
  targetStar,
  modeMap,
  events,
  spareCount,
  epsilon = 1e-12,
}) {
  let activeStates = new Map([[getStateKey(startStar, 0), 1]]);
  let successProbability = 0;

  for (let iteration = 0; iteration < 200_000; iteration += 1) {
    const nextStates = new Map();
    let activeProbability = 0;

    for (const [key, probability] of activeStates) {
      if (probability < epsilon) {
        continue;
      }

      const { star, booms } = parseStateKey(key);
      const mode = getModeId(modeMap, star);
      const tier = getTier(star, mode);
      const tap = getAdjustedTap({ itemLevel, star, tier, events });
      const eventProbability = tap.successRate + tap.boomProbability;
      const successBeforeBoomProbability = tap.successRate / eventProbability;
      const boomBeforeSuccessProbability = tap.boomProbability / eventProbability;

      if (star + 1 >= targetStar) {
        successProbability += probability * successBeforeBoomProbability;
      } else {
        addToMap(
          nextStates,
          getStateKey(star + 1, booms),
          probability * successBeforeBoomProbability,
        );
      }

      if (boomBeforeSuccessProbability > 0 && booms < spareCount) {
        const restoreStar = RESTORE_LEVEL[star];
        addToMap(
          nextStates,
          getStateKey(restoreStar ?? star, booms + 1),
          probability * boomBeforeSuccessProbability,
        );
      }
    }

    for (const probability of nextStates.values()) {
      activeProbability += probability;
    }

    activeStates = nextStates;
    if (activeProbability < epsilon) {
      break;
    }
  }

  return successProbability;
}

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

function normalizeEvents(events) {
  return {
    starCatch: Boolean(events?.starCatch),
    costReduction30: Boolean(events?.costReduction30 || events?.fullCostReduction30),
    boomReduction30: Boolean(events?.boomReduction30),
  };
}

function getExhaustivePolicyCandidates({ itemLevel, startStar, targetStar, events }) {
  const normalizedEvents = normalizeEvents(events);
  const modeStars = getModeStars(startStar, targetStar);
  const policies = generateModePolicies(modeStars.length);

  return policies.map((policy) => {
    const modeMap = getModeMap(modeStars, policy);
    const candidate = evaluatePolicy({
      itemLevel,
      startStar,
      targetStar,
      events: normalizedEvents,
      modeMap,
    });

    return { ...candidate, modeMap, normalizedEvents };
  });
}

function getPolicyTotalCost(policy, spareCost) {
  return policy.expectedMeso + policy.expectedBooms * spareCost;
}

function getSpareCostFrontier(candidates) {
  const frontier = [];
  let lowEndSpareCost = 0;
  let current = candidates.reduce((best, policy) =>
    policy.expectedMeso < best.expectedMeso ? policy : best,
  );

  while (current) {
    frontier.push(current);

    let nextSpareCost = Infinity;
    let nextPolicy = null;
    for (const policy of candidates) {
      if (policy.expectedBooms >= current.expectedBooms) {
        continue;
      }

      const crossover =
        (policy.expectedMeso - current.expectedMeso) /
        (current.expectedBooms - policy.expectedBooms);
      if (
        crossover > lowEndSpareCost + 1e-4 &&
        crossover < nextSpareCost &&
        getPolicyTotalCost(policy, crossover + 1) < getPolicyTotalCost(current, crossover + 1)
      ) {
        nextSpareCost = crossover;
        nextPolicy = policy;
      }
    }

    lowEndSpareCost = nextSpareCost;
    current = nextPolicy;
  }

  return frontier;
}

function getPolicyBoomResult({ policy, itemLevel, startStar, targetStar, spareCount, hitProbability }) {
  const boomDistribution = calculateBoomDistribution({
    itemLevel,
    startStar,
    targetStar,
    modeMap: policy.modeMap,
    events: policy.normalizedEvents,
  });
  const spareResult = findRequiredSpares(boomDistribution, hitProbability);
  const hasSpareCap = spareCount !== undefined;
  const achievedProbability = calculateSpareProbability(
    boomDistribution,
    hasSpareCap ? spareCount : spareResult.requiredSpares,
  );

  return {
    ...policy,
    boomDistribution,
    requiredSpares: spareResult.requiredSpares,
    achievedProbability,
    availableSpares: hasSpareCap ? spareCount : null,
    guaranteeMet: hasSpareCap ? achievedProbability + 1e-12 >= hitProbability : true,
  };
}

function getCheapestPolicy({ itemLevel, startStar, targetStar, hitProbability, events }) {
  const [candidate] = getPrunedPolicyCandidates({
    itemLevel,
    startStar,
    targetStar,
    events,
  }).sort((left, right) => left.expectedMeso - right.expectedMeso);

  return getPolicyBoomResult({
    policy: candidate,
    itemLevel,
    startStar,
    targetStar,
    hitProbability,
  });
}

function getBestPolicyForBenchmark({
  itemLevel,
  startStar,
  targetStar,
  sfFdGain,
  benchmarkFdPerMeso,
  hitProbability,
  events,
}) {
  const candidates = getSpareCostFrontier(
    getPrunedPolicyCandidates({
      itemLevel,
      startStar,
      targetStar,
      events,
    }),
  );
  const [leastConservative] = [...candidates].sort(
    (left, right) => left.expectedMeso - right.expectedMeso,
  );
  const leastConservativeFdPerMeso = sfFdGain / leastConservative.expectedMeso;

  if (leastConservativeFdPerMeso + 1e-18 < benchmarkFdPerMeso) {
    return getPolicyBoomResult({
      policy: leastConservative,
      itemLevel,
      startStar,
      targetStar,
      hitProbability,
    });
  }

  const [bestConservative] = candidates
    .filter((candidate) => sfFdGain / candidate.expectedMeso + 1e-18 >= benchmarkFdPerMeso)
    .sort(
      (left, right) =>
        left.expectedBooms - right.expectedBooms ||
        left.expectedMeso - right.expectedMeso,
    );

  return getPolicyBoomResult({
    policy: bestConservative,
    itemLevel,
    startStar,
    targetStar,
    hitProbability,
  });
}

function getBestPolicyForSpareCount({
  itemLevel,
  startStar,
  targetStar,
  spareCount,
  hitProbability,
  events,
}) {
  const candidates = getExhaustivePolicyCandidates({
    itemLevel,
    startStar,
    targetStar,
    events,
  }).sort((left, right) => left.expectedMeso - right.expectedMeso);
  let bestFallback = null;

  for (const candidate of candidates) {
    const achievedProbability = calculateSpareCapProbability({
      itemLevel,
      startStar,
      targetStar,
      modeMap: candidate.modeMap,
      events: candidate.normalizedEvents,
      spareCount,
    });
    const candidateResult = {
      ...candidate,
      achievedProbability,
      guaranteeMet: achievedProbability + 1e-12 >= hitProbability,
    };

    if (candidateResult.guaranteeMet) {
      return getPolicyBoomResult({
        policy: candidate,
        itemLevel,
        startStar,
        targetStar,
        spareCount,
        hitProbability,
      });
    }

    if (
      !bestFallback ||
      candidateResult.achievedProbability > bestFallback.achievedProbability + 1e-12 ||
      (Math.abs(candidateResult.achievedProbability - bestFallback.achievedProbability) < 1e-12 &&
        candidateResult.expectedMeso < bestFallback.expectedMeso)
    ) {
      bestFallback = candidateResult;
    }
  }

  return getPolicyBoomResult({
    policy: bestFallback,
    itemLevel,
    startStar,
    targetStar,
    spareCount,
    hitProbability,
  });
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

function getBoomPercentile(distribution, percentile) {
  const sortedBoomCounts = [...distribution.keys()].sort((left, right) => left - right);
  let cumulativeProbability = 0;
  for (const boomCount of sortedBoomCounts) {
    cumulativeProbability += distribution.get(boomCount);
    if (cumulativeProbability + 1e-12 >= percentile) {
      return boomCount;
    }
  }
  return sortedBoomCounts.at(-1) ?? 0;
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

export function calculateSpareProbability(distribution, spareCount) {
  let probability = 0;
  for (const [booms, boomProbability] of distribution) {
    if (booms <= spareCount) {
      probability += boomProbability;
    }
  }
  return probability;
}

export function findRequiredSpares(distribution, hitProbability) {
  const sortedBoomCounts = [...distribution.keys()].sort((left, right) => left - right);
  for (const boomCount of sortedBoomCounts) {
    const achievedProbability = calculateSpareProbability(distribution, boomCount);
    if (achievedProbability + 1e-12 >= hitProbability) {
      return {
        requiredSpares: boomCount,
        achievedProbability,
      };
    }
  }

  const lastBoomCount = sortedBoomCounts.at(-1) ?? 0;
  return {
    requiredSpares: lastBoomCount,
    achievedProbability: calculateSpareProbability(distribution, lastBoomCount),
  };
}

export function optimizeStarforce({
  itemLevel,
  startStar,
  targetStar,
  sfFdGain,
  benchmarkFdPerMeso,
  hitProbability,
  events,
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
  });
  const fdPerMeso = sfFdGain / bestPolicy.expectedMeso;

  const result = {
    startStar,
    targetStar,
    itemLevel,
    availableSpares: bestPolicy.availableSpares,
    sfFdGain,
    expectedMeso: bestPolicy.expectedMeso,
    expectedBooms: bestPolicy.expectedBooms,
    totalExpectedCost: bestPolicy.expectedMeso,
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
        })
      : getBestPolicyForSpareCount({
          itemLevel,
          startStar,
          targetStar,
          spareCount,
          hitProbability,
          events,
        });
  const p50Booms = getBoomPercentile(bestPolicy.boomDistribution, 0.5);
  const p75Booms = getBoomPercentile(bestPolicy.boomDistribution, 0.75);
  const p95Booms = getBoomPercentile(bestPolicy.boomDistribution, 0.95);

  return {
    p50Cost: bestPolicy.expectedMeso,
    p75Cost: bestPolicy.expectedMeso,
    p95Cost: bestPolicy.expectedMeso,
    p50Booms,
    p75Booms,
    p95Booms,
    availableSpares: bestPolicy.availableSpares,
    requiredSpares: bestPolicy.requiredSpares,
    achievedProbability: bestPolicy.achievedProbability,
    guaranteeMet: bestPolicy.guaranteeMet,
    expectedMeso: bestPolicy.expectedMeso,
    expectedBooms: bestPolicy.expectedBooms,
    strategy: formatStrategyRows(bestPolicy.rows),
  };
}
