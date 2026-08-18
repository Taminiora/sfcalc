import { calculateCubingProfileCosts } from "./cubing.mjs";
import {
  ASTRA_REPLACEMENT_COST as ASTRA_SECONDARY_REPLACEMENT_COST,
  calculateAstraStarforceProfileCosts,
} from "./astraStarforce.mjs";
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
const PROFILE_PRESET_STORAGE_KEY = "sfcalc.enhancementPlanner.profilePresets.v1";

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
  isAstraSecondary = false,
  statGains = {},
  p50Cost,
  p75Cost,
  p95Cost,
  percentileCosts,
  notes = "",
}) {
  const effectiveSpareCount = isAstraSecondary ? undefined : spareCount;
  const source = {
    itemType,
    itemLevel,
    startStar,
    targetStar,
    hitProbability: 0.85,
    events: DEFAULT_STARFORCE_EVENTS,
  };
  if (isAstraSecondary) {
    source.isAstraSecondary = true;
  }
  if (effectiveSpareCount !== undefined) {
    source.spareCount = effectiveSpareCount;
  }
  if (percentileCosts) {
    source.percentileCosts = percentileCosts;
  }

  return {
    id,
    name,
    type: "starforce",
    statGains,
    p50Cost,
    p75Cost,
    p95Cost,
    notes,
    source,
  };
}

const STRATEGY_STARS = Object.freeze([15, 16, 17, 18, 19, 20, 21]);
const DEFAULT_DP_STAT_LINES = 3;
const DEFAULT_DP_ATTACK_LINES = 3;

function getCostInMeso(costB) {
  return Number(costB) * 1_000_000_000;
}

function getStarforceStrategyRows(strategy = "111/11/11", targetStar = 22) {
  const modes = String(strategy).replace(/\//g, "").split("");
  const rows = STRATEGY_STARS.map((star, index) => ({
    star,
    nextStar: star + 1,
    mode: modes[index] ?? "1",
  }));
  for (let star = 22; star < targetStar; star += 1) {
    rows.push({ star, nextStar: star + 1, mode: "Base" });
  }
  return rows;
}

function createPresetStarforceProfile({
  id,
  name,
  itemType = "armor",
  itemLevel,
  startStar,
  targetStar,
  spareCount = 10,
  isAstraSecondary = false,
  costB,
  expectedBooms = 0,
  achievedProbability = 0.85,
  guaranteeMet = true,
  requiredSpares,
  strategy = "111/11/11",
  notes = "",
}) {
  const cost = getCostInMeso(costB);
  const effectiveSpareCount = isAstraSecondary ? undefined : spareCount;
  const effectiveRequiredSpares = requiredSpares ?? effectiveSpareCount ?? Math.ceil(expectedBooms);
  return createDefaultStarforceProfile({
    id,
    name,
    itemType,
    itemLevel,
    startStar,
    targetStar,
    spareCount: effectiveSpareCount,
    isAstraSecondary,
    p50Cost: cost,
    p75Cost: cost,
    p95Cost: cost,
    percentileCosts: {
      p50Cost: cost,
      p75Cost: cost,
      p85Cost: cost,
      p95Cost: cost,
      p50Booms: Math.floor(expectedBooms),
      p75Booms: Math.ceil(expectedBooms),
      p95Booms: Math.ceil(expectedBooms * 2),
      availableSpares: effectiveSpareCount ?? null,
      requiredSpares: effectiveRequiredSpares,
      requiredBooms: effectiveRequiredSpares,
      achievedProbability,
      guaranteeMet,
      expectedMeso: cost,
      expectedTotalCost: cost,
      expectedBooms,
      strategy: getStarforceStrategyRows(strategy, targetStar),
    },
    notes,
  });
}

function createPresetCubingProfile({
  id,
  name,
  itemType,
  itemLevel = 250,
  target,
  targetLabel,
  statGains,
  costB,
  notes = "",
}) {
  const cost = getCostInMeso(costB);
  return createDefaultCubingProfile({
    id,
    name,
    itemType,
    itemLevel,
    target,
    targetLabel,
    statGains,
    p50Cost: cost,
    p75Cost: cost,
    p95Cost: cost,
    percentileCosts: {
      p50Cost: cost,
      p75Cost: cost,
      p85Cost: cost,
      p95Cost: cost,
      p85Cubes: Math.round(cost / 23_250_000),
      p95Cubes: Math.round(cost / 23_250_000),
      meanCubes: cost / 23_250_000,
      expectedCost: cost,
      strategy: target,
      probability: 0,
      cubeCost: 22_000_000,
      revealCost: 1_250_000,
    },
    notes,
  });
}

function createDefaultCubingProfile({
  id,
  name,
  itemType,
  itemLevel = 250,
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
      itemLevel,
      cubeSale: false,
      desiredTier: "legendary",
      target,
      targetLabel,
      percentileCosts,
    },
  };
}

