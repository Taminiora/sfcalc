import { calculateCubingProfileCosts } from "./cubing.mjs";
import { calculateStarforceProfileCosts } from "./plannerStarforce.mjs";
import { calculateStarforceStatGains, CLASS_STAT } from "./starforceStats.mjs";
import {
  CLASS_STATS,
  getClassStatLabels,
  normalizeClassName,
  normalizeScouterStatLabel,
} from "./statEquivalenceParser.mjs";

const PROFILE_STORAGE_KEY = "sfcalc.enhancementPlanner.profiles.v2";
const STAT_EQUIVALENCE_STORAGE_KEY = "sfcalc.enhancementPlanner.statEquivalence.v2";
const STAT_EQUIVALENCE_PRESET_STORAGE_KEY = "sfcalc.enhancementPlanner.statEquivalencePresets.v1";

const PRESENTED_STAT_RENAMES = Object.freeze({
  DEX: "Main Stat",
  "DEX%": "Main Stat%",
  "Not Affected by % DEX": "Not Affected by % Main Stat",
  STR: "Secondary Stat",
  "STR%": "Secondary Stat%",
  "Not Affected by % STR": "Not Affected by % Secondary Stat",
});

export const DEFAULT_STAT_EQUIVALENCE_CLASS = "wind_archer";

export const DEFAULT_STAT_ROWS = Object.freeze([
  { stat: "Boss Damage", value: 40, finalDamagePercent: 3.725 },
  { stat: "Attack", value: 30, finalDamagePercent: 0.643 },
  { stat: "Attack%", value: 12, finalDamagePercent: 4.203 },
  { stat: "Critical Dmg", value: 8, finalDamagePercent: 2.125 },
  { stat: "Ignore Dff(300)", value: 40, finalDamagePercent: 0.755 },
  { stat: "Ignore Dff(380)", value: 40, finalDamagePercent: 0.962 },
  { stat: "Main Stat", value: 30, finalDamagePercent: 0.243 },
  { stat: "Main Stat%", value: 12, finalDamagePercent: 0.956 },
  { stat: "Not Affected by % Main Stat", value: 200, finalDamagePercent: 0.183 },
  { stat: "Secondary Stat", value: 30, finalDamagePercent: 0.021 },
  { stat: "Secondary Stat%", value: 12, finalDamagePercent: 0.122 },
  { stat: "Not Affected by % Secondary Stat", value: 200, finalDamagePercent: 0.046 },
  { stat: "All Stat%", value: 9, finalDamagePercent: 0.809 },
]);

const DEFAULT_STARFORCE_EVENTS = Object.freeze({
  starCatch: true,
  costReduction30: true,
  boomReduction30: true,
});

const MESO_COST_FIELDS = Object.freeze([
  "p50Cost",
  "p75Cost",
  "p85Cost",
  "p95Cost",
  "expectedMeso",
  "expectedCost",
]);

function createDefaultStarforceProfile({
  id,
  name,
  itemType = "armor",
  itemLevel,
  startStar,
  targetStar,
  spareCount = 10,
  p50Cost,
  p75Cost,
  p95Cost,
  percentileCosts,
  notes = "",
}) {
  const source = {
    itemType,
    itemLevel,
    startStar,
    targetStar,
    hitProbability: 0.85,
    events: DEFAULT_STARFORCE_EVENTS,
  };
  if (spareCount !== undefined) {
    source.spareCount = spareCount;
  }
  if (percentileCosts) {
    source.percentileCosts = percentileCosts;
  }

  return {
    id,
    name,
    type: "starforce",
    statGains: {},
    p50Cost,
    p75Cost,
    p95Cost,
    notes,
    source,
  };
}

function createDefaultCubingProfile({
  id,
  name,
  itemType,
  target,
  targetLabel,
  statGains,
  p50Cost,
  p75Cost,
  p95Cost,
  percentileCosts,
  notes = "",
}) {
  return {
    id,
    name,
    type: "cubing",
    statGains,
    p50Cost,
    p75Cost,
    p95Cost,
    notes,
    source: {
      cubeType: "black",
      itemType,
      itemLevel: 250,
      cubeSale: false,
      desiredTier: "legendary",
      target,
      targetLabel,
      percentileCosts,
    },
  };
}

