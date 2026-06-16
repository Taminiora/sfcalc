import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSpareProbability,
  calculateStarforceProfileCosts,
  findRequiredSpares,
  optimizeStarforce,
} from "./plannerStarforce.mjs";
import { getBaseCost } from "./starforce.mjs";
import { formatStrategy } from "./strategyFormat.mjs";

test("computes required spares as a probability guarantee", () => {
  const distribution = new Map([
    [0, 0.7],
    [1, 0.2],
    [2, 0.1],
  ]);

  assert.equal(calculateSpareProbability(distribution, 0), 0.7);
  assert.equal(findRequiredSpares(distribution, 0.9).requiredSpares, 1);
});

test("copium full cost reduction discounts mode surcharge and supersedes base reduction", () => {
  const baseCost = getBaseCost(250, 15);
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 15,
    targetStar: 16,
    sfFdGain: 1,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.85,
    events: {
      starCatch: false,
      costReduction30: true,
      fullCostReduction30: true,
      boomReduction30: false,
    },
  });

  assert.equal(formatStrategy(result.strategy), "4");
  assert.equal(result.strategy[0].tapCost, 100 * Math.round((baseCost * 3 * 0.7) / 100));
  assert.notEqual(result.strategy[0].tapCost, 100 * Math.round((baseCost * 2.7) / 100));
});

test("optimizes a 15 to 22 strategy against a benchmark", () => {
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 15,
    targetStar: 22,
    sfFdGain: 2,
    benchmarkFdPerMeso: 1e-12,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.equal(result.startStar, 15);
  assert.equal(result.targetStar, 22);
  assert.equal(result.strategy.length, 7);
  assert.ok(result.requiredSpares >= 0);
  assert.ok(result.achievedProbability >= 0.95);
  assert.ok(result.expectedMeso > 0);
  assert.ok(result.expectedBooms >= 0);
  assert.equal(result.sfFdGain, 2);
  assert.equal(result.meetsBenchmark, result.fdPerMeso >= 1e-12);
  assert.equal(result.guaranteeMet, true);
  assert.equal(result.availableSpares, null);
});

test("chooses the most conservative strategy that still clears the benchmark", () => {
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 15,
    targetStar: 22,
    sfFdGain: 1,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.equal(result.availableSpares, null);
  assert.equal(result.guaranteeMet, true);
  assert.ok(result.achievedProbability >= 0.95);
  assert.equal(result.meetsBenchmark, true);
  assert.equal(result.expectedBooms, 0);
  assert.equal(formatStrategy(result.strategy), "444/44/44");
});

test("chooses benchmark strategies from the spare-cost frontier", () => {
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 15,
    targetStar: 22,
    sfFdGain: 1,
    benchmarkFdPerMeso: 1 / 185_700_000_000,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.equal(result.meetsBenchmark, true);
  assert.equal(formatStrategy(result.strategy), "444/34/44");
});

test("falls back to the least conservative strategy when it cannot compete", () => {
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 15,
    targetStar: 22,
    sfFdGain: 1,
    benchmarkFdPerMeso: 1,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.equal(result.meetsBenchmark, false);
  assert.equal(formatStrategy(result.strategy), "111/11/11");
});

test("includes recovery strategy tiers for high-star targets", () => {
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 21,
    targetStar: 22,
    sfFdGain: 1,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.deepEqual(
    result.strategy.map((row) => row.star),
    [15, 16, 17, 18, 19, 20, 21],
  );
  assert.match(formatStrategy(result.strategy), /^\d{3}\/\d{2}\/\d{2}$/);
  assert.ok(result.strategy.reduce((sum, row) => sum + row.expectedMeso, 0) > result.expectedMeso);
});

test("includes recursive recovery strategy when 22 star taps can boom", () => {
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 22,
    targetStar: 23,
    sfFdGain: 1,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.deepEqual(
    result.strategy.map((row) => row.star),
    [15, 16, 17, 18, 19, 20, 21, 22],
  );
  assert.match(formatStrategy(result.strategy), /^\d{3}\/\d{2}\/\d{2}\/B$/);
});

test("saved profile costs report when available spares cannot meet the guarantee", () => {
  const result = calculateStarforceProfileCosts({
    itemLevel: 250,
    startStar: 22,
    targetStar: 23,
    spareCount: 0,
    sfFdGain: 1,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.equal(result.availableSpares, 0);
  assert.equal(result.guaranteeMet, false);
  assert.ok(result.achievedProbability < 0.95);
  assert.ok(result.requiredSpares > 0);
});

test("supports star-force targets up to 25", () => {
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 22,
    targetStar: 25,
    sfFdGain: 3,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.9,
    events: {
      starCatch: true,
      costReduction30: false,
      boomReduction30: true,
    },
  });

  assert.deepEqual(
    result.strategy.map((row) => row.star),
    [15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  );
  assert.ok(result.requiredSpares > 0);
  assert.equal(result.availableSpares, null);
  assert.equal(result.guaranteeMet, true);
  assert.ok(result.achievedProbability >= 0.9);
});

test("returns independent cached star-force optimization results", () => {
  const params = {
    itemLevel: 160,
    startStar: 15,
    targetStar: 16,
    sfFdGain: 1,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.85,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  };
  const first = optimizeStarforce(params);
  first.strategy[0].mode = "mutated";
  first.boomDistribution.clear();

  const second = optimizeStarforce(params);

  assert.notEqual(second.strategy[0].mode, "mutated");
  assert.ok(second.boomDistribution.size > 0);
});

test("shows full recursive recovery path for 24 to 25 targets", () => {
  const result = optimizeStarforce({
    itemLevel: 250,
    startStar: 24,
    targetStar: 25,
    sfFdGain: 1,
    benchmarkFdPerMeso: 0,
    hitProbability: 0.85,
    events: {
      starCatch: true,
      costReduction30: false,
      boomReduction30: true,
    },
  });

  assert.deepEqual(
    result.strategy.map((row) => row.star),
    [15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  );
});

test("saved profile costs include recursive recovery strategy for 22 to 23", () => {
  const result = calculateStarforceProfileCosts({
    itemLevel: 250,
    startStar: 22,
    targetStar: 23,
    spareCount: 20,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.deepEqual(
    result.strategy.map((row) => row.star),
    [15, 16, 17, 18, 19, 20, 21, 22],
  );
});

test("calculates star-force percentile costs for saved upgrade profiles with spare inventory", () => {
  const result = calculateStarforceProfileCosts({
    itemLevel: 250,
    startStar: 15,
    targetStar: 22,
    spareCount: 20,
    hitProbability: 0.95,
    events: {
      starCatch: true,
      costReduction30: true,
      boomReduction30: true,
    },
  });

  assert.ok(result.p50Cost > 0);
  assert.ok(result.p75Cost >= result.p50Cost);
  assert.ok(result.p95Cost >= result.p75Cost);
  assert.equal(result.p50Cost, result.expectedMeso);
  assert.equal(result.p75Cost, result.expectedMeso);
  assert.equal(result.p95Cost, result.expectedMeso);
  assert.equal(result.availableSpares, 20);
  assert.ok(result.requiredSpares >= 0);
  assert.ok(result.achievedProbability >= 0.95);
  assert.equal(result.guaranteeMet, true);
  assert.equal(result.strategy.length, 7);
});
