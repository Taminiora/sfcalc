import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateRange,
  getBaseCost,
} from "./starforce.mjs";

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should be close to ${expected}`);
}

test("uses Cary's level 160 base costs", () => {
  assert.equal(getBaseCost(160, 15), 36_514_500);
  assert.equal(getBaseCost(160, 16), 43_008_300);
  assert.equal(getBaseCost(160, 17), 66_913_100);
  assert.equal(getBaseCost(160, 18), 165_920_200);
  assert.equal(getBaseCost(160, 19), 296_435_300);
  assert.equal(getBaseCost(160, 20), 76_090_000);
  assert.equal(getBaseCost(160, 21), 138_036_600);
});

test("uses Cary's raw 12 to 15 baseline in boom recovery", () => {
  const baseline = calculateRange({
    itemLevel: 160,
    startStar: 12,
    endStar: 15,
    spareCost: 0,
  });

  assert.equal(Math.round(baseline.expectedMeso), 474_414_464);

  const result = calculateRange({
    itemLevel: 160,
    startStar: 15,
    endStar: 16,
    spareCost: 0,
  });

  assert.equal(Math.round(result.expectedMeso), 154_924_013);
  assertClose(result.expectedBooms, 0.07);
  assert.equal(Math.round(result.expectedTotal), 154_924_013);
  assert.equal(result.rows[0].bestTier.id, "1");
});

test("optimizes by meso plus expected spare cost", () => {
  const result = calculateRange({
    itemLevel: 160,
    startStar: 15,
    endStar: 22,
    spareCost: 5_000_000_000,
  });

  const star15 = result.rows.find((row) => row.star === 15);
  assert.equal(star15.bestTier.id, "4");
  assert.equal(star15.expectedBooms, 0);
  assert.equal(Math.round(star15.expectedTotal), 365_145_000);

  assert.equal(
    Math.round(result.expectedTotal),
    Math.round(result.expectedMeso + result.expectedBooms * 5_000_000_000),
  );
});

test("validates star ranges", () => {
  assert.throws(
    () =>
      calculateRange({
        itemLevel: 160,
        startStar: 22,
        endStar: 15,
        spareCost: 0,
      }),
    /End star must be greater than start star/,
  );
});
