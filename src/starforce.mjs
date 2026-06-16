const MIN_STAR = 0;
const MAX_TARGET_STAR = 25;

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
  22: [0.15, 0.2],
  23: [0.1, 0.2],
  24: [0.1, 0.2],
};

export const RESTORE_LEVEL = {
  15: 12,
  16: 12,
  17: 12,
  18: 12,
  19: 12,
  20: 15,
  21: 17,
  22: 17,
  23: 19,
  24: 19,
};

export const TIER_TABLE = {
  15: [
    { id: "1", successRate: 0.3, boomGivenNoSuccess: 0.03, costMultiplier: 1 },
    { id: "2", successRate: 0.3, boomGivenNoSuccess: 0.02, costMultiplier: 1.5 },
    { id: "3", successRate: 0.3, boomGivenNoSuccess: 0.01, costMultiplier: 2.5 },
    { id: "4", successRate: 0.3, boomGivenNoSuccess: 0, costMultiplier: 3 },
  ],
  16: [
    { id: "1", successRate: 0.3, boomGivenNoSuccess: 0.03, costMultiplier: 1 },
    { id: "2", successRate: 0.3, boomGivenNoSuccess: 0.02, costMultiplier: 1.5 },
    { id: "3", successRate: 0.3, boomGivenNoSuccess: 0.01, costMultiplier: 2.5 },
    { id: "4", successRate: 0.3, boomGivenNoSuccess: 0, costMultiplier: 3 },
  ],
  17: [
    { id: "1", successRate: 0.15, boomGivenNoSuccess: 0.08, costMultiplier: 1 },
    { id: "2", successRate: 0.15, boomGivenNoSuccess: 0.05, costMultiplier: 1.5 },
    { id: "3", successRate: 0.15, boomGivenNoSuccess: 0.02, costMultiplier: 2.5 },
    { id: "4", successRate: 0.15, boomGivenNoSuccess: 0, costMultiplier: 3 },
  ],
  18: [
    { id: "1", successRate: 0.15, boomGivenNoSuccess: 0.08, costMultiplier: 1 },
    { id: "2", successRate: 0.12, boomGivenNoSuccess: 0.05, costMultiplier: 2 },
    { id: "3", successRate: 0.1, boomGivenNoSuccess: 0.02, costMultiplier: 3.5 },
    { id: "4", successRate: 0.08, boomGivenNoSuccess: 0, costMultiplier: 6.5 },
  ],
  19: [
    { id: "1", successRate: 0.15, boomGivenNoSuccess: 0.1, costMultiplier: 1 },
    { id: "2", successRate: 0.12, boomGivenNoSuccess: 0.07, costMultiplier: 2 },
    { id: "3", successRate: 0.1, boomGivenNoSuccess: 0.04, costMultiplier: 3.5 },
    { id: "4", successRate: 0.08, boomGivenNoSuccess: 0, costMultiplier: 6.5 },
  ],
  20: [
    { id: "1", successRate: 0.3, boomGivenNoSuccess: 0.15, costMultiplier: 1 },
    { id: "2", successRate: 0.25, boomGivenNoSuccess: 0.1, costMultiplier: 2 },
    { id: "3", successRate: 0.2, boomGivenNoSuccess: 0.05, costMultiplier: 3.5 },
    { id: "4", successRate: 0.15, boomGivenNoSuccess: 0, costMultiplier: 6.5 },
  ],
  21: [
    { id: "1", successRate: 0.15, boomGivenNoSuccess: 0.15, costMultiplier: 1 },
    { id: "2", successRate: 0.12, boomGivenNoSuccess: 0.1, costMultiplier: 2 },
    { id: "3", successRate: 0.1, boomGivenNoSuccess: 0.05, costMultiplier: 3.5 },
    { id: "4", successRate: 0.08, boomGivenNoSuccess: 0, costMultiplier: 6.5 },
  ],
};

const COST_FORMULAS = {
  0: (level) => 100 * Math.round(10 + (level ** 3 * 1) / 2500),
  1: (level) => 100 * Math.round(10 + (level ** 3 * 2) / 2500),
  2: (level) => 100 * Math.round(10 + (level ** 3 * 3) / 2500),
  3: (level) => 100 * Math.round(10 + (level ** 3 * 4) / 2500),
  4: (level) => 100 * Math.round(10 + (level ** 3 * 5) / 2500),
  5: (level) => 100 * Math.round(10 + (level ** 3 * 6) / 2500),
  6: (level) => 100 * Math.round(10 + (level ** 3 * 7) / 2500),
  7: (level) => 100 * Math.round(10 + (level ** 3 * 8) / 2500),
  8: (level) => 100 * Math.round(10 + (level ** 3 * 9) / 2500),
  9: (level) => 100 * Math.round(10 + (level ** 3 * 10) / 2500),
  10: (level) => 100 * Math.round(10 + (level ** 3 * 11 ** 2.7) / 40000),
  11: (level) => 100 * Math.round(10 + (level ** 3 * 12 ** 2.7) / 22000),
  12: (level) => 100 * Math.round(10 + (level ** 3 * 13 ** 2.7) / 15000),
  13: (level) => 100 * Math.round(10 + (level ** 3 * 14 ** 2.7) / 11000),
  14: (level) => 100 * Math.round(10 + (level ** 3 * 15 ** 2.7) / 7500),
  15: (level) => 100 * Math.round(10 + (level ** 3 * 16 ** 2.7) / 20000),
  16: (level) => 100 * Math.round(10 + (level ** 3 * 17 ** 2.7) / 20000),
  17: (level) => 100 * Math.round(10 + (level ** 3 * 18 ** 2.7) / 15000),
  18: (level) => 100 * Math.round(10 + (level ** 3 * 19 ** 2.7) / 7000),
  19: (level) => 100 * Math.round(10 + (level ** 3 * 20 ** 2.7) / 4500),
  20: (level) => 100 * Math.round(10 + (level ** 3 * 21 ** 2.7) / 20000),
  21: (level) => 100 * Math.round(10 + (level ** 3 * 22 ** 2.7) / 12500),
  22: (level) => 100 * Math.round(10 + (level ** 3 * 23 ** 2.7) / 20000),
  23: (level) => 100 * Math.round(10 + (level ** 3 * 24 ** 2.7) / 20000),
  24: (level) => 100 * Math.round(10 + (level ** 3 * 25 ** 2.7) / 20000),
};

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function roundToHundreds(value) {
  return 100 * Math.round(value / 100);
}

