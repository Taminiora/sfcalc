import assert from "node:assert/strict";
import test from "node:test";

import {
  ASTRA_REPLACEMENT_COST,
  calculateAstraStarforceProfileCosts,
  optimizeAstraStarforce,
} from "./astraStarforce.mjs";
import { formatStrategy } from "./strategyFormat.mjs";

const DEFAULT_EVENTS = Object.freeze({
  starCatch: true,
  costReduction30: true,
  boomReduction30: true,
});

test("Astra profile costs optimize strategy from target odds instead of spare count", () => {
  const p85 = calculateAstraStarforceProfileCosts({
    startStar: 22,
    targetStar: 23,
    hitProbability: 0.85,
    events: DEFAULT_EVENTS,
  });
  const p95 = calculateAstraStarforceProfileCosts({
    startStar: 22,
    targetStar: 23,
    hitProbability: 0.95,
    events: DEFAULT_EVENTS,
  });

  assert.equal(formatStrategy(p85.strategy, { showBaseSuffix: false }), "111/11/11");
  assert.equal(formatStrategy(p95.strategy, { showBaseSuffix: false }), "112/11/23");
  assert.equal(p85.availableSpares, null);
  assert.equal(p85.p85Cost, p85.expectedMeso + p85.requiredBooms * ASTRA_REPLACEMENT_COST);
  assert.ok(p95.requiredBooms > p85.requiredBooms);
  assert.ok(p95.achievedProbability >= 0.95);
});

test("Astra optimizer compares benchmark efficiency against target-odds cost", () => {
  const result = optimizeAstraStarforce({
    startStar: 22,
    targetStar: 23,
    sfFdGain: 0.5,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.85,
    events: DEFAULT_EVENTS,
  });

  assert.equal(result.itemLevel, 200);
  assert.equal(result.requiredSpares, result.requiredBooms);
  assert.equal(result.totalExpectedCost, result.expectedMeso + result.requiredBooms * ASTRA_REPLACEMENT_COST);
  assert.equal(result.fdPerMeso, result.sfFdGain / result.totalExpectedCost);
});

test("Astra supports high-star targets through 30", () => {
  const result = calculateAstraStarforceProfileCosts({
    startStar: 26,
    targetStar: 30,
    hitProbability: 0.85,
    events: DEFAULT_EVENTS,
  });

  assert.ok(result.requiredBooms > 0);
  assert.ok(result.achievedProbability >= 0.85);
  assert.ok(result.p85Cost > result.expectedMeso);
  assert.equal(result.p85Cost, result.expectedMeso + result.requiredBooms * ASTRA_REPLACEMENT_COST);
  assert.equal(result.strategy.at(-1).star, 29);
});
