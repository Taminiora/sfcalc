import { cubeRates } from "./cubingRates.mjs";

const CUBE_COSTS = Object.freeze({
  occult: 0,
  master: 7_500_000,
  meister: 0,
  red: 12_000_000,
  black: 22_000_000,
});

const CUBE_SALE_DISCOUNT = 0.3;

const TIER_TO_LABEL = Object.freeze({
  0: "rare",
  1: "epic",
  2: "unique",
  3: "legendary",
  rare: "rare",
  epic: "epic",
  unique: "unique",
  legendary: "legendary",
});

const TIER_TO_NUMBER = Object.freeze({
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  rare: 0,
  epic: 1,
  unique: 2,
  legendary: 3,
});

const EMPTY_TARGET = Object.freeze({
  percStat: 0,
  primeStat: 0,
  lineStat: 0,
  percAllStat: 0,
  lineAllStat: 0,
  percHp: 0,
  lineHp: 0,
  percAtt: 0,
  lineAtt: 0,
  percBoss: 0,
  lineBoss: 0,
  lineIed: 0,
  lineCritDamage: 0,
  lineMeso: 0,
  lineDrop: 0,
  lineMesoOrDrop: 0,
  secCooldown: 0,
  lineAutoSteal: 0,
  lineAttOrBoss: 0,
  lineAttOrBossOrIed: 0,
  lineBossOrIed: 0,
});

const CATEGORY = Object.freeze({
  STR_PERC: "STR %",
  DEX_PERC: "DEX %",
  INT_PERC: "INT %",
  LUK_PERC: "LUK %",
  MAXHP_PERC: "Max HP %",
  ALLSTATS_PERC: "All Stats %",
  ATT_PERC: "ATT %",
  MATT_PERC: "MATT %",
  BOSSDMG_PERC: "Boss Damage",
  IED_PERC: "Ignore Enemy Defense %",
  MESO_PERC: "Meso Amount %",
  DROP_PERC: "Item Drop Rate %",
  AUTOSTEAL_PERC: "Chance to auto steal %",
  CRITDMG_PERC: "Critical Damage %",
  CDR_TIME: "Skill Cooldown Reduction",
  JUNK: "Junk",
  DECENT_SKILL: "Decent Skill",
  INVINCIBLE_PERC: "Chance of being invincible for seconds when hit",
  INVINCIBLE_TIME: "Increase invincibility time after being hit",
  IGNOREDMG_PERC: "Chance to ignore % damage when hit",
});

const INPUT_CATEGORY_MAP = Object.freeze({
  percStat: [CATEGORY.STR_PERC, CATEGORY.ALLSTATS_PERC],
  primeStat: [CATEGORY.STR_PERC],
  lineStat: [CATEGORY.STR_PERC, CATEGORY.ALLSTATS_PERC],
  percAllStat: [CATEGORY.ALLSTATS_PERC, CATEGORY.STR_PERC, CATEGORY.DEX_PERC, CATEGORY.LUK_PERC],
  lineAllStat: [CATEGORY.ALLSTATS_PERC],
  percHp: [CATEGORY.MAXHP_PERC],
  lineHp: [CATEGORY.MAXHP_PERC],
  percAtt: [CATEGORY.ATT_PERC],
  lineAtt: [CATEGORY.ATT_PERC],
  percBoss: [CATEGORY.BOSSDMG_PERC],
  lineBoss: [CATEGORY.BOSSDMG_PERC],
  lineIed: [CATEGORY.IED_PERC],
  lineCritDamage: [CATEGORY.CRITDMG_PERC],
  lineMeso: [CATEGORY.MESO_PERC],
  lineDrop: [CATEGORY.DROP_PERC],
  lineMesoOrDrop: [CATEGORY.DROP_PERC, CATEGORY.MESO_PERC],
  secCooldown: [CATEGORY.CDR_TIME],
  lineAutoSteal: [CATEGORY.AUTOSTEAL_PERC],
  lineAttOrBoss: [CATEGORY.ATT_PERC, CATEGORY.BOSSDMG_PERC],
  lineAttOrBossOrIed: [CATEGORY.ATT_PERC, CATEGORY.BOSSDMG_PERC, CATEGORY.IED_PERC],
  lineBossOrIed: [CATEGORY.BOSSDMG_PERC, CATEGORY.IED_PERC],
});

