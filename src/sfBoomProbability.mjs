import { RESTORE_LEVEL } from "./starforce.mjs";
import { getAdjustedTap, getModeId, getTier } from "./sfTapMath.mjs";

// Spare odds: compress repeated same-star failures away and track only the race
// between "success before boom" and "boom before success" for each reachable state.

function addToMap(map, key, value) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function getStateKey(star, booms) {
  return `${star}:${booms}`;
}

function parseStateKey(key) {
  const [star, booms] = key.split(":").map(Number);
  return { star, booms };
}

function getEventRaceProbabilities(tap) {
  const eventProbability = tap.successRate + tap.boomProbability;
  return {
    successBeforeBoomProbability: tap.successRate / eventProbability,
    boomBeforeSuccessProbability: tap.boomProbability / eventProbability,
  };
}

export function calculateBoomDistribution({
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
      const { successBeforeBoomProbability, boomBeforeSuccessProbability } =
        getEventRaceProbabilities(tap);

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

export function calculateSpareCapProbability({
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
      const { successBeforeBoomProbability, boomBeforeSuccessProbability } =
        getEventRaceProbabilities(tap);

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

export function getBoomPercentile(distribution, percentile) {
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
