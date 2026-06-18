const RAW_STAT_ABBRS = Object.freeze(["STR", "DEX", "INT", "LUK", "HP"]);

export const CLASS_STATS = Object.freeze({
  hero: "str",
  paladin: "str",
  dark_knight: "str",
  archmage_fp: "int",
  archmage_il: "int",
  bishop: "int",
  bowmaster: "dex",
  marksman: "dex",
  pathfinder: "dex",
  night_lord: "luk",
  shadower: "melee_thief",
  dual_blade: "melee_thief",
  buccaneer: "str",
  corsair: "dex",
  cannoneer: "str",
  dawn_warrior: "str",
  blaze_wizard: "int",
  wind_archer: "dex",
  night_walker: "luk",
  thunder_breaker: "str",
  mihile: "str",
  aran: "str",
  evan: "int",
  mercedes: "dex",
  phantom: "luk",
  luminous: "int",
  shade: "str",
  blaster: "str",
  battle_mage: "int",
  wild_hunter: "dex",
  mechanic: "dex",
  xenon: "xenon",
  demon_slayer: "str",
  demon_avenger: "hp",
  kaiser: "str",
  kain: "dex",
  cadena: "melee_thief",
  angelic_buster: "dex",
  zero: "str",
  kinesis: "int",
  adele: "str",
  illium: "int",
  ark: "str",
  hoyoung: "luk",
  lara: "int",
  khali: "luk",
  ren: "dex",
  lynn: "int",
  hayato: "str",
  kanna: "int",
  sia_astelle: "int",
  erel_light: "int",
  mo_xuan: "str",
});

export const STAT_TYPES = Object.freeze({
  str: Object.freeze({
    main: Object.freeze(["STR"]),
    secondary: Object.freeze(["DEX"]),
  }),
  dex: Object.freeze({
    main: Object.freeze(["DEX"]),
    secondary: Object.freeze(["STR"]),
  }),
  int: Object.freeze({
    main: Object.freeze(["INT"]),
    secondary: Object.freeze(["LUK"]),
  }),
  luk: Object.freeze({
    main: Object.freeze(["LUK"]),
    secondary: Object.freeze(["DEX"]),
  }),
  melee_thief: Object.freeze({
    main: Object.freeze(["LUK"]),
    secondary: Object.freeze(["DEX", "STR"]),
  }),
  xenon: Object.freeze({
    main: Object.freeze(["STR", "DEX", "LUK"]),
    secondary: Object.freeze([]),
  }),
  hp: Object.freeze({
    main: Object.freeze(["HP"]),
    secondary: Object.freeze(["STR"]),
  }),
});

export const CLASS_NAMES = Object.freeze(Object.keys(CLASS_STATS).sort());

const BASE_STAT_LABELS = Object.freeze({
  "Boss Damage": "Boss Damage",
  Attack: "Attack",
  "Attack%": "Attack%",
  "Critical Dmg": "Critical Dmg",
  "Ignore Dff(300)": "Ignore Dff(300)",
  "Ignore Dff(380)": "Ignore Dff(380)",
  "All Stat%": "All Stat%",
});

const ROLE_LABELS = Object.freeze(["Main Stat", "Secondary Stat", "Tertiary Stat"]);
const RAW_LABEL_STAT_TYPES = new Set(["hp", "xenon"]);