const MAX_CATEGORY_COUNT = Object.freeze({
  [CATEGORY.DECENT_SKILL]: 1,
  [CATEGORY.INVINCIBLE_TIME]: 1,
  [CATEGORY.IED_PERC]: 3,
  [CATEGORY.BOSSDMG_PERC]: 3,
  [CATEGORY.DROP_PERC]: 3,
  [CATEGORY.IGNOREDMG_PERC]: 2,
  [CATEGORY.INVINCIBLE_PERC]: 2,
});

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function getDesiredTierNumber(desiredTier = "legendary") {
  const number = TIER_TO_NUMBER[desiredTier];
  if (number === undefined) {
    throw new Error("Desired tier must be rare, epic, unique, or legendary");
  }
  return number;
}

function getPrimeLineValue(itemLevel = 250, desiredTier = "legendary", statType = "normal") {
  const levelBonus = Number(itemLevel) >= 160 ? 1 : 0;
  const base = statType === "allStat" ? 0 : 3;
  return base + 3 * getDesiredTierNumber(desiredTier) + levelBonus;
}

function get3LineAttackOptionAmounts(prime) {
  return [prime * 3 - 6, prime * 3 - 3, prime * 3].filter((value) => value > 0);
}

function get2LineAttackOptionAmounts(prime) {
  return [prime * 2 - 6, prime * 2 - 3, prime * 2].filter((value) => value > 0);
}

function get3LineStatOptionAmounts(prime) {
  return uniqueSorted([
    prime * 3 - 18,
    prime * 3 - 15,
    prime * 3 - 12,
    prime * 3 - 9,
    ...get3LineAttackOptionAmounts(prime),
  ].filter((value) => value > 0));
}

function getStatStrategyGroups({ itemLevel = 250, desiredTier = "legendary" } = {}) {
  const prime = getPrimeLineValue(itemLevel, desiredTier);
  return [
    {
      label: "Stat thresholds",
      options: get3LineStatOptionAmounts(prime).map((amount) => ({
        label: `${amount}%+ main stat`,
        value: `percStat+${amount}`,
      })),
    },
  ];
}

function getWseStrategyGroups({ itemType, itemLevel = 250, desiredTier = "legendary" }) {
  const prime = getPrimeLineValue(itemLevel, desiredTier);
  const twoLineAmounts = get2LineAttackOptionAmounts(prime);
  const threeLineAmounts = get3LineAttackOptionAmounts(prime);
  const attackAmounts = uniqueSorted([...twoLineAmounts, ...threeLineAmounts]);
  const tierNumber = getDesiredTierNumber(desiredTier);
  const showBoss = itemType !== "emblem" && tierNumber >= 2;
  const usefulLineText = `Attack/Magic Attack${showBoss ? "/Boss" : ""}/IED`;
  const usefulValue = "lineAttOrBossOrIed";

  const groups = [
    {
      label: "Attack / Magic Attack",
      options: attackAmounts.map((amount) => ({
        label: `${amount}%+ Attack/Magic Attack`,
        value: `percAtt+${amount}`,
      })),
    },
    {
      label: "Attack / Magic Attack With 1 Line IED",
      options: twoLineAmounts.map((amount) => ({
        label: `${amount}%+ Attack/Magic Attack and 1 Line IED`,
        value: `lineIed+1&percAtt+${amount}`,
      })),
    },
    {
      label: `Any Useful Lines (${usefulLineText})`,
      options: [1, 2, 3].map((lineCount) => ({
        label: `${lineCount} Line ${usefulLineText}`,
        value: `${usefulValue}+${lineCount}`,
      })),
    },
    {
      label: "Attack / Magic Attack + Any Useful Lines",
      options: [
        {
          label: `1 Line Attack/Magic Attack with 1 Line ${usefulLineText}`,
          value: `lineAtt+1&${usefulValue}+2`,
        },
        {
          label: `1 Line Attack/Magic Attack with 2 Line ${usefulLineText}`,
          value: `lineAtt+1&${usefulValue}+3`,
        },
        {
          label: `2 Line Attack/Magic Attack with 1 Line ${usefulLineText}`,
          value: `lineAtt+2&${usefulValue}+3`,
        },
      ],
    },
  ];

  if (showBoss) {
    const [, primeAndNonPrime, doublePrime] = twoLineAmounts;
    groups.push(
      {
        label: "Attack / Magic Attack and Boss Damage",
        options: [
          {
            label: "1 Line Attack/Magic Attack + 1 Line Boss",
            value: "lineAtt+1&lineBoss+1",
          },
          {
            label: "1 Line Attack/Magic Attack + 2 Line Boss",
            value: "lineAtt+1&lineBoss+2",
          },
          {
            label: "2 Line Attack/Magic Attack + 1 Line Boss",
            value: "lineAtt+2&lineBoss+1",
          },
          {
            label: `${primeAndNonPrime}%+ Attack/Magic Attack and 30%+ Boss`,
            value: `percAtt+${primeAndNonPrime}&percBoss+30`,
          },
          {
            label: `${primeAndNonPrime}%+ Attack/Magic Attack and 35%+ Boss`,
            value: `percAtt+${primeAndNonPrime}&percBoss+35`,
          },
          {
            label: `${primeAndNonPrime}%+ Attack/Magic Attack and 40%+ Boss`,
            value: `percAtt+${primeAndNonPrime}&percBoss+40`,
          },
          {
            label: `${doublePrime}%+ Attack/Magic Attack and 30%+ Boss`,
            value: `percAtt+${doublePrime}&percBoss+30`,
          },
        ],
      },
      {
        label: "Attack / Magic Attack or Boss Damage",
        options: [1, 2, 3].map((lineCount) => ({
          label: `${lineCount} Line Attack/Magic Attack or Boss`,
          value: `lineAttOrBoss+${lineCount}`,
        })),
      },
    );
  }

  return groups;
}