export const DEFAULT_PROFILE_INPUTS = Object.freeze([
  createPresetStarforceProfile({
    id: "recommended-sf-astra-22-23",
    name: "Astra 22★ → 23★",
    itemType: "secondary",
    itemLevel: 200,
    startStar: 22,
    targetStar: 23,
    isAstraSecondary: true,
    costB: 23,
    expectedBooms: 5.05,
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-22-23-pitched-160",
    name: "22★ → 23★ Pitched lv160",
    itemType: "accessory",
    itemLevel: 160,
    startStar: 22,
    targetStar: 23,
    spareCount: 0,
    costB: 38.80376718165785,
    expectedBooms: 1.0698412698412698,
    achievedProbability: 0.4831288343558282,
    guaranteeMet: false,
    requiredSpares: 2,
    strategy: "444/44/44",
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-22-23-kalos-eternal-250-1114",
    name: "22★ → 23★ Kalos Eternals (10 spares)",
    itemLevel: 250,
    startStar: 22,
    targetStar: 23,
    costB: 56,
    expectedBooms: 4.39850052694832,
    achievedProbability: 0.8517814579525262,
    requiredSpares: 10,
    strategy: "222/11/21",
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-22-23-limbo-eternal-250-1144",
    name: "22★ → 23★ Limbo Eternals (5 spares)",
    itemLevel: 250,
    startStar: 22,
    targetStar: 23,
    spareCount: 5,
    costB: 60,
    expectedBooms: 2.342788017799678,
    achievedProbability: 0.8511966258708026,
    requiredSpares: 5,
    strategy: "222/11/44",
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-astra-23-24",
    name: "Astra 23★ → 24★",
    itemType: "secondary",
    itemLevel: 200,
    startStar: 23,
    targetStar: 24,
    isAstraSecondary: true,
    costB: 68,
    expectedBooms: 15.38,
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-22-23-pitched-200",
    name: "22★ → 23★ Pitched lv200",
    itemType: "accessory",
    itemLevel: 200,
    startStar: 22,
    targetStar: 23,
    spareCount: 0,
    costB: 75.78838853514739,
    expectedBooms: 1.0698412698412698,
    achievedProbability: 0.4831288343558282,
    guaranteeMet: false,
    requiredSpares: 2,
    strategy: "444/44/44",
  }),
  createPresetCubingProfile({
    id: "recommended-cube-real-dp-heart",
    name: "Real DP heart",
    itemType: "heart",
    itemLevel: 200,
    target: "percStat+36",
    targetLabel: "36%+ main stat",
    statGains: { "Main Stat%": DEFAULT_DP_STAT_LINES },
    costB: 31,
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-astra-24-25",
    name: "Astra 24★ → 25★",
    itemType: "secondary",
    itemLevel: 200,
    startStar: 24,
    targetStar: 25,
    isAstraSecondary: true,
    costB: 190,
    expectedBooms: 41.6,
  }),
  createPresetCubingProfile({
    id: "recommended-cube-emblem-double-prime-attack",
    name: "DP emblem",
    itemType: "emblem",
    itemLevel: 200,
    target: "percAtt+36",
    targetLabel: "36%+ Attack/Magic Attack",
    statGains: { "Attack%": DEFAULT_DP_ATTACK_LINES },
    costB: 400,
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-23-24-kalos-eternal-250-1114",
    name: "23★ → 24★ Kalos Eternals (10 spares)",
    itemLevel: 250,
    startStar: 23,
    targetStar: 24,
    costB: 217,
    expectedBooms: 4.6888828898093555,
    achievedProbability: 0.8505271185311204,
    requiredSpares: 10,
    strategy: "444/33/44",
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-23-24-pitched-160-0-spares",
    name: "23★ → 24★ Pitched lv160",
    itemType: "accessory",
    itemLevel: 160,
    startStar: 23,
    targetStar: 24,
    spareCount: 0,
    costB: 110.74566861414293,
    expectedBooms: 3.5285865457294023,
    achievedProbability: 0.36971830985915494,
    guaranteeMet: false,
    requiredSpares: 8,
    strategy: "444/44/44",
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-23-24-limbo-eternal-250-1144",
    name: "23★ → 24★ Limbo Eternals (5 spares)",
    itemLevel: 250,
    startStar: 23,
    targetStar: 24,
    spareCount: 5,
    costB: 245,
    expectedBooms: 3.5285865457294023,
    achievedProbability: 0.7643588444794145,
    guaranteeMet: false,
    requiredSpares: 8,
    strategy: "444/44/44",
  }),
  createPresetCubingProfile({
    id: "recommended-cube-weapon-double-prime-attack",
    name: "DP weapon",
    itemType: "weapon",
    itemLevel: 200,
    target: "percAtt+36",
    targetLabel: "36%+ Attack/Magic Attack",
    statGains: { "Attack%": DEFAULT_DP_ATTACK_LINES },
    costB: 600,
  }),
  createPresetCubingProfile({
    id: "recommended-cube-secondary-double-prime-attack",
    name: "DP secondary",
    itemType: "secondary",
    itemLevel: 140,
    target: "percAtt+36",
    targetLabel: "36%+ Attack/Magic Attack",
    statGains: { "Attack%": DEFAULT_DP_ATTACK_LINES },
    costB: 800,
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-23-24-pitched-200-0-spares",
    name: "23★ → 24★ Pitched lv200",
    itemType: "accessory",
    itemLevel: 200,
    startStar: 23,
    targetStar: 24,
    spareCount: 0,
    costB: 216.29953356777884,
    expectedBooms: 3.5285865457294023,
    achievedProbability: 0.36971830985915494,
    guaranteeMet: false,
    requiredSpares: 8,
    strategy: "444/44/44",
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-astra-25-26",
    name: "Astra 25★ → 26★",
    itemType: "secondary",
    itemLevel: 200,
    startStar: 25,
    targetStar: 26,
    isAstraSecondary: true,
    costB: 500,
    expectedBooms: 112.52,
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-24-25-kalos-eternal-250-1114",
    name: "24★ → 25★ Kalos Eternals (10 spares)",
    itemLevel: 250,
    startStar: 24,
    targetStar: 25,
    costB: 585,
    expectedBooms: 9.54398646654429,
    achievedProbability: 0.6817129248432829,
    guaranteeMet: false,
    requiredSpares: 22,
    strategy: "444/44/44",
  }),
  createPresetStarforceProfile({
    id: "recommended-sf-24-25-limbo-eternal-250-1144",
    name: "24★ → 25★ Limbo Eternals (5 spares)",
    itemLevel: 250,
    startStar: 24,
    targetStar: 25,
    spareCount: 5,
    costB: 640,
    expectedBooms: 9.54398646654429,
    achievedProbability: 0.5521043473310309,
    guaranteeMet: false,
    requiredSpares: 22,
    strategy: "444/44/44",
  }),
]);

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