export function normalizeClassName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseNumber(value, label) {
  const number = Number(String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim());
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a number`);
  }
  return number;
}

function detectEquivalenceType(lines) {
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 3) {
      continue;
    }

    const firstColumn = parts[0].trim().toLowerCase();
    if (firstColumn !== "항목" && firstColumn !== "stat") {
      continue;
    }

    const thirdColumn = parts[2].trim().toLowerCase();
    if (thirdColumn.includes("final") && thirdColumn.includes("damage")) {
      return "final_damage";
    }
    if (thirdColumn.includes("main")) {
      return "main_stat";
    }
    return "unknown";
  }

  return "unknown";
}

function getDataLines(lines) {
  return lines.filter((line) => {
    const firstColumn = line.split("\t")[0]?.trim().toLowerCase();
    return firstColumn !== "항목" && firstColumn !== "stat";
  });
}

function getRoleByRawStat(statType) {
  const rawStats = [...STAT_TYPES[statType].main, ...STAT_TYPES[statType].secondary];
  return new Map(rawStats.map((rawStat, index) => [rawStat, ROLE_LABELS[index] ?? `${rawStat} Stat`]));
}

function getRawStatsForStatType(statType) {
  const statRoles = STAT_TYPES[statType];
  return statRoles ? [...statRoles.main, ...statRoles.secondary] : [];
}

function usesRawStatLabels(statType) {
  return RAW_LABEL_STAT_TYPES.has(statType);
}

export function getClassStatLabels(className) {
  const statType = CLASS_STATS[normalizeClassName(className)];
  if (!statType) {
    return [];
  }

  const rawStats = getRawStatsForStatType(statType);
  return usesRawStatLabels(statType)
    ? rawStats
    : ROLE_LABELS.slice(0, rawStats.length);
}

function getRawStatByRole(statType) {
  const rawStats = getRawStatsForStatType(statType);
  return new Map(rawStats.map((rawStat, index) => [ROLE_LABELS[index], rawStat]));
}

function normalizeLabelForStatType(label, statType) {
  const baseLabel = BASE_STAT_LABELS[label];
  if (baseLabel) {
    return baseLabel;
  }

  if (usesRawStatLabels(statType)) {
    const rawStatByRole = getRawStatByRole(statType);
    for (const [role, rawStat] of rawStatByRole.entries()) {
      if (label === role) {
        return rawStat;
      }
      if (label === `${role}%`) {
        return `${rawStat}%`;
      }
      if (label === `Not Affected by % ${role}`) {
        return `Not Affected by % ${rawStat}`;
      }
    }
    return label;
  }

  const roleByRawStat = getRoleByRawStat(statType);
  for (const rawStat of RAW_STAT_ABBRS) {
    const role = roleByRawStat.get(rawStat);
    if (!role) {
      continue;
    }
    if (label === rawStat) {
      return role;
    }
    if (label === `${rawStat}%`) {
      return `${role}%`;
    }
    if (label === `Not Affected by % ${rawStat}`) {
      return `Not Affected by % ${role}`;
    }
  }

  return label;
}

export function normalizeScouterStatLabel(label, className) {
  const statType = CLASS_STATS[normalizeClassName(className)];
  if (!statType) {
    throw new Error(`Unknown class: "${className}"`);
  }
  return normalizeLabelForStatType(String(label ?? "").trim(), statType);
}

function extractTableStats(dataLines) {
  return dataLines
    .map((line) => line.split("\t")[0]?.trim())
    .filter((label) => RAW_STAT_ABBRS.includes(label));
}

function validateTableStats(dataLines, statType) {
  const expected = [...STAT_TYPES[statType].main, ...STAT_TYPES[statType].secondary].sort();
  const found = extractTableStats(dataLines).sort();
  const missing = expected.filter((stat) => !found.includes(stat));
  const extra = found.filter((stat) => !expected.includes(stat));

  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) {
      parts.push(`expected but not found: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      parts.push(`found but not expected: ${extra.join(", ")}`);
    }
    throw new Error(`Stat mismatch for class "${statType}" - ${parts.join("; ")}`);
  }
}

export function parseScouterFinalDamageTable(rawText, rawClassName) {
  const className = normalizeClassName(rawClassName);
  const statType = CLASS_STATS[className];
  if (!statType) {
    throw new Error(`Unknown class: "${rawClassName}"`);
  }

  const lines = String(rawText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const equivalenceType = detectEquivalenceType(lines);
  if (equivalenceType !== "final_damage") {
    throw new Error("Only Final Damage% stat equivalence is supported right now.");
  }

  const dataLines = getDataLines(lines);
  if (dataLines.length < 7) {
    throw new Error(`Too few data rows (${dataLines.length}). Paste the full Scouter table.`);
  }

  validateTableStats(dataLines, statType);

  return {
    className,
    statType,
    equivalenceType,
    rows: dataLines.map((line) => {
      const parts = line.split("\t");
      if (parts.length < 3) {
        throw new Error(`Could not parse row: "${line}"`);
      }
      const label = parts[0].trim();
      return {
        stat: normalizeLabelForStatType(label, statType),
        value: parseNumber(parts[1], `${label} value`),
        finalDamagePercent: parseNumber(parts[2], `${label} final damage`),
      };
    }),
  };
}
