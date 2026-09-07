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
    assert.equal(options.some((option) => option.value.includes("AllStat")), false);
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

test("exposes All Stat cubing thresholds for stat gear", () => {
  for (const itemType of ["armor", "accessory", "heart", "hat", "gloves", "shoes", "belt", "cape", "shoulder"]) {
    const options = getCubingStrategyOptions({ itemType, itemLevel: 200, desiredTier: "legendary" });
    assert.deepEqual(
      options.filter((option) => option.value.startsWith("percAllStat+")).map((option) => option.value),
      [12, 15, 18, 21, 24, 27, 30].map((amount) => `percAllStat+${amount}`),
    );
    assert.ok(options.some((option) => option.value === "percAllStat+27" && option.label === "27%+ All Stat"));
    assert.ok(options.some((option) => option.value === "percStat+36"));
  }
});

test("scales All Stat menu thresholds by item level and potential tier", () => {
  for (const [itemLevel, desiredTier, amounts] of [
    [140, "legendary", [9, 12, 15, 18, 21, 24, 27]],
    [200, "unique", [3, 6, 9, 12, 15, 18, 21]],
    [140, "epic", [3, 6, 9]],
    [200, "epic", [4, 8, 12]],
  ]) {
    const options = getCubingStrategyOptions({ itemType: "heart", itemLevel, desiredTier });
    assert.deepEqual(
      options.filter((option) => option.value.startsWith("percAllStat+")).map((option) => option.value),
      amounts.map((amount) => `percAllStat+${amount}`),
    );
  }
});

test("calculates costs from an All Stat menu selection", () => {
  const source = { cubeType: "black", itemType: "heart", itemLevel: 200, desiredTier: "legendary", percentile: 0.65 };
  const option = getCubingStrategyOptions(source).find((option) => option.value === "percAllStat+27");
  assert.ok(option);
  const costs = calculateCubingProfileCosts({ ...source, target: option.value });
  const probability = getCubingProbability({ ...source, target: "percAllStat+27" });
  assert.ok(probability > 0);
  assert.equal(costs.successProbability, probability);
  assert.ok(Number.isFinite(costs.expectedCost) && costs.expectedCost > 0);
  assert.ok(Number.isFinite(costs.pTargetCost) && costs.pTargetCost > 0);
  assert.equal(costs.strategy, "percAllStat+27");
  assert.equal(costs.targetPercentile, 0.65);
});

test("All Stat percentage targets count only actual All Stat lines", () => {
  for (const cubeType of ["red", "black"]) {
    for (const itemLevel of [140, 200]) {
      const source = { cubeType, itemType: "heart", itemLevel, desiredTier: "legendary" };
      const oneLine = getCubingProbability({ ...source, target: "lineAllStat+1" });
      const threeLines = getCubingProbability({ ...source, target: "lineAllStat+3" });
      const threshold = itemLevel >= 160 ? 22 : 19;

      assert.ok(oneLine > 0 && threeLines > 0);
      assert.ok(Math.abs(getCubingProbability({ ...source, target: "percAllStat+1" }) - oneLine) < 1e-12);
      // Two prime All Stat lines cannot reach this threshold, even with a STR/DEX/LUK third line.
      assert.ok(Math.abs(getCubingProbability({ ...source, target: `percAllStat+${threshold}` }) - threeLines) < 1e-12);
    }
  }
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

test("calculates cubing expected and target-odds costs with geometric variance", () => {
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
  assert.equal(costs.targetPercentile, 0.95);
  assert.ok(costs.pTargetCubes > costs.meanCubes);
  assert.equal(costs.cubeVariance, (1 - costs.successProbability) / costs.successProbability ** 2);
  assert.equal(costs.costVariance, costs.cubeVariance * costs.costPerCube ** 2);
  assert.equal(costs.expectedCost, costs.meanCubes * (costs.cubeCost + costs.revealCost));
  assert.equal(costs.pTargetCost, costs.pTargetCubes * (costs.cubeCost + costs.revealCost));
  assert.equal(costs.p95Cost, costs.pTargetCost);
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
  assert.equal(saleCosts.cubeSaleDiscount, 0.25);
  assert.equal(saleCosts.cubeCost, normalCosts.cubeCost * 0.75);
  assert.equal(saleCosts.revealCost, normalCosts.revealCost);
  assert.equal(saleCosts.costPerCube, saleCosts.cubeCost + saleCosts.revealCost);
  assert.equal(saleCosts.expectedCost, saleCosts.costPerCube * saleCosts.meanCubes);
});
