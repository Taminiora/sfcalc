import { getBaseCost, getTierOptions } from "./starforce.mjs";
import { getEventAdjustedTapCost } from "./starforceCostRules.mjs";

export {
  COST_REDUCTION_MULTIPLIER,
  OLD_SAFEGUARD_COST_REDUCTION_RULE,
  getEventAdjustedTapCost,
  roundToHundreds,
  usesOldSafeguardCostReduction,
} from "./starforceCostRules.mjs";

// One tap: given a star, mode, item level, and events, calculate the adjusted
// cost and outcome probabilities that every larger strategy calculation uses.

export const MIN_STAR = 0;
export const MAX_TARGET_STAR = 25;
export const MODE_START_STAR = 15;
export const MODE_END_STAR = 21;
export const MODE_IDS = ["1", "2", "3", "4"];
export const STAR_CATCH_MULTIPLIER = 1.05;
export const BOOM_REDUCTION_MULTIPLIER = 0.7;
export const RECOVERY_ANCHOR_STARS = [12, 15, 17, 19];

export function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

export function normalizeEvents(events) {
  return {
    starCatch: Boolean(events?.starCatch),
    costReduction30: Boolean(events?.costReduction30 || events?.fullCostReduction30),
    boomReduction30: Boolean(events?.boomReduction30),
  };
}

export function getModeStars(startStar, targetStar) {
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

export function generateModePolicies(length, prefix = []) {
  if (prefix.length === length) {
    return [prefix];
  }

  return MODE_IDS.flatMap((mode) => generateModePolicies(length, [...prefix, mode]));
}

export function getModeMap(modeStars, policy) {
  const modeMap = new Map();
  modeStars.forEach((star, index) => {
    modeMap.set(star, policy[index]);
  });
  return modeMap;
}

export function getModeId(modeMap, star) {
  return modeMap.get(star) ?? "Base";
}

export function getTier(star, modeId) {
  const tiers = getTierOptions(star);
  const tier = tiers.find((option) => option.id === modeId) ?? tiers[0];
  if (!tier) {
    throw new Error(`No tier available for star ${star}`);
  }
  return tier;
}

export function getAdjustedTap({ itemLevel, star, tier, events }) {
  const baseCost = getBaseCost(itemLevel, star);
  const tapCost = getEventAdjustedTapCost({
    baseCost,
    star,
    costMultiplier: tier.costMultiplier,
    costReduction30: events.costReduction30,
  });
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
