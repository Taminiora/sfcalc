import assert from "node:assert/strict";
import test from "node:test";

import {
  getEventAdjustedTapCost,
  roundToHundreds,
  usesOldSafeguardCostReduction,
} from "./starforceCostRules.mjs";

test("old safeguard cost reduction rule is isolated to old enhancement stars", () => {
  assert.equal(usesOldSafeguardCostReduction({ star: 15, costMultiplier: 3 }), true);
  assert.equal(usesOldSafeguardCostReduction({ star: 17, costMultiplier: 3 }), true);
  assert.equal(usesOldSafeguardCostReduction({ star: 18, costMultiplier: 3 }), false);
  assert.equal(usesOldSafeguardCostReduction({ star: 17, costMultiplier: 1 }), false);
});

test("30% cost reduction leaves old safeguard surcharge undiscounted", () => {
  assert.equal(
    getEventAdjustedTapCost({
      baseCost: 526_565_100,
      star: 17,
      costMultiplier: 3,
      costReduction30: true,
    }),
    1_421_725_800,
  );
});

test("30% cost reduction discounts the full cost outside old safeguard stars", () => {
  const baseCost = 526_565_100;
  const costMultiplier = 6.5;
  assert.equal(
    getEventAdjustedTapCost({
      baseCost,
      star: 18,
      costMultiplier,
      costReduction30: true,
    }),
    roundToHundreds(baseCost * costMultiplier * 0.7),
  );
});
