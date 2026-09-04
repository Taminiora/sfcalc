import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTotalCostCdf,
  createStarforceCostModel,
  findTotalCostPercentile,
} from "./sfCostDistribution.mjs";

test("a no-boom tap has an exact geometric cost percentile", () => {
  const model = createStarforceCostModel({
    startStar: 0,
    taps: [{ tapCost: 100, successRate: 0.5, boomProbability: 0, failureProbability: 0.5 }],
  });
  assert.equal(findTotalCostPercentile(model, 0.5), 100);
  assert.equal(findTotalCostPercentile(model, 0.85), 300);
  assert.equal(calculateTotalCostCdf(model, 299), 0.75);
  assert.equal(calculateTotalCostCdf(model, 300), 0.875);
});

test("total-cost CDF charges the boom replacement and all recovery taps", () => {
  // From star 1, a success costs 3 (probability 1/2). A boom, recovery and
  // success cost 3+5+2+3=13 (1/4). Each subsequent boom adds another 10.
  const model = createStarforceCostModel({
    startStar: 1,
    replacementCostPerBoom: 5,
    taps: [
      { tapCost: 2, successRate: 1, boomProbability: 0, failureProbability: 0 },
      { tapCost: 3, successRate: 0.5, boomProbability: 0.5, failureProbability: 0, restoreStar: 0 },
    ],
  });
  assert.equal(model.mean, 13);
  assert.equal(calculateTotalCostCdf(model, 12), 0.5);
  assert.equal(calculateTotalCostCdf(model, 13), 0.75);
  assert.equal(calculateTotalCostCdf(model, 23), 0.875);
  assert.equal(findTotalCostPercentile(model, 0.85), 23);
});

test("transform inversion agrees with a negative-binomial CDF at large budgets", () => {
  const p = 0.00001;
  const model = createStarforceCostModel({
    startStar: 0,
    taps: Array.from({ length: 2 }, () => ({
      tapCost: 100, successRate: p, failureProbability: 1 - p, boomProbability: 0,
    })),
  });
  for (const attempts of [150_000, 300_000, 500_000]) {
    const expected = 1 - (1 - p) ** attempts - attempts * p * (1 - p) ** (attempts - 1);
    const actual = calculateTotalCostCdf(model, attempts * 100);
    assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} vs ${expected}`);
  }
});