const CUBING_STRATEGY_GROUPS = Object.freeze({
  gloves: [
    {
      label: "Critical damage",
      options: [
        { label: "1L Crit Damage", value: "lineCritDamage+1" },
        { label: "2L Crit Damage", value: "lineCritDamage+2" },
        { label: "3L Crit Damage", value: "lineCritDamage+3" },
        { label: "2L Crit Damage + stat", value: "lineCritDamage+2&lineStat+1" },
      ],
    },
  ],
  hat: [
    {
      label: "Cooldown",
      options: [
        { label: "-2s Cooldown", value: "secCooldown+2" },
        { label: "-2s Cooldown + 2L stat", value: "secCooldown+2&lineStat+2" },
        { label: "-3s Cooldown", value: "secCooldown+3" },
        { label: "-3s Cooldown + stat", value: "secCooldown+3&lineStat+1" },
        { label: "-4s Cooldown", value: "secCooldown+4" },
        { label: "-5s Cooldown", value: "secCooldown+5" },
        { label: "-6s Cooldown", value: "secCooldown+6" },
        { label: "-4s Cooldown + stat", value: "secCooldown+4&lineStat+1" },
      ],
    },
  ],
  accessory: [
    {
      label: "Drop / meso",
      options: [
        { label: "1L Meso", value: "lineMeso+1" },
        { label: "1L Drop", value: "lineDrop+1" },
        { label: "2L Meso", value: "lineMeso+2" },
        { label: "2L Drop", value: "lineDrop+2" },
        { label: "2L Meso/Drop", value: "lineMesoOrDrop+2" },
      ],
    },
  ],
});

const STAT_STRATEGY_ITEM_TYPES = new Set([
  "accessory",
  "badge",
  "belt",
  "bottom",
  "cape",
  "gloves",
  "hat",
  "heart",
  "overall",
  "shoes",
  "shoulder",
  "top",
]);

const WSE_ITEM_TYPES = new Set(["weapon", "secondary", "emblem"]);

function normalizeItemType(itemType) {
  const value = String(itemType ?? "").trim();
  if (value === "glove") {
    return "gloves";
  }
  if (value === "armor") {
    return "top";
  }
  if (value === "accessory" || value === "badge") {
    return value === "badge" ? "heart" : "ring";
  }
  return value;
}

function normalizeStrategyItemType(itemType) {
  const value = String(itemType ?? "").trim();
  if (value === "glove") {
    return "gloves";
  }
  if (value === "armor") {
    return "top";
  }
  if (["ring", "pendant", "face", "eye", "earrings"].includes(value)) {
    return "accessory";
  }
  return value;
}

function normalizeTier(tier) {
  const label = TIER_TO_LABEL[tier];
  if (!label) {
    throw new Error("Desired tier must be rare, epic, unique, or legendary");
  }
  return label;
}

