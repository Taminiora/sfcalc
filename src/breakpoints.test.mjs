import assert from "node:assert/strict";
import test from "node:test";

import { calculateBreakpointTable, getDiscountedModeCost } from "./breakpoints.mjs";

test("calculates starcatch and reduction breakpoints for level 250", () => {
  const rows = calculateBreakpointTable({ itemLevel: 250 });

  assert.equal(rows.length, 14);
  assert.equal(rows[0].optimal, "111/11/11");
  assert.equal(rows[0].lowEndSpareCost, 0);
  assert.equal(rows[0].expectedBooms.toFixed(3), "3.816");
  assert.equal(Math.round(rows[0].expectedCostTo22), 30_466_209_699);

  assert.equal(rows.at(-1).optimal, "444/44/44");
  assert.equal(Math.round(rows.at(-1).lowEndSpareCost), 156_904_880_932);
  assert.equal(rows.at(-1).expectedBooms.toFixed(3), "0.000");
  assert.equal(Math.round(rows.at(-1).expectedCostTo22), 137_869_109_762);
});

test("discounts the full mode cost", () => {
  const modeFourCost = getDiscountedModeCost({
    baseCost: 526_565_100,
    costMultiplier: 6.5,
  });

  assert.equal(modeFourCost, 2_395_871_200);
});
