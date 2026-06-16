import { calculateCubingProfileCosts } from "./cubing.mjs";
import { calculateStarforceProfileCosts } from "./plannerStarforce.mjs";
import { calculateStarforceStatGains, CLASS_STAT } from "./starforceStats.mjs";
import {
  CLASS_STATS,
  STAT_TYPES,
  normalizeClassName,
  normalizeScouterStatLabel,
} from "./statEquivalenceParser.mjs";

const PROFILE_STORAGE_KEY = "sfcalc.enhancementPlanner.profiles.v2";
const STAT_EQUIVALENCE_STORAGE_KEY = "sfcalc.enhancementPlanner.statEquivalence.v2";

const PRESENTED_STAT_RENAMES = Object.freeze({
  DEX: "Main Stat",
  "DEX%": "Main Stat%",
  "Not Affected by % DEX": "Not Affected by % Main Stat",
  STR: "Secondary Stat",
  "STR%": "Secondary Stat%",
  "Not Affected by % STR": "Not Affected by % Secondary Stat",
});

const CLASS_STAT_ROLE_LABELS = Object.freeze(["Main Stat", "Secondary Stat", "Tertiary Stat"]);

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

function validateStatGains(input = {}) {
  const validated = {};
  for (const [rawStat, rawValue] of Object.entries(input)) {
    const stat = getPresentedStatName(String(rawStat).trim());
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
  const statType = CLASS_STATS[normalizeClassName(statEquivalence.className)];
  const statRoles = statType ? STAT_TYPES[statType] : null;
  if (statRoles) {
    const roleCount = statRoles.main.length + statRoles.secondary.length;
    const roleKeys = CLASS_STAT_ROLE_LABELS.slice(0, roleCount).filter((role) =>
      fdPerUnitByStat.has(role),
    );
    if (roleKeys.length > 0) {
      return roleKeys;
    }
  }

  return [classStatAlias ?? CLASS_STAT];
}

function getClassStatDisplayKeys(statEquivalence) {
  const statType = CLASS_STATS[normalizeClassName(statEquivalence.className)];
  const statRoles = statType ? STAT_TYPES[statType] : null;
  if (!statRoles) {
    return [CLASS_STAT];
  }

  const roleCount = statRoles.main.length + statRoles.secondary.length;
  return CLASS_STAT_ROLE_LABELS.slice(0, roleCount);
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
    const row = rowsByStat.get(valuedStat) ?? {
      stat: valuedStat,
      label: valuedStat,
      automatic: 0,
      manual: 0,
      net: 0,
      fdGain: 0,
      usesClassStatAlias: false,
    };
    row[field] += value;
    row.usesClassStatAlias ||= stat === CLASS_STAT && valuedStat !== stat;
    row.label = row.usesClassStatAlias ? `${valuedStat} (Class Stat)` : valuedStat;
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

export function calculateFdGain(statGains, statEquivalence) {
  const validStatGains = validateStatGains(statGains);
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
  for (const [stat, value] of Object.entries(validateStatGains(statGains))) {
    const displayStats = stat === CLASS_STAT
      ? getClassStatDisplayKeys(statEquivalence)
      : [stat];
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
  const manualGains = validateStatGains(input.statGains);
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
      const costs = calculateCubingProfileCosts({
        cubeType: validProfile.source.cubeType,
        itemType: validProfile.source.itemType,
        itemLevel: Number(validProfile.source.itemLevel),
        cubeSale: Boolean(validProfile.source.cubeSale),
        desiredTier: validProfile.source.desiredTier,
        target: validProfile.source.target,
      });

      return validateProfileInput({
        ...validProfile,
        p50Cost: costs.p50Cost,
        p75Cost: costs.p75Cost,
        p95Cost: costs.p95Cost,
        source: {
          ...validProfile.source,
          percentileCosts: costs,
        },
      });
    }

    if (validProfile.type !== "starforce" || !hasStarforceCostSource(validProfile.source)) {
      return validProfile;
    }

    const costs = calculateStarforceProfileCosts({
      itemLevel: Number(validProfile.source.itemLevel),
      startStar: Number(validProfile.source.startStar),
      targetStar: Number(validProfile.source.targetStar),
      spareCount:
        validProfile.source.spareCount === undefined
          ? undefined
          : Number(validProfile.source.spareCount),
      hitProbability: Number(validProfile.source.hitProbability),
      events: validProfile.source.events ?? {},
    });

    return validateProfileInput({
      ...validProfile,
      p50Cost: costs.p50Cost,
      p75Cost: costs.p75Cost,
      p95Cost: costs.p95Cost,
      source: {
        ...validProfile.source,
        percentileCosts: costs,
      },
    });
  });
}

export function loadStatEquivalence(storage = getDefaultStorage()) {
  const parsed = readStoredJson(storage, STAT_EQUIVALENCE_STORAGE_KEY, null);
  if (!parsed) {
    return validateStatEquivalenceInput();
  }

  try {
    return validateStatEquivalenceInput(parsed);
  } catch {
    return validateStatEquivalenceInput();
  }
}

export function saveStatEquivalence(storage = getDefaultStorage(), statEquivalence) {
  writeStoredJson(
    storage,
    STAT_EQUIVALENCE_STORAGE_KEY,
    validateStatEquivalenceInput(statEquivalence),
  );
}

export function loadProfiles(storage = getDefaultStorage()) {
  const parsed = readStoredJson(storage, PROFILE_STORAGE_KEY, []);
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