function isAstraSecondarySource(source = {}) {
  return Boolean(source.isAstraSecondary) && String(source.itemType ?? "").toLowerCase() === "secondary";
}

function getEffectiveStarforceCostSource(source = {}) {
  return {
    ...source,
    itemLevel: isAstraSecondarySource(source) ? 200 : source.itemLevel,
    replacementCostPerBoom: isAstraSecondarySource(source)
      ? ASTRA_SECONDARY_REPLACEMENT_COST
      : 0,
  };
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

export function validateProfilePresetInput(input) {
  const name = String(input.name ?? "").trim();
  if (!name) {
    throw new Error("Preset name is required");
  }
  if (!Array.isArray(input.profiles)) {
    throw new Error("Preset profiles are required");
  }

  return {
    id: getId(input, "profile-preset"),
    name,
    profiles: input.profiles.map(validateProfileInput).map(cloneProfile),
    createdAt: String(input.createdAt ?? new Date().toISOString()),
    updatedAt: String(input.updatedAt ?? new Date().toISOString()),
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
    const effectiveSource = getEffectiveStarforceCostSource(validProfile.source);
    const isAstraSecondary = isAstraSecondarySource(validProfile.source);
    const costs = applyAdditionalMesoCost(
      isAstraSecondary
        ? calculateAstraStarforceProfileCosts({
            startStar: Number(validProfile.source.startStar),
            targetStar: Number(validProfile.source.targetStar),
            hitProbability: Number(validProfile.source.hitProbability),
            events: validProfile.source.events ?? {},
          })
        : calculateStarforceProfileCosts({
            itemLevel: Number(effectiveSource.itemLevel),
            startStar: Number(validProfile.source.startStar),
            targetStar: Number(validProfile.source.targetStar),
            spareCount:
              validProfile.source.spareCount === undefined
                ? undefined
                : Number(validProfile.source.spareCount),
            hitProbability: Number(validProfile.source.hitProbability),
            events: validProfile.source.events ?? {},
            replacementCostPerBoom: effectiveSource.replacementCostPerBoom,
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

export function loadProfilePresets(storage = getDefaultStorage()) {
  const parsed = readStoredJson(storage, PROFILE_PRESET_STORAGE_KEY, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((preset) => {
    try {
      return [validateProfilePresetInput(preset)];
    } catch {
      return [];
    }
  });
}

export function saveProfilePresets(storage = getDefaultStorage(), presets) {
  writeStoredJson(
    storage,
    PROFILE_PRESET_STORAGE_KEY,
    presets.map(validateProfilePresetInput),
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
      return [validateProfileInput(profile)];
    } catch {
      return [];
    }
  });
}

export function saveProfiles(storage = getDefaultStorage(), profiles) {
  writeStoredJson(storage, PROFILE_STORAGE_KEY, profiles.map(validateProfileInput));
}
