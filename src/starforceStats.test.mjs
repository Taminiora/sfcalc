import assert from "node:assert/strict";
import test from "node:test";

import { calculateStarforceStatGains } from "./starforceStats.mjs";

test("calculates level 250 armor stat gains from 15 to 22 stars", () => {
  assert.deepEqual(
    calculateStarforceStatGains({
      itemType: "armor",
      itemLevel: 250,
      startStar: 15,
      targetStar: 22,
    }),
    {
      Attack: 120,
      "Class Stat": 119,
    },
  );
});

test("calculates high-star armor gains without adding extra class stat past 22", () => {
  assert.deepEqual(
    calculateStarforceStatGains({
      itemType: "accessory",
      itemLevel: 250,
      startStar: 22,
      targetStar: 25,
    }),
    {
      Attack: 75,
    },
  );
});

test("uses weapon high-star attack deltas and caps level 250 weapons to the 200 bracket", () => {
  assert.deepEqual(
    calculateStarforceStatGains({
      itemType: "weapon",
      itemLevel: 250,
      startStar: 15,
      targetStar: 22,
    }),
    {
      Attack: 102,
      "Class Stat": 105,
    },
  );
});