function getCubeData({ itemType, cubeType, desiredTier, itemLevel }) {
  const itemLabel = normalizeItemType(itemType);
  const tierLabel = normalizeTier(desiredTier);
  const rawCubeData = cubeRates.lvl120to200?.[itemLabel]?.[cubeType]?.[tierLabel];
  if (!rawCubeData) {
    throw new Error(`No cube rates for ${itemType} ${cubeType} ${tierLabel}`);
  }
  return convertCubeDataForLevel(rawCubeData, itemLevel);
}

function isSpecialLine(category) {
  return Object.hasOwn(MAX_CATEGORY_COUNT, category);
}

function addLineRate(lineRates, category, value, rate) {
  lineRates.push([category, value, rate]);
}

function getUsefulCategories(target) {
  const categories = [];
  for (const [field, mappedCategories] of Object.entries(INPUT_CATEGORY_MAP)) {
    if (target[field] > 0) {
      categories.push(...mappedCategories);
    }
  }
  return [...new Set(categories)];
}

function getConsolidatedRates(ratesList, usefulCategories) {
  const consolidatedRates = [];
  let junkRate = 0;
  const junkCategories = [];

  for (const [category, value, rate] of ratesList) {
    if (usefulCategories.includes(category) || isSpecialLine(category)) {
      addLineRate(consolidatedRates, category, value, rate);
    } else if (category === CATEGORY.JUNK) {
      junkRate += rate;
      junkCategories.push(...value);
    } else {
      junkRate += rate;
      junkCategories.push(`${category} (${value})`);
    }
  }

  addLineRate(consolidatedRates, CATEGORY.JUNK, junkCategories, junkRate);
  return consolidatedRates;
}

function calculateTotal(outcome, desiredCategory, valueMode = false) {
  return outcome.reduce((sum, [category, value]) => {
    if (category !== desiredCategory) {
      return sum;
    }
    return sum + (valueMode ? value : 1);
  }, 0);
}

function calculatePrimeStatLines(outcome) {
  return outcome.reduce((sum, [category, value]) => {
    if (category !== CATEGORY.STR_PERC || typeof value !== "number") {
      return sum;
    }
    return sum + (value >= 12 ? 1 : 0);
  }, 0);
}

function checkPercAllStat(outcome, requiredValue) {
  let actualValue = 0;
  for (const [category, value] of outcome) {
    if (category === CATEGORY.ALLSTATS_PERC) {
      actualValue += value;
    }
    if ([CATEGORY.STR_PERC, CATEGORY.DEX_PERC, CATEGORY.LUK_PERC].includes(category)) {
      actualValue += value / 3;
    }
  }
  return actualValue >= requiredValue;
}

const OUTCOME_MATCHERS = Object.freeze({
  percStat: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.STR_PERC, true) +
      calculateTotal(outcome, CATEGORY.ALLSTATS_PERC, true) >=
    requiredValue,
  primeStat: (outcome, requiredValue) => calculatePrimeStatLines(outcome) >= requiredValue,
  lineStat: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.STR_PERC) +
      calculateTotal(outcome, CATEGORY.ALLSTATS_PERC) >=
    requiredValue,
  percAllStat: checkPercAllStat,
  lineAllStat: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.ALLSTATS_PERC) >= requiredValue,
  percHp: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.MAXHP_PERC, true) >= requiredValue,
  lineHp: (outcome, requiredValue) => calculateTotal(outcome, CATEGORY.MAXHP_PERC) >= requiredValue,
  percAtt: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.ATT_PERC, true) >= requiredValue,
  lineAtt: (outcome, requiredValue) => calculateTotal(outcome, CATEGORY.ATT_PERC) >= requiredValue,
  percBoss: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.BOSSDMG_PERC, true) >= requiredValue,
  lineBoss: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.BOSSDMG_PERC) >= requiredValue,
  lineIed: (outcome, requiredValue) => calculateTotal(outcome, CATEGORY.IED_PERC) >= requiredValue,
  lineCritDamage: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.CRITDMG_PERC) >= requiredValue,
  lineMeso: (outcome, requiredValue) => calculateTotal(outcome, CATEGORY.MESO_PERC) >= requiredValue,
  lineDrop: (outcome, requiredValue) => calculateTotal(outcome, CATEGORY.DROP_PERC) >= requiredValue,
  lineMesoOrDrop: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.MESO_PERC) +
      calculateTotal(outcome, CATEGORY.DROP_PERC) >=
    requiredValue,
  secCooldown: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.CDR_TIME, true) >= requiredValue,
  lineAutoSteal: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.AUTOSTEAL_PERC) >= requiredValue,
  lineAttOrBoss: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.ATT_PERC) +
      calculateTotal(outcome, CATEGORY.BOSSDMG_PERC) >=
    requiredValue,
  lineAttOrBossOrIed: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.ATT_PERC) +
      calculateTotal(outcome, CATEGORY.BOSSDMG_PERC) +
      calculateTotal(outcome, CATEGORY.IED_PERC) >=
    requiredValue,
  lineBossOrIed: (outcome, requiredValue) =>
    calculateTotal(outcome, CATEGORY.BOSSDMG_PERC) +
      calculateTotal(outcome, CATEGORY.IED_PERC) >=
    requiredValue,
});

