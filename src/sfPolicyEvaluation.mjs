import { RESTORE_LEVEL } from "./starforce.mjs";
import {
  MIN_STAR,
  MODE_END_STAR,
  MODE_IDS,
  MODE_START_STAR,
  RECOVERY_ANCHOR_STARS,
  generateModePolicies,
  getAdjustedTap,
  getModeId,
  getModeMap,
  getModeStars,
  getTier,
  normalizeEvents,
} from "./sfTapMath.mjs";

// One strategy: walk stars from low to high, carrying the expected recovery
// cost/booms needed when a later tap destroys and restores the item.

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

function getExpectedTapWithRecovery({ adjustedTap, recoveryMeso, recoveryBooms }) {
  // Every attempt eventually succeeds or booms; failures only repeat the same state.
  const expectedMeso =
    (adjustedTap.tapCost + adjustedTap.boomProbability * recoveryMeso) /
    adjustedTap.successRate;
  const expectedBooms =
    (adjustedTap.boomProbability * (1 + recoveryBooms)) / adjustedTap.successRate;

  return { expectedMeso, expectedBooms };
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

export function evaluatePolicy({ itemLevel, startStar, targetStar, events, modeMap }) {
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
    const { expectedMeso, expectedBooms } = getExpectedTapWithRecovery({
      adjustedTap,
      recoveryMeso,
      recoveryBooms,
    });

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

  return {
    rows: strategyRows,
    expectedMeso: targetRows.reduce((sum, row) => sum + row.expectedMeso, 0),
    expectedBooms: targetRows.reduce((sum, row) => sum + row.expectedBooms, 0),
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
  const { expectedMeso, expectedBooms } = getExpectedTapWithRecovery({
    adjustedTap,
    recoveryMeso: recovery.meso,
    recoveryBooms: recovery.booms,
  });
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

export function getExhaustivePolicyCandidates({ itemLevel, startStar, targetStar, events }) {
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

export function getPrunedPolicyCandidates({ itemLevel, startStar, targetStar, events }) {
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