export const DEFAULT_PROFILE_INPUTS = Object.freeze([
  createDefaultStarforceProfile({
    id: "recommended-sf-18-22-armor-250",
    name: "18★ → 22★ armor (250)",
    itemLevel: 250,
    startStar: 18,
    targetStar: 22,
    p50Cost: 27929470642.62332,
    p75Cost: 27929470642.62332,
    p95Cost: 27929470642.62332,
    percentileCosts: {
      p50Cost: 27929470642.62332,
      p75Cost: 27929470642.62332,
      p95Cost: 27929470642.62332,
      p50Booms: 2,
      p75Booms: 5,
      p95Booms: 12,
      availableSpares: 10,
      requiredSpares: 7,
      achievedProbability: 0.9315757371871694,
      guaranteeMet: true,
      expectedMeso: 27929470642.62332,
      expectedBooms: 3.3952150792320746,
      strategy: [
        { star: 15, nextStar: 16, mode: 1 },
        { star: 16, nextStar: 17, mode: 1 },
        { star: 17, nextStar: 18, mode: 1 },
        { star: 18, nextStar: 19, mode: 1 },
        { star: 19, nextStar: 20, mode: 1 },
        { star: 20, nextStar: 21, mode: 1 },
        { star: 21, nextStar: 22, mode: 1 },
      ],
    },
    notes: "Common pitched-boss catch-up comparison.",
  }),
  createDefaultStarforceProfile({
    id: "recommended-sf-21-22-armor-250",
    name: "21★ → 22★ armor (250)",
    itemLevel: 250,
    startStar: 21,
    targetStar: 22,
    p50Cost: 12167945273.149042,
    p75Cost: 12167945273.149042,
    p95Cost: 12167945273.149042,
    percentileCosts: {
      p50Cost: 12167945273.149042,
      p75Cost: 12167945273.149042,
      p95Cost: 12167945273.149042,
      p50Booms: 0,
      p75Booms: 2,
      p95Booms: 9,
      availableSpares: 10,
      requiredSpares: 4,
      achievedProbability: 0.9659078318417984,
      guaranteeMet: true,
      expectedMeso: 12167945273.149042,
      expectedBooms: 1.6985788156881816,
      strategy: [
        { star: 15, nextStar: 16, mode: 1 },
        { star: 16, nextStar: 17, mode: 1 },
        { star: 17, nextStar: 18, mode: 1 },
        { star: 18, nextStar: 19, mode: 1 },
        { star: 19, nextStar: 20, mode: 1 },
        { star: 20, nextStar: 21, mode: 1 },
        { star: 21, nextStar: 22, mode: 1 },
      ],
    },
    notes: "Baseline full-SG 21 to 22 comparison.",
  }),
  createDefaultStarforceProfile({
    id: "recommended-sf-22-23-accessory-160",
    name: "22★ → 23★ accessory (160, 10 spares)",
    itemType: "accessory",
    itemLevel: 160,
    startStar: 22,
    targetStar: 23,
    p50Cost: 9940980399.167988,
    p75Cost: 9940980399.167988,
    p95Cost: 9940980399.167988,
    percentileCosts: {
      p50Cost: 9940980399.167988,
      p75Cost: 9940980399.167988,
      p95Cost: 9940980399.167988,
      p50Booms: 1,
      p75Booms: 6,
      p95Booms: 19,
      availableSpares: 10,
      requiredSpares: 10,
      achievedProbability: 0.8517814579525262,
      guaranteeMet: true,
      expectedMeso: 9940980399.167988,
      expectedBooms: 4.39850052694832,
      strategy: [
        { star: 15, nextStar: 16, mode: 2 },
        { star: 16, nextStar: 17, mode: 2 },
        { star: 17, nextStar: 18, mode: 2 },
        { star: 18, nextStar: 19, mode: 1 },
        { star: 19, nextStar: 20, mode: 1 },
        { star: 20, nextStar: 21, mode: 2 },
        { star: 21, nextStar: 22, mode: 1 },
        { star: 22, nextStar: 23, mode: "Base" },
      ],
    },
  }),
  createDefaultStarforceProfile({
    id: "recommended-sf-22-23-armor-200",
    name: "22★ → 23★ armor (200)",
    itemLevel: 200,
    startStar: 22,
    targetStar: 23,
    p50Cost: 19415877852.824482,
    p75Cost: 19415877852.824482,
    p95Cost: 19415877852.824482,
    percentileCosts: {
      p50Cost: 19415877852.824482,
      p75Cost: 19415877852.824482,
      p95Cost: 19415877852.824482,
      p50Booms: 1,
      p75Booms: 6,
      p95Booms: 19,
      availableSpares: 10,
      requiredSpares: 10,
      achievedProbability: 0.8517814579525262,
      guaranteeMet: true,
      expectedMeso: 19415877852.824482,
      expectedBooms: 4.39850052694832,
      strategy: [
        { star: 15, nextStar: 16, mode: 2 },
        { star: 16, nextStar: 17, mode: 2 },
        { star: 17, nextStar: 18, mode: 2 },
        { star: 18, nextStar: 19, mode: 1 },
        { star: 19, nextStar: 20, mode: 1 },
        { star: 20, nextStar: 21, mode: 2 },
        { star: 21, nextStar: 22, mode: 1 },
        { star: 22, nextStar: 23, mode: "Base" },
      ],
    },
  }),
  createDefaultStarforceProfile({
    id: "recommended-sf-22-23-armor-250",
    name: "22★ → 23★ armor (250)",
    itemLevel: 250,
    startStar: 22,
    targetStar: 23,
    p50Cost: 37921547764.26454,
    p75Cost: 37921547764.26454,
    p95Cost: 37921547764.26454,
    percentileCosts: {
      p50Cost: 37921547764.26454,
      p75Cost: 37921547764.26454,
      p95Cost: 37921547764.26454,
      p50Booms: 1,
      p75Booms: 6,
      p95Booms: 19,
      availableSpares: 10,
      requiredSpares: 10,
      achievedProbability: 0.8517814579525262,
      guaranteeMet: true,
      expectedMeso: 37921547764.26454,
      expectedBooms: 4.39850052694832,
      strategy: [
        { star: 15, nextStar: 16, mode: 2 },
        { star: 16, nextStar: 17, mode: 2 },
        { star: 17, nextStar: 18, mode: 2 },
        { star: 18, nextStar: 19, mode: 1 },
        { star: 19, nextStar: 20, mode: 1 },
        { star: 20, nextStar: 21, mode: 2 },
        { star: 21, nextStar: 22, mode: 1 },
        { star: 22, nextStar: 23, mode: "Base" },
      ],
    },
  }),
  createDefaultStarforceProfile({
    id: "recommended-sf-23-24-armor-250",
    name: "23★ → 24★ armor (250)",
    itemLevel: 250,
    startStar: 23,
    targetStar: 24,
    p50Cost: 373548836083.6242,
    p75Cost: 373548836083.6242,
    p95Cost: 373548836083.6242,
    percentileCosts: {
      p50Cost: 373548836083.6242,
      p75Cost: 373548836083.6242,
      p95Cost: 373548836083.6242,
      p50Booms: 2,
      p75Booms: 7,
      p95Booms: 18,
      availableSpares: 10,
      requiredSpares: 10,
      achievedProbability: 0.8505271185311204,
      guaranteeMet: true,
      expectedMeso: 373548836083.6242,
      expectedBooms: 4.6888828898093555,
      strategy: [
        { star: 15, nextStar: 16, mode: 4 },
        { star: 16, nextStar: 17, mode: 4 },
        { star: 17, nextStar: 18, mode: 4 },
        { star: 18, nextStar: 19, mode: 3 },
        { star: 19, nextStar: 20, mode: 3 },
        { star: 20, nextStar: 21, mode: 4 },
        { star: 21, nextStar: 22, mode: 4 },
        { star: 22, nextStar: 23, mode: "Base" },
        { star: 23, nextStar: 24, mode: "Base" },
      ],
    },
  }),
  createDefaultStarforceProfile({
    id: "recommended-sf-24-25-armor-250",
    name: "24★ → 25★ armor (250)",
    itemLevel: 250,
    startStar: 24,
    targetStar: 25,
    p50Cost: 1544036668246.853,
    p75Cost: 1544036668246.853,
    p95Cost: 1544036668246.853,
    percentileCosts: {
      p50Cost: 1544036668246.853,
      p75Cost: 1544036668246.853,
      p95Cost: 1544036668246.853,
      p50Booms: 4,
      p75Booms: 14,
      p95Booms: 38,
      availableSpares: 10,
      requiredSpares: 22,
      achievedProbability: 0.6817129248432829,
      guaranteeMet: false,
      expectedMeso: 1544036668246.853,
      expectedBooms: 9.54398646654429,
      strategy: [
        { star: 15, nextStar: 16, mode: 1 },
        { star: 16, nextStar: 17, mode: 1 },
        { star: 17, nextStar: 18, mode: 4 },
        { star: 18, nextStar: 19, mode: 4 },
        { star: 19, nextStar: 20, mode: 4 },
        { star: 20, nextStar: 21, mode: 4 },
        { star: 21, nextStar: 22, mode: 4 },
        { star: 22, nextStar: 23, mode: "Base" },
        { star: 23, nextStar: 24, mode: "Base" },
        { star: 24, nextStar: 25, mode: "Base" },
      ],
    },
  }),
  createDefaultCubingProfile({
    id: "recommended-cube-emblem-double-prime-attack",
    name: "Emblem: 33% → double-prime attack",
    itemType: "emblem",
    target: "percAtt+36",
    targetLabel: "36%+ Attack/Magic Attack",
    statGains: { "Attack%": 3 },
    p50Cost: 276930750000,
    p75Cost: 553861500000,
    p95Cost: 757950000000,
    percentileCosts: {
      p50Cost: 276930750000,
      p75Cost: 553861500000,
      p95Cost: 757950000000,
      p85Cost: 757950000000,
      p85Cubes: 32600,
      p95Cubes: 32600,
      meanCubes: 17183.96203901819,
      expectedCost: 399527117407.173,
      strategy: "percAtt+36",
      probability: 0.00004005498764838471,
      cubeCost: 22000000,
      revealCost: 1250000,
    },
  }),
  createDefaultCubingProfile({
    id: "recommended-cube-secondary-double-prime-attack",
    name: "Secondary: 33% → double-prime attack",
    itemType: "secondary",
    target: "percAtt+36",
    targetLabel: "36%+ Attack/Magic Attack",
    statGains: { "Attack%": 3 },
    p50Cost: 637724250000,
    p75Cost: 1275448500000,
    p95Cost: 1745400750000,
    percentileCosts: {
      p50Cost: 637724250000,
      p75Cost: 1275448500000,
      p95Cost: 1745400750000,
      p85Cost: 1745400750000,
      p85Cubes: 75071,
      p95Cubes: 75071,
      meanCubes: 39571.48362950729,
      expectedCost: 920036994386.0444,
      strategy: "percAtt+36",
      probability: 0.000017397021003378766,
      cubeCost: 22000000,
      revealCost: 1250000,
    },
  }),
  createDefaultCubingProfile({
    id: "recommended-cube-weapon-23-40",
    name: "Weapon: 33% attack → 23/40",
    itemType: "weapon",
    target: "percAtt+23&percBoss+40",
    targetLabel: "23%+ Attack/Magic Attack and 40%+ Boss",
    statGains: { "Attack%": -10, "Boss Damage": 40 },
    p50Cost: 201833250000,
    p75Cost: 403666500000,
    p95Cost: 552396750000,
    percentileCosts: {
      p50Cost: 201833250000,
      p75Cost: 403666500000,
      p95Cost: 552396750000,
      p85Cost: 552396750000,
      p85Cubes: 23759,
      p95Cubes: 23759,
      meanCubes: 12523.941934357577,
      expectedCost: 291181649973.81366,
      strategy: "percAtt+23&percBoss+40",
      probability: 0.00005495827071528976,
      cubeCost: 22000000,
      revealCost: 1250000,
    },
  }),
  createDefaultCubingProfile({
    id: "recommended-cube-gloves-triple-crit",
    name: "Gloves: 2L crit+stat → 3L crit",
    itemType: "gloves",
    target: "lineCritDamage+3",
    targetLabel: "3L Crit Damage",
    statGains: { "Critical Dmg": 8, "Main Stat%": -12 },
    p50Cost: 1611573750000,
    p75Cost: 3223124250000,
    p95Cost: 4410804000000,
    percentileCosts: {
      p50Cost: 1611573750000,
      p75Cost: 3223124250000,
      p95Cost: 4410804000000,
      p85Cost: 4410804000000,
      p85Cubes: 189712,
      p95Cubes: 189712,
      meanCubes: 99999.99999999999,
      expectedCost: 2324999999999.9995,
      strategy: "lineCritDamage+3",
      probability: 0.000006883508244732129,
      cubeCost: 22000000,
      revealCost: 1250000,
    },
  }),
  createDefaultCubingProfile({
    id: "recommended-cube-hat-minus-4-stat",
    name: "Hat: -4s cooldown + stat",
    itemType: "hat",
    target: "secCooldown+4&lineStat+1",
    targetLabel: "-4s Cooldown + stat",
    statGains: { "Main Stat%": 12 },
    p50Cost: 150753000000,
    p75Cost: 301482750000,
    p95Cost: 412571250000,
    percentileCosts: {
      p50Cost: 150753000000,
      p75Cost: 301482750000,
      p95Cost: 412571250000,
      p85Cost: 412571250000,
      p85Cubes: 17745,
      p95Cubes: 17745,
      meanCubes: 9353.694454601527,
      expectedCost: 217473396069.4855,
      strategy: "secCooldown+4&lineStat+1",
      probability: 0.00007355640076306622,
      cubeCost: 22000000,
      revealCost: 1250000,
    },
    notes: "Cooldown FD is not included; edit stat changes if your class values CDR.",
  }),
  createDefaultCubingProfile({
    id: "recommended-cube-armor-double-prime-stat",
    name: "Armor: 3L stat → double-prime stat",
    itemType: "top",
    target: "percStat+36",
    targetLabel: "36%+ main stat",
    statGains: { "Main Stat%": 3 },
    p50Cost: 70005750000,
    p75Cost: 140011500000,
    p95Cost: 191603250000,
    percentileCosts: {
      p50Cost: 70005750000,
      p75Cost: 140011500000,
      p95Cost: 191603250000,
      p85Cost: 191603250000,
      p85Cubes: 8241,
      p95Cubes: 8241,
      meanCubes: 4344.398588503615,
      expectedCost: 101007267182.70906,
      strategy: "percStat+36",
      probability: 0.00015866553314069468,
      cubeCost: 22000000,
      revealCost: 1250000,
    },
  }),
]);

