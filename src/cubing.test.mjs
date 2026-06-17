import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCubingProfileCosts,
  getCubingProbability,
  getCubingStrategyGroups,
  getCubingStrategyOptions,
  parseCubingTarget,
} from "./cubing.mjs";

test("parses MathBro strategy predicates", () => {
  assert.deepEqual(parseCubingTarget("lineAtt+1&lineBoss+2"), {
    lineAtt: 1,
    lineBoss: 2,
  });
  assert.deepEqual(parseCubingTarget("primeStat+2&lineStat+3"), {
    lineStat: 3,
    primeStat: 2,
  });
});

test("exposes endgame cubing strategy options by item type", () => {
  const weaponOptions = getCubingStrategyOptions({ itemType: "weapon" });
  const hatOptions = getCubingStrategyOptions({ itemType: "hat" });
  const topGroups = getCubingStrategyGroups({ itemType: "top" });

  assert.ok(weaponOptions.some((option) => option.value === "percAtt+39"));
  assert.ok(hatOptions.some((option) => option.value === "secCooldown+4"));
  assert.ok(
    hatOptions.some(
      (option) => option.label === "-2s Cooldown + 2L stat" && option.value === "secCooldown+2&lineStat+2",
    ),
  );
  assert.ok(
    hatOptions.some(
      (option) => option.label === "-3s Cooldown + stat" && option.value === "secCooldown+3&lineStat+1",
    ),
  );
  assert.equal(topGroups.some((group) => group.label === "Prime lines"), false);
  assert.ok(topGroups.some((group) => group.label === "Stat thresholds"));
});

test("uses MathBro-style attack choices for WSE item types", () => {
  for (const itemType of ["weapon", "secondary", "emblem"]) {
    const options = getCubingStrategyOptions({
      itemType,
      itemLevel: 250,
      desiredTier: "legendary",
    });

    assert.equal(options.some((option) => option.value.includes("primeStat")), false);
    assert.ok(options.some((option) => option.value === "percAtt+26"));
    assert.ok(options.some((option) => option.value === "percAtt+39"));
    assert.ok(options.some((option) => option.value === "lineIed+1&percAtt+26"));
    assert.ok(options.some((option) => option.value === "lineAtt+2&lineAttOrBossOrIed+3"));
  }

  const weaponOptions = getCubingStrategyOptions({ itemType: "weapon", itemLevel: 250 });
  const emblemOptions = getCubingStrategyOptions({ itemType: "emblem", itemLevel: 250 });

  assert.ok(weaponOptions.some((option) => option.value === "lineAttOrBoss+3"));
  assert.equal(emblemOptions.some((option) => option.value === "lineAttOrBoss+3"), false);
});

test("hides prime-line shortcuts while preserving explicit prime target math", () => {
  const topOptions = getCubingStrategyOptions({ itemType: "top" });

  assert.equal(topOptions.some((option) => option.value === "primeStat+2"), false);
  assert.equal(topOptions.some((option) => option.value.includes("primeStat")), false);
  assert.ok(topOptions.some((option) => option.value === "percStat+39"));

  const twoLineProbability = getCubingProbability({
    cubeType: "red",
    itemType: "top",
    itemLevel: 250,
    desiredTier: "legendary",
    target: "lineStat+2",
  });
  const doublePrimeProbability = getCubingProbability({
    cubeType: "red",
    itemType: "top",
    itemLevel: 250,
    desiredTier: "legendary",
    target: "primeStat+2",
  });
  const doublePrimeThreeLineProbability = getCubingProbability({
    cubeType: "red",
    itemType: "top",
    itemLevel: 250,
    desiredTier: "legendary",
    target: "primeStat+2&lineStat+3",
  });
  const triplePrimeProbability = getCubingProbability({
    cubeType: "red",
    itemType: "top",
    itemLevel: 250,
    desiredTier: "legendary",
    target: "primeStat+3",
  });

  assert.ok(doublePrimeProbability > 0);
  assert.ok(doublePrimeProbability < twoLineProbability);
  assert.ok(doublePrimeThreeLineProbability > 0);
  assert.ok(doublePrimeThreeLineProbability < doublePrimeProbability);
  assert.ok(triplePrimeProbability > 0);
  assert.ok(triplePrimeProbability < doublePrimeThreeLineProbability);
});

test("calculates p85 cubing cost by default from target probability and MathBro cube costs", () => {
  const costs = calculateCubingProfileCosts({
    cubeType: "red",
    itemType: "weapon",
    itemLevel: 250,
    desiredTier: "legendary",
    target: "lineAtt+3",
    percentile: 0.95,
  });

  assert.equal(costs.strategy, "lineAtt+3");
  assert.equal(costs.cubeCost, 12_000_000);
  assert.equal(costs.revealCost, 1_250_000);
  assert.ok(costs.successProbability > 0);
  assert.ok(costs.p85Cubes > costs.meanCubes);
  assert.equal(costs.expectedCost, costs.meanCubes * (costs.cubeCost + costs.revealCost));
  assert.equal(costs.p85Cost, costs.p85Cubes * (costs.cubeCost + costs.revealCost));
  assert.equal(costs.p95Cost, costs.p85Cost);
});

test("applies cube sale to cube cost but not reveal cost", () => {
  const normalCosts = calculateCubingProfileCosts({
    cubeType: "red",
    itemType: "weapon",
    itemLevel: 250,
    desiredTier: "legendary",
    target: "lineAtt+3",
  });
  const saleCosts = calculateCubingProfileCosts({
    cubeType: "red",
    itemType: "weapon",
    itemLevel: 250,
    desiredTier: "legendary",
    target: "lineAtt+3",
    cubeSale: true,
  });

  assert.equal(saleCosts.cubeSale, true);
  assert.equal(saleCosts.cubeSaleDiscount, 0.3);
  assert.equal(saleCosts.cubeCost, normalCosts.cubeCost * 0.7);
  assert.equal(saleCosts.revealCost, normalCosts.revealCost);
  assert.equal(saleCosts.costPerCube, saleCosts.cubeCost + saleCosts.revealCost);
  assert.equal(saleCosts.expectedCost, saleCosts.costPerCube * saleCosts.meanCubes);
});
