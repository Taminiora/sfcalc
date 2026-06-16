import { getBaseCost, TIER_TABLE } from "./starforce.mjs";

const START_STAR = 15;
const END_STAR = 22;
const STAR_CATCH_MULTIPLIER = 1.05;
const BOOM_REDUCTION_MULTIPLIER = 0.7;
const COST_REDUCTION_MULTIPLIER = 0.7;

const BASE_PROBABILITIES = {
  0: [0.95, 0],
  1: [0.9, 0],
  2: [0.85, 0],
  3: [0.85, 0],
  4: [0.8, 0],
  5: [0.75, 0],
  6: [0.7, 0],
  7: [0.65, 0],
  8: [0.6, 0],
  9: [0.55, 0],
  10: [0.5, 0],
  11: [0.45, 0],
  12: [0.4, 0],
  13: [0.35, 0],
  14: [0.3, 0],
};

const RESTORE_LEVEL = {
  15: 12,
  16: 12,
  17: 12,
  18: 12,
  19: 12,
  20: 15,
  21: 17,
};

const MODES = ["1", "2", "3", "4"];

function roundToHundreds(value) {
  return 100 * Math.round(value / 100);
}

export function getDiscountedModeCost({ baseCost, costMultiplier }) {
  const discountedBaseCost = baseCost * COST_REDUCTION_MULTIPLIER;
  const fullPriceModeSurcharge = baseCost * (costMultiplier - 1);
  return roundToHundreds(discountedBaseCost + fullPriceModeSurcharge);
}

function getTier(star, id) {
  const tunedTiers = TIER_TABLE[star];
  if (tunedTiers) {
    return tunedTiers.find((tier) => tier.id === id);
  }

  const [successRate, boomGivenNoSuccess] = BASE_PROBABILITIES[star];
  return {
    id: "Base",
    successRate,
    boomGivenNoSuccess,
    costMultiplier: 1,
  };
}

function formatStrategy(ids) {
  return `${ids.slice(0, 3)}/${ids.slice(3, 5)}/${ids.slice(5)}`;
}

function generateModePolicies(length, prefix = []) {
  if (prefix.length === length) {
    return [prefix];
  }

  return MODES.flatMap((mode) => generateModePolicies(length, [...prefix, mode]));
}

function evaluatePolicy({ ids, itemLevel }) {
  const mesoByStar = new Map();
  const boomsByStar = new Map();
  const rows = [];

  for (let star = 0; star < END_STAR; star += 1) {
    const mode = star >= START_STAR ? ids[star - START_STAR] : "Base";
    const tier = getTier(star, mode);
    const successRate = tier.successRate * (star >= 12 && star <= 21 ? STAR_CATCH_MULTIPLIER : 1);
    const boomProbability =
      (1 - successRate) * tier.boomGivenNoSuccess * BOOM_REDUCTION_MULTIPLIER;
    const tapCost = getDiscountedModeCost({
      baseCost: getBaseCost(itemLevel, star),
      costMultiplier: tier.costMultiplier,
    });
    const restoreStar = RESTORE_LEVEL[star];
    let recoveryMeso = 0;
    let recoveryBooms = 0;

    if (restoreStar !== undefined) {
      for (let recoveryStar = restoreStar; recoveryStar < star; recoveryStar += 1) {
        recoveryMeso += mesoByStar.get(recoveryStar) ?? 0;
        recoveryBooms += boomsByStar.get(recoveryStar) ?? 0;
      }
    }

    const expectedMeso = (tapCost + boomProbability * recoveryMeso) / successRate;
    const expectedBooms = (boomProbability * (1 + recoveryBooms)) / successRate;
    mesoByStar.set(star, expectedMeso);
    boomsByStar.set(star, expectedBooms);

    if (star >= START_STAR) {
      rows.push({ expectedBooms, expectedMeso });
    }
  }

  return {
    expectedBooms: rows.reduce((sum, row) => sum + row.expectedBooms, 0),
    expectedMeso: rows.reduce((sum, row) => sum + row.expectedMeso, 0),
    ids: ids.join(""),
  };
}

function getTotalCost(policy, spareCost) {
  return policy.expectedMeso + policy.expectedBooms * spareCost;
}

export function calculateBreakpointTable({ itemLevel }) {
  const policies = generateModePolicies(END_STAR - START_STAR).map((ids) =>
    evaluatePolicy({ ids, itemLevel }),
  );
  const segments = [];
  let lowEndSpareCost = 0;
  let current = policies.reduce((best, policy) =>
    getTotalCost(policy, 0) < getTotalCost(best, 0) ? policy : best,
  );

  while (current) {
    segments.push({
      expectedBooms: current.expectedBooms,
      expectedCostTo22: getTotalCost(current, lowEndSpareCost),
      lowEndSpareCost,
      optimal: formatStrategy(current.ids),
    });

    let nextCost = Infinity;
    let nextPolicy = null;
    for (const policy of policies) {
      if (policy.expectedBooms >= current.expectedBooms) {
        continue;
      }

      const crossover =
        (policy.expectedMeso - current.expectedMeso) /
        (current.expectedBooms - policy.expectedBooms);
      if (
        crossover > lowEndSpareCost + 1e-4 &&
        crossover < nextCost &&
        getTotalCost(policy, crossover + 1) < getTotalCost(current, crossover + 1)
      ) {
        nextCost = crossover;
        nextPolicy = policy;
      }
    }

    lowEndSpareCost = nextCost;
    current = nextPolicy;
  }

  return segments;
}
