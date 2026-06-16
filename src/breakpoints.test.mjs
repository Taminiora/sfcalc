import assert from "node:assert/strict";
import test from "node:test";

import { calculateBreakpointTable, getDiscountedModeCost } from "./breakpoints.mjs";

test("calculates starcatch and reduction breakpoints for level 250", () => {
  const rows = calculateBreakpointTable({ itemLevel: 250 });

  assert.equal(rows.length, 15);
  assert.equal(rows[0].optimal, "111/11/11");
  assert.equal(rows[0].lowEndSpareCost, 0);
  assert.equal(rows[0].expectedBooms.toFixed(3), "3.816");
  assert.equal(Math.round(rows[0].expectedCostTo22), 30_466_209_699);

  assert.equal(rows.at(-1).optimal, "444/44/44");
  assert.equal(Math.round(rows.at(-1).lowEndSpareCost), 221_653_480_088);
  assert.equal(rows.at(-1).expectedBooms.toFixed(3), "0.000");
  assert.equal(Math.round(rows.at(-1).expectedCostTo22), 187_448_240_397);
});

test("discounts only the base cost, not the mode surcharge", () => {
  const modeFourCost = getDiscountedModeCost({
    baseCost: 526_565_100,
    costMultiplier: 6.5,
  });

  assert.equal(modeFourCost, 3_264_703_600);
});