function satisfiesTarget(outcome, target) {
  for (const [field, requiredValue] of Object.entries(target)) {
    if (requiredValue > 0 && !OUTCOME_MATCHERS[field](outcome, requiredValue)) {
      return false;
    }
  }
  return true;
}

function getAdjustedRate(currentLine, previousLines, currentPool) {
  const currentCategory = currentLine[0];
  if (previousLines.length === 0) {
    return currentLine[2];
  }

  const previousSpecialLineCounts = {};
  for (const [category] of previousLines) {
    if (isSpecialLine(category)) {
      previousSpecialLineCounts[category] = (previousSpecialLineCounts[category] ?? 0) + 1;
    }
  }

  const removedCategories = [];
  for (const [category, count] of Object.entries(previousSpecialLineCounts)) {
    if (
      count > MAX_CATEGORY_COUNT[category] ||
      (category === currentCategory && count + 1 > MAX_CATEGORY_COUNT[category])
    ) {
      return 0;
    }
    if (count === MAX_CATEGORY_COUNT[category]) {
      removedCategories.push(category);
    }
  }

  let adjustedTotal = 100;
  let hasAdjustment = false;
  for (const [category, , rate] of currentPool) {
    if (removedCategories.includes(category)) {
      adjustedTotal -= rate;
      hasAdjustment = true;
    }
  }

  return hasAdjustment ? (currentLine[2] / adjustedTotal) * 100 : currentLine[2];
}

function calculateOutcomeRate(outcome, rates) {
  const adjustedRates = [
    getAdjustedRate(outcome[0], [], rates.first_line),
    getAdjustedRate(outcome[1], [outcome[0]], rates.second_line),
    getAdjustedRate(outcome[2], [outcome[0], outcome[1]], rates.third_line),
  ];

  return adjustedRates.reduce((chance, rate) => chance * (rate / 100), 100);
}

function convertCubeDataForLevel(cubeData, itemLevel) {
  if (itemLevel < 160) {
    return cubeData;
  }

  const affectedCategories = new Set([
    CATEGORY.STR_PERC,
    CATEGORY.LUK_PERC,
    CATEGORY.DEX_PERC,
    CATEGORY.INT_PERC,
    CATEGORY.ALLSTATS_PERC,
    CATEGORY.ATT_PERC,
    CATEGORY.MATT_PERC,
    CATEGORY.MAXHP_PERC,
  ]);

  return Object.fromEntries(
    Object.entries(cubeData).map(([line, rates]) => [
      line,
      rates.map(([category, value, rate]) => [
        category,
        affectedCategories.has(category) ? value + 1 : value,
        rate,
      ]),
    ]),
  );
}

function getRevealCostConstant(itemLevel) {
  if (itemLevel < 30) {
    return 0;
  }
  if (itemLevel <= 70) {
    return 0.5;
  }
  if (itemLevel <= 120) {
    return 2.5;
  }
  return 20;
}

function getGeometricPercentile(probability, percentile) {
  if (probability <= 0 || probability > 1) {
    throw new Error("Cubing probability must be greater than 0 and at most 100%");
  }
  if (probability === 1) {
    return 1;
  }
  return Math.ceil(Math.log(1 - percentile) / Math.log(1 - probability));
}

export function parseCubingTarget(target) {
  const parsed = { ...EMPTY_TARGET };
  for (const part of String(target ?? "").split("&")) {
    if (!part) {
      continue;
    }
    const [field, rawAmount] = part.split("+");
    if (!Object.hasOwn(parsed, field)) {
      throw new Error(`Unknown cubing target field: ${field}`);
    }
    const amount = Number(rawAmount);
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error(`Invalid cubing target amount for ${field}`);
    }
    parsed[field] += amount;
  }

  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value > 0));
}

