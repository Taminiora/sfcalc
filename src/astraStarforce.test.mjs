import assert from "node:assert/strict";
import test from "node:test";

import {
  ASTRA_REPLACEMENT_COST,
  calculateAstraStarforceProfileCosts,
  optimizeAstraStarforce,
} from "./astraStarforce.mjs";
import { formatStrategy } from "./strategyFormat.mjs";
import { RESTORE_LEVEL } from "./starforce.mjs";
import { getAdjustedTap, getTier } from "./sfTapMath.mjs";

const DEFAULT_EVENTS = Object.freeze({
  starCatch: true,
  costReduction30: true,
  boomReduction30: true,
});

function simulateBudgetHitRate(result, startStar, targetStar, trials = 20_000, events = DEFAULT_EVENTS) {
  let seed = 123456789;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed + 0.5) / 2 ** 32;
  };
  const modes = new Map(result.strategy.map((row) => [row.star, row.mode]));
  const taps = Array.from({ length: targetStar }, (_, star) => getAdjustedTap({
    itemLevel: 200, star, tier: getTier(star, modes.get(star) ?? "Base"), events,
  }));
  let hits = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    let star = startStar;
    let spent = 0;
    while (star < targetStar && spent <= result.pTargetCost) {
      const tap = taps[star];
      const eventProbability = tap.successRate + tap.boomProbability;
      const attempts = eventProbability === 1
        ? 1
        : Math.floor(Math.log(random()) / Math.log1p(-eventProbability)) + 1;
      spent += attempts * tap.tapCost;
      if (random() * eventProbability < tap.successRate) {
        star += 1;
      } else {
        spent += ASTRA_REPLACEMENT_COST;
        star = RESTORE_LEVEL[star];
      }
    }
    if (star === targetStar && spent <= result.pTargetCost) hits += 1;
  }
  return hits / trials;
}

test("Astra target cost covers both random tap spending and replacements", () => {
  const result = calculateAstraStarforceProfileCosts({
    startStar: 23, targetStar: 24, hitProbability: 0.85, events: DEFAULT_EVENTS,
  });
  const observedProbability = simulateBudgetHitRate(result, 23, 24);
  assert.ok(Math.abs(observedProbability - 0.85) < 0.015,
    `85% total-cost budget actually reached ${(observedProbability * 100).toFixed(2)}%`);
});

test("Astra's other cost percentiles describe the selected policy", () => {
  const result = calculateAstraStarforceProfileCosts({
    startStar: 23, targetStar: 24, hitProbability: 0.85, events: DEFAULT_EVENTS,
  });
  for (const [field, probability] of [["p50Cost", 0.5], ["p75Cost", 0.75], ["p95Cost", 0.95]]) {
    const observed = simulateBudgetHitRate({ ...result, pTargetCost: result[field] }, 23, 24);
    assert.ok(Math.abs(observed - probability) < 0.015, `${field}: ${observed}`);
  }
});

test("Astra returns isolated cached results", () => {
  const input = { startStar: 23, targetStar: 24, hitProbability: 0.85, events: DEFAULT_EVENTS };
  const first = calculateAstraStarforceProfileCosts(input);
  first.strategy[0].mode = "4";
  first.pTargetCost = 1;
  const second = calculateAstraStarforceProfileCosts(input);
  assert.equal(second.strategy[0].mode, "1");
  assert.ok(second.pTargetCost > second.expectedTotalCost);
});

test("Astra budgets also match simulations without event discounts", () => {
  const events = { starCatch: false, costReduction30: false, boomReduction30: false };
  const result = calculateAstraStarforceProfileCosts({
    startStar: 23, targetStar: 24, hitProbability: 0.85, events,
  });
  const observed = simulateBudgetHitRate(result, 23, 24, 20_000, events);
  assert.ok(Math.abs(observed - 0.85) < 0.015, `Off-event budget reached ${observed}`);
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
  assert.equal(p85.availableSpares, null);
  assert.ok(p85.p50Cost < p85.expectedTotalCost);
  assert.ok(p85.pTargetCost > p85.expectedTotalCost);
  assert.ok(p95.pTargetCost > p85.pTargetCost);
  assert.ok(p95.requiredBooms > p85.requiredBooms);
  assert.ok(p95.achievedProbability >= 0.95);
  assert.ok(Math.abs(simulateBudgetHitRate(p95, 22, 23) - 0.95) < 0.01);
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
  const costs = calculateAstraStarforceProfileCosts({
    startStar: 22, targetStar: 23, hitProbability: 0.85, events: DEFAULT_EVENTS,
  });
  assert.equal(result.totalExpectedCost, costs.pTargetCost);
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
  assert.ok(result.pTargetCost > result.expectedMeso);
  assert.ok(result.p95Cost > result.pTargetCost);
  assert.ok(Number.isFinite(result.p95Cost));
  assert.equal(result.strategy.at(-1).star, 29);
});

test("Astra rejects a finite-budget 100% guarantee", () => {
  assert.throws(() => calculateAstraStarforceProfileCosts({
    startStar: 22, targetStar: 23, hitProbability: 1, events: DEFAULT_EVENTS,
  }), /less than 100%/);
});

test("Astra handles discrete low-budget outcomes and lower-star targets", () => {
  const firstTap = getAdjustedTap({ itemLevel: 200, star: 22, tier: getTier(22, "Base"), events: DEFAULT_EVENTS });
  const lowOdds = calculateAstraStarforceProfileCosts({
    startStar: 22, targetStar: 23, hitProbability: 0.01, events: DEFAULT_EVENTS,
  });
  assert.equal(lowOdds.pTargetCost, firstTap.tapCost);
  assert.ok(Math.abs(lowOdds.achievedProbability - firstTap.successRate) < 1e-12);
  for (const [startStar, targetStar] of [[12, 15], [15, 16], [17, 18], [18, 19], [20, 21]]) {
    const result = calculateAstraStarforceProfileCosts({ startStar, targetStar, hitProbability: 0.85, events: DEFAULT_EVENTS });
    assert.ok(result.achievedProbability >= 0.85);
    assert.ok(simulateBudgetHitRate(result, startStar, targetStar) >= 0.835);
  }
});