const DEFAULT_PROFILE_REPLACEMENTS = Object.freeze({
  "recommended-sf-22-23-armor-160": "recommended-sf-22-23-accessory-160",
});

let recommendedProfilesCache = null;

function validateDefaultStatEquivalenceInput() {
  return validateStatEquivalenceInput({ className: DEFAULT_STAT_EQUIVALENCE_CLASS });
}

function cloneProfile(profile) {
  return JSON.parse(JSON.stringify(profile));
}

function getPresentedStatName(stat) {
  return PRESENTED_STAT_RENAMES[stat] ?? stat;
}

function parseNumber(value, label) {
  const number = typeof value === "string" ? Number(value.replace(/,/g, "").trim()) : Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return number;
}

function parseSignedNumber(value, label) {
  const number = typeof value === "string" ? Number(value.replace(/,/g, "").trim()) : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a number`);
  }
  return number;
}

function parsePositiveNumber(value, label) {
  const number = parseNumber(value, label);
  if (number <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return number;
}

function getAdditionalMesoCost(source) {
  return parseNumber(source?.additionalMesoCost ?? 0, "additional meso cost");
}

export function applyAdditionalMesoCost(costs, additionalMesoCost = 0) {
  const additional = parseNumber(additionalMesoCost ?? 0, "additional meso cost");
  return Object.fromEntries(
    Object.entries(costs).map(([key, value]) => [
      key,
      MESO_COST_FIELDS.includes(key) && Number.isFinite(Number(value))
        ? Number(value) + additional
        : value,
    ]),
  );
}

function getId(input, prefix = "profile") {
  if (input.id) {
    return String(input.id);
  }

  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredJson(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing and quota failures should not break calculator use.
  }
}

function readStoredRaw(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function validateStatRow(input, className) {
  const rawStat = String(input.stat ?? "").trim();
  const stat = className
    ? normalizeScouterStatLabel(rawStat, className)
    : getPresentedStatName(rawStat);
  if (!stat) {
    throw new Error("Stat name is required");
  }

  return {
    stat,
    value: parsePositiveNumber(input.value, `${stat} value`),
    finalDamagePercent: parseNumber(input.finalDamagePercent, `${stat} final damage`),
  };
}

function getPresentedStatGainName(rawStat, className = "") {
  const stat = String(rawStat).trim();
  if (!className) {
    return getPresentedStatName(stat);
  }

  return normalizeScouterStatLabel(stat, className);
}

function validateStatGains(input = {}, className = "") {
  const validated = {};
  for (const [rawStat, rawValue] of Object.entries(input)) {
    const stat = getPresentedStatGainName(rawStat, className);
    const value = parseSignedNumber(rawValue, `${stat} change`);
    if (stat && value !== 0) {
      validated[stat] = (validated[stat] ?? 0) + value;
    }
  }
  return Object.fromEntries(Object.entries(validated).filter(([, value]) => value !== 0));
}

function hasStarforceStatSource(source) {
  return (
    source &&
    source.itemType &&
    Number.isFinite(Number(source.itemLevel)) &&
    Number.isInteger(Number(source.startStar)) &&
    Number.isInteger(Number(source.targetStar))
  );
}

export function combineStatGains(...gainSets) {
  const combined = {};
  for (const gains of gainSets) {
    for (const [stat, value] of Object.entries(validateStatGains(gains))) {
      combined[stat] = (combined[stat] ?? 0) + value;
    }
  }
  return combined;
}

function getFdPerUnitByStat(statEquivalence) {
  return new Map(
    validateStatEquivalenceInput(statEquivalence).rows.map((row) => [
      row.stat,
      row.finalDamagePercent / row.value,
    ]),
  );
}

function getClassStatAlias(fdPerUnitByStat) {
  return ["Main Stat", "DEX", "STR", "LUK", "INT"].find((stat) =>
    fdPerUnitByStat.has(stat),
  );
}

function getClassStatRoleKeys(statEquivalence, fdPerUnitByStat, classStatAlias) {
  const classStatKeys = getClassStatLabels(statEquivalence.className).filter((stat) =>
    fdPerUnitByStat.has(stat),
  );
  if (classStatKeys.length > 0) {
    return classStatKeys;
  }

  return [classStatAlias ?? CLASS_STAT];
}

function getClassStatDisplayKeys(statEquivalence) {
  return getClassStatLabels(statEquivalence.className).length > 0
    ? getClassStatLabels(statEquivalence.className)
    : [CLASS_STAT];
}

function getStatDisplayLabel(stat, statEquivalence) {
  const statType = CLASS_STATS[normalizeClassName(statEquivalence.className)];
  if (statType === "int") {
    if (stat === "Attack") {
      return "M.Attack";
    }
    if (stat === "Attack%") {
      return "M.Attack%";
    }
  }
  return stat;
}

function getValuedStatKeys(stat, statEquivalence, fdPerUnitByStat, classStatAlias) {
  return stat === CLASS_STAT && !fdPerUnitByStat.has(CLASS_STAT)
    ? getClassStatRoleKeys(statEquivalence, fdPerUnitByStat, classStatAlias)
    : [stat];
}

function addBreakdownValue(
  rowsByStat,
  stat,
  field,
  value,
  statEquivalence,
  fdPerUnitByStat,
  classStatAlias,
) {
  if (value === 0) {
    return;
  }

  for (const valuedStat of getValuedStatKeys(
    stat,
    statEquivalence,
    fdPerUnitByStat,
    classStatAlias,
  )) {
    const displayLabel = getStatDisplayLabel(valuedStat, statEquivalence);
    const row = rowsByStat.get(valuedStat) ?? {
      stat: valuedStat,
      label: displayLabel,
      automatic: 0,
      manual: 0,
      net: 0,
      fdGain: 0,
      usesClassStatAlias: false,
    };
    row[field] += value;
    row.usesClassStatAlias ||= stat === CLASS_STAT && valuedStat !== stat;
    row.label = row.usesClassStatAlias ? `${displayLabel} (Class Stat)` : displayLabel;
    rowsByStat.set(valuedStat, row);
  }
}

function getStatSortIndex(statEquivalence) {
  const rows = validateStatEquivalenceInput(statEquivalence).rows;
  return new Map(rows.map((row, index) => [row.stat, index]));
}

export function validateStatEquivalenceInput(input = {}) {
  const rawRows = Array.isArray(input.rows) ? input.rows : DEFAULT_STAT_ROWS;
  const className = normalizeClassName(input.className);
  if (className && !CLASS_STATS[className]) {
    throw new Error(`Unknown class: "${input.className}"`);
  }

  return {
    ...(className ? { className } : {}),
    rows: rawRows.map((row) => validateStatRow(row, className)),
  };
}

export function validateProfileInput(input) {
  const name = String(input.name ?? "").trim();
  if (!name) {
    throw new Error("Name is required");
  }

  return {
    id: getId(input),
    name,
    type: String(input.type ?? "starforce").trim() || "starforce",
    statGains: validateStatGains(input.statGains),
    p50Cost: parsePositiveNumber(input.p50Cost, "p50 cost"),
    p75Cost: parsePositiveNumber(input.p75Cost, "p75 cost"),
    p95Cost: parsePositiveNumber(input.p95Cost, "p95 cost"),
    notes: String(input.notes ?? "").trim(),
    source: input.source ? { ...input.source } : null,
  };
}

export function validateStatEquivalencePresetInput(input) {
  const name = String(input.name ?? "").trim();
  if (!name) {
    throw new Error("Preset name is required");
  }
  const statEquivalence = validateStatEquivalenceInput(input.statEquivalence ?? input);

  return {
    id: getId(input, "stat-equivalence-preset"),
    name,
    ...statEquivalence,
  };
}

export function calculateFdGain(statGains, statEquivalence) {
  const validStatGains = validateStatGains(statGains, statEquivalence.className);
  const fdPerUnitByStat = getFdPerUnitByStat(statEquivalence);
  const classStatAlias = getClassStatAlias(fdPerUnitByStat);

  return Object.entries(validStatGains).reduce((sum, [stat, value]) => {
    const statKeys = getValuedStatKeys(stat, statEquivalence, fdPerUnitByStat, classStatAlias);
    return sum + statKeys.reduce(
      (statSum, statKey) => statSum + value * (fdPerUnitByStat.get(statKey) ?? 0),
      0,
    );
  }, 0);
}

export function expandClassStatGains(statGains, statEquivalence) {
  const expanded = {};
  for (const [stat, value] of Object.entries(validateStatGains(statGains, statEquivalence.className))) {
    const displayStats = stat === CLASS_STAT
      ? getClassStatDisplayKeys(statEquivalence)
      : [getStatDisplayLabel(stat, statEquivalence)];
    for (const displayStat of displayStats) {
      expanded[displayStat] = (expanded[displayStat] ?? 0) + value;
    }
  }
  return expanded;
}

export function calculateStarforceFdBreakdown(input, statEquivalence) {
  const source = input.source ?? input;
  const automaticGains = hasStarforceStatSource(source)
    ? calculateStarforceStatGains(source)
    : {};
  const manualGains = validateStatGains(input.statGains, statEquivalence.className);
  const fdPerUnitByStat = getFdPerUnitByStat(statEquivalence);
  const classStatAlias = getClassStatAlias(fdPerUnitByStat);
  const rowsByStat = new Map();

  for (const [stat, value] of Object.entries(automaticGains)) {
    addBreakdownValue(
      rowsByStat,
      stat,
      "automatic",
      value,
      statEquivalence,
      fdPerUnitByStat,
      classStatAlias,
    );
  }
  for (const [stat, value] of Object.entries(manualGains)) {
    addBreakdownValue(
      rowsByStat,
      stat,
      "manual",
      value,
      statEquivalence,
      fdPerUnitByStat,
      classStatAlias,
    );
  }

  const sortIndex = getStatSortIndex(statEquivalence);
  return [...rowsByStat.values()]
    .map((row) => {
      const net = row.automatic + row.manual;
      return {
        ...row,
        net,
        fdGain: net * (fdPerUnitByStat.get(row.stat) ?? 0),
      };
    })
    .filter((row) => row.automatic !== 0 || row.manual !== 0 || row.net !== 0)
    .sort(
      (left, right) =>
        (sortIndex.get(left.stat) ?? Number.MAX_SAFE_INTEGER) -
          (sortIndex.get(right.stat) ?? Number.MAX_SAFE_INTEGER) ||
        left.stat.localeCompare(right.stat),
    );
}

export function calculateStarforceFdGain(input, statEquivalence) {
  return calculateStarforceFdBreakdown(input, statEquivalence).reduce(
    (sum, row) => sum + row.fdGain,
    0,
  );
}

export function deriveProfileMetrics(profile, statEquivalence) {
  const validProfile = validateProfileInput(profile);
  const fdGain =
    validProfile.type === "starforce"
      ? calculateStarforceFdGain(validProfile, statEquivalence)
      : calculateFdGain(validProfile.statGains, statEquivalence);

  return {
    ...validProfile,
    fdGain,
    fdPerMesoP50: fdGain / validProfile.p50Cost,
    fdPerMesoP75: fdGain / validProfile.p75Cost,
    fdPerMesoP95: fdGain / validProfile.p95Cost,
  };
}

function hasStarforceCostSource(source) {
  return (
    source &&
    Number.isFinite(Number(source.itemLevel)) &&
    Number.isInteger(Number(source.startStar)) &&
    Number.isInteger(Number(source.targetStar)) &&
    Number.isFinite(Number(source.hitProbability))
  );
}

function hasCubingCostSource(source) {
  return (
    source &&
    source.cubeType &&
    source.itemType &&
    Number.isFinite(Number(source.itemLevel)) &&
    source.desiredTier &&
    source.target
  );
}

export function refreshStarforceProfileCosts(profiles) {
  return profiles.map((profile) => {
    const validProfile = validateProfileInput(profile);
    if (validProfile.type === "cubing" && hasCubingCostSource(validProfile.source)) {
      const additionalMesoCost = getAdditionalMesoCost(validProfile.source);
      const costs = applyAdditionalMesoCost(
        calculateCubingProfileCosts({
          cubeType: validProfile.source.cubeType,
          itemType: validProfile.source.itemType,
          itemLevel: Number(validProfile.source.itemLevel),
          cubeSale: Boolean(validProfile.source.cubeSale),
          desiredTier: validProfile.source.desiredTier,
          target: validProfile.source.target,
        }),
        additionalMesoCost,
      );

      return validateProfileInput({
        ...validProfile,
        p50Cost: costs.p50Cost,
        p75Cost: costs.p75Cost,
        p95Cost: costs.p95Cost,
        source: {
          ...validProfile.source,
          additionalMesoCost,
          percentileCosts: costs,
        },
      });
    }

    if (validProfile.type !== "starforce" || !hasStarforceCostSource(validProfile.source)) {
      return validProfile;
    }

    const additionalMesoCost = getAdditionalMesoCost(validProfile.source);
    const costs = applyAdditionalMesoCost(
      calculateStarforceProfileCosts({
        itemLevel: Number(validProfile.source.itemLevel),
        startStar: Number(validProfile.source.startStar),
        targetStar: Number(validProfile.source.targetStar),
        spareCount:
          validProfile.source.spareCount === undefined
            ? undefined
            : Number(validProfile.source.spareCount),
        hitProbability: Number(validProfile.source.hitProbability),
        events: validProfile.source.events ?? {},
      }),
      additionalMesoCost,
    );

    return validateProfileInput({
      ...validProfile,
      p50Cost: costs.p50Cost,
      p75Cost: costs.p75Cost,
      p95Cost: costs.p95Cost,
      source: {
        ...validProfile.source,
        additionalMesoCost,
        percentileCosts: costs,
      },
    });
  });
}

function getDefaultProfiles() {
  recommendedProfilesCache ??= DEFAULT_PROFILE_INPUTS.map(validateProfileInput);
  return recommendedProfilesCache.map(cloneProfile);
}

export function getRecommendedProfiles() {
  return getDefaultProfiles();
}

function migrateProfileInput(profile) {
  const replacementId = DEFAULT_PROFILE_REPLACEMENTS[profile?.id];
  if (!replacementId) {
    return profile;
  }

  return DEFAULT_PROFILE_INPUTS.find((candidate) => candidate.id === replacementId) ?? profile;
}

export function loadStatEquivalence(storage = getDefaultStorage()) {
  const parsed = readStoredJson(storage, STAT_EQUIVALENCE_STORAGE_KEY, null);
  if (!parsed) {
    return validateDefaultStatEquivalenceInput();
  }

  try {
    return validateStatEquivalenceInput(parsed);
  } catch {
    return validateDefaultStatEquivalenceInput();
  }
}

export function saveStatEquivalence(storage = getDefaultStorage(), statEquivalence) {
  writeStoredJson(
    storage,
    STAT_EQUIVALENCE_STORAGE_KEY,
    validateStatEquivalenceInput(statEquivalence),
  );
}

export function loadStatEquivalencePresets(storage = getDefaultStorage()) {
  const parsed = readStoredJson(storage, STAT_EQUIVALENCE_PRESET_STORAGE_KEY, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((preset) => {
    try {
      return [validateStatEquivalencePresetInput(preset)];
    } catch {
      return [];
    }
  });
}

export function saveStatEquivalencePresets(storage = getDefaultStorage(), presets) {
  writeStoredJson(
    storage,
    STAT_EQUIVALENCE_PRESET_STORAGE_KEY,
    presets.map(validateStatEquivalencePresetInput),
  );
}

export function loadProfiles(storage = getDefaultStorage()) {
  const raw = readStoredRaw(storage, PROFILE_STORAGE_KEY);
  if (raw === null) {
    return getDefaultProfiles();
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((profile) => {
    try {
      return [validateProfileInput(migrateProfileInput(profile))];
    } catch {
      return [];
    }
  });
}

export function saveProfiles(storage = getDefaultStorage(), profiles) {
  writeStoredJson(storage, PROFILE_STORAGE_KEY, profiles.map(validateProfileInput));
}