export function getCubingStrategyOptions({ itemType, itemLevel, desiredTier }) {
  return getCubingStrategyGroups({ itemType, itemLevel, desiredTier }).flatMap((group) =>
    group.options.map((option) => ({ ...option, group: group.label })),
  );
}

export function getCubingStrategyGroups({ itemType, itemLevel, desiredTier }) {
  const strategyItemType = normalizeStrategyItemType(itemType);
  if (WSE_ITEM_TYPES.has(strategyItemType)) {
    return getWseStrategyGroups({
      itemType: strategyItemType,
      itemLevel,
      desiredTier,
    });
  }

  const baseGroups = CUBING_STRATEGY_GROUPS[strategyItemType] ?? [];
  const shouldIncludeStatStrategies =
    STAT_STRATEGY_ITEM_TYPES.has(strategyItemType) || baseGroups.length === 0;
  const statGroups = shouldIncludeStatStrategies ? getStatStrategyGroups({ itemLevel, desiredTier }) : [];
  return [...statGroups, ...baseGroups];
}

export function getCubeCost(cubeType) {
  const cost = CUBE_COSTS[cubeType];
  if (cost === undefined) {
    throw new Error(`Unknown cube type: ${cubeType}`);
  }
  return cost;
}

export function getRevealCost(itemLevel) {
  return getRevealCostConstant(itemLevel) * itemLevel ** 2;
}

export function getCubingProbability({ cubeType, itemType, itemLevel, desiredTier, target }) {
  const parsedTarget = { ...EMPTY_TARGET, ...parseCubingTarget(target) };
  const cubeData = getCubeData({ cubeType, itemType, itemLevel, desiredTier });
  const usefulCategories = getUsefulCategories(parsedTarget);
  const consolidatedRates = {
    first_line: getConsolidatedRates(cubeData.first_line, usefulCategories),
    second_line: getConsolidatedRates(cubeData.second_line, usefulCategories),
    third_line: getConsolidatedRates(cubeData.third_line, usefulCategories),
  };

  let totalChance = 0;
  for (const firstLine of consolidatedRates.first_line) {
    for (const secondLine of consolidatedRates.second_line) {
      for (const thirdLine of consolidatedRates.third_line) {
        const outcome = [firstLine, secondLine, thirdLine];
        if (satisfiesTarget(outcome, parsedTarget)) {
          totalChance += calculateOutcomeRate(outcome, consolidatedRates);
        }
      }
    }
  }

  return totalChance / 100;
}

export function calculateCubingProfileCosts({
  cubeType,
  itemType,
  itemLevel,
  desiredTier = "legendary",
  target,
  percentile = 0.85,
  cubeSale = false,
}) {
  const numericItemLevel = Number(itemLevel);
  if (!Number.isFinite(numericItemLevel) || numericItemLevel <= 0) {
    throw new Error("Item level must be greater than 0");
  }

  const successProbability = getCubingProbability({
    cubeType,
    itemType,
    itemLevel: numericItemLevel,
    desiredTier,
    target,
  });
  const meanCubes = 1 / successProbability;
  const p85Cubes = getGeometricPercentile(successProbability, percentile);
  const cubeCost = getCubeCost(cubeType) * (cubeSale ? 1 - CUBE_SALE_DISCOUNT : 1);
  const revealCost = getRevealCost(numericItemLevel);
  const costPerCube = cubeCost + revealCost;
  const expectedCost = costPerCube * meanCubes;
  const targetOddsCost = costPerCube * p85Cubes;

  return {
    strategy: target,
    targetPercentile: percentile,
    successProbability,
    meanCubes,
    p85Cubes,
    p95Cubes: p85Cubes,
    cubeSale: Boolean(cubeSale),
    cubeSaleDiscount: cubeSale ? CUBE_SALE_DISCOUNT : 0,
    cubeCost,
    revealCost,
    costPerCube,
    expectedCost,
    p85Cost: targetOddsCost,
    p50Cost: costPerCube * getGeometricPercentile(successProbability, 0.5),
    p75Cost: costPerCube * getGeometricPercentile(successProbability, 0.75),
    p95Cost: targetOddsCost,
  };
}
