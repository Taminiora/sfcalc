// Event-specific Star Force cost rules. Keep temporary or patch-sensitive
// behavior here so tap/probability math stays easy to replace if GMS changes.

export const COST_REDUCTION_MULTIPLIER = 0.7;

export const OLD_SAFEGUARD_COST_REDUCTION_RULE = Object.freeze({
  stars: Object.freeze([15, 16, 17]),
  description: "30% cost reduction discounts only the base cost, not the mode surcharge.",
});

export function roundToHundreds(value) {
  return 100 * Math.round(value / 100);
}

export function usesOldSafeguardCostReduction({ star, costMultiplier }) {
  return (
    costMultiplier > 1 &&
    OLD_SAFEGUARD_COST_REDUCTION_RULE.stars.includes(star)
  );
}

export function getEventAdjustedTapCost({ baseCost, star, costMultiplier, costReduction30 }) {
  if (!costReduction30) {
    return roundToHundreds(baseCost * costMultiplier);
  }

  if (usesOldSafeguardCostReduction({ star, costMultiplier })) {
    return roundToHundreds(
      baseCost * COST_REDUCTION_MULTIPLIER + baseCost * (costMultiplier - 1),
    );
  }

  return roundToHundreds(baseCost * costMultiplier * COST_REDUCTION_MULTIPLIER);
}