export function getTierOptions(star) {
  const tunedTiers = TIER_TABLE[star];
  if (tunedTiers) {
    return tunedTiers;
  }

  const baseProbability = BASE_PROBABILITIES[star];
  if (!baseProbability) {
    throw new Error(`Unsupported star ${star}`);
  }

  const [successRate, boomGivenNoSuccess] = baseProbability;
  return [
    {
      id: "Base",
      successRate,
      boomGivenNoSuccess,
      costMultiplier: 1,
    },
  ];
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

export function getTapCost(itemLevel, star, tier) {
  return roundToHundreds(getBaseCost(itemLevel, star) * tier.costMultiplier);
}

function getExpectedTap({ itemLevel, star, tier, mesoToNextByStar, boomsToNextByStar, spareCost }) {
  const successRate = tier.successRate;
  const boomProbability = (1 - successRate) * tier.boomGivenNoSuccess;
  const restoreStar = RESTORE_LEVEL[star];
  const recoveryMeso = getRecoverySum(mesoToNextByStar, restoreStar, star);
  const recoveryBooms = getRecoverySum(boomsToNextByStar, restoreStar, star);
  const tapCost = getTapCost(itemLevel, star, tier);
  const expectedMeso = (tapCost + boomProbability * recoveryMeso) / successRate;
  const expectedBooms = (boomProbability * (1 + recoveryBooms)) / successRate;

  return {
    star,
    tapCost,
    successRate,
    boomProbability,
    failureProbability: 1 - successRate - boomProbability,
    expectedMeso,
    expectedBooms,
    expectedTotal: expectedMeso + expectedBooms * spareCost,
    bestTier: tier,
  };
}

export function getBaseCost(itemLevel, star) {
  assertFiniteNumber(itemLevel, "Item level");
  if (!Number.isInteger(star) || star < MIN_STAR || star >= MAX_TARGET_STAR) {
    throw new Error(`Star must be an integer from ${MIN_STAR} to ${MAX_TARGET_STAR - 1}`);
  }

  return COST_FORMULAS[star](itemLevel);
}

export function calculateRange({ itemLevel, startStar, endStar, spareCost }) {
  assertFiniteNumber(itemLevel, "Item level");
  assertFiniteNumber(spareCost, "Spare cost");

  if (!Number.isInteger(startStar) || !Number.isInteger(endStar)) {
    throw new Error("Start star and end star must be integers");
  }

  if (startStar < MIN_STAR || endStar > MAX_TARGET_STAR) {
    throw new Error(`Star range must stay between ${MIN_STAR} and ${MAX_TARGET_STAR}`);
  }

  if (endStar <= startStar) {
    throw new Error("End star must be greater than start star");
  }

  const mesoToNextByStar = new Map();
  const boomsToNextByStar = new Map();
  const policyRows = [];

  for (let star = MIN_STAR; star < endStar; star += 1) {
    const candidates = getTierOptions(star).map((tier) =>
      getExpectedTap({
        itemLevel,
        star,
        tier,
        mesoToNextByStar,
        boomsToNextByStar,
        spareCost,
      }),
    );
    const bestCandidate = candidates.reduce((best, candidate) =>
      candidate.expectedTotal < best.expectedTotal ? candidate : best,
    );

    mesoToNextByStar.set(star, bestCandidate.expectedMeso);
    boomsToNextByStar.set(star, bestCandidate.expectedBooms);
    policyRows.push({
      ...bestCandidate,
      nextStar: star + 1,
      candidates,
    });

  }

  const rows = policyRows.filter((row) => row.star >= startStar && row.star < endStar);
  const expectedMeso = rows.reduce((sum, row) => sum + row.expectedMeso, 0);
  const expectedBooms = rows.reduce((sum, row) => sum + row.expectedBooms, 0);

  return {
    itemLevel,
    startStar,
    endStar,
    spareCost,
    rows,
    expectedMeso,
    expectedBooms,
    expectedTotal: expectedMeso + expectedBooms * spareCost,
  };
}
