import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_STAT_EQUIVALENCE_CLASS,
  DEFAULT_STAT_ROWS,
  calculateFdGain,
  calculateStarforceFdBreakdown,
  calculateStarforceFdGain,
  deriveProfileMetrics,
  expandClassStatGains,
  loadProfiles,
  loadStatEquivalence,
  loadStatEquivalencePresets,
  refreshStarforceProfileCosts,
  saveProfiles,
  saveStatEquivalence,
  saveStatEquivalencePresets,
  validateProfileInput,
  validateStatEquivalenceInput,
  validateStatEquivalencePresetInput,
} from "./profiles.mjs";
import { formatStrategy } from "./strategyFormat.mjs";

test("defaults stat equivalence to the original Wind Archer screenshot values", () => {
  const statEquivalence = loadStatEquivalence(new MapStorage());

  assert.equal(DEFAULT_STAT_EQUIVALENCE_CLASS, "wind_archer");
  assert.equal(statEquivalence.className, "wind_archer");
  assert.deepEqual(statEquivalence.rows, DEFAULT_STAT_ROWS);
});

test("derives FD gain from stat-equivalence rows and stat gains", () => {
  const statEquivalence = validateStatEquivalenceInput({
    rows: [
      { stat: "Attack%", value: 12, finalDamagePercent: 4.2 },
      { stat: "Critical Dmg", value: 8, finalDamagePercent: 2.0 },
    ],
  });

  const fdGain = calculateFdGain(
    {
      "Attack%": 6,
      "Critical Dmg": 4,
    },
    statEquivalence,
  );

  assert.equal(fdGain, 3.1);
});

test("derives FD loss from negative stat changes", () => {
  const statEquivalence = validateStatEquivalenceInput({
    rows: [
      { stat: "Attack", value: 30, finalDamagePercent: 0.6 },
      { stat: "Main Stat", value: 30, finalDamagePercent: 0.3 },
    ],
  });

  const profile = validateProfileInput({
    name: "swap loses attack",
    type: "custom",
    statGains: { Attack: -30, "Main Stat": 15 },
    p50Cost: 1_000_000_000,
    p75Cost: 1_000_000_000,
    p95Cost: 1_000_000_000,
    notes: "",
  });
  const metrics = deriveProfileMetrics(profile, statEquivalence);

  assert.deepEqual(profile.statGains, { Attack: -30, "Main Stat": 15 });
  assert.equal(Number(metrics.fdGain.toFixed(6)), -0.45);
  assert.equal(Number(metrics.fdPerMesoP95.toExponential(6)), -4.5e-10);
});

test("derives profile metrics from computed costs and stat gains", () => {
  const statEquivalence = validateStatEquivalenceInput({
    rows: [{ stat: "Attack%", value: 12, finalDamagePercent: 4.2 }],
  });
  const profile = validateProfileInput({
    name: "21 to 22 weapon",
    type: "starforce",
    statGains: { "Attack%": 6 },
    p50Cost: 12_000_000_000,
    p75Cost: 22_000_000_000,
    p95Cost: 64_000_000_000,
    notes: "",
  });

  const metrics = deriveProfileMetrics(profile, statEquivalence);

  assert.equal(metrics.fdGain, 2.1);
  assert.equal(metrics.fdPerMesoP50, 2.1 / 12_000_000_000);
  assert.equal(metrics.fdPerMesoP95, 2.1 / 64_000_000_000);
});

test("derives star-force FD gain from wiki stat gains plus manual additions", () => {
  const statEquivalence = validateStatEquivalenceInput({
    className: "wind_archer",
    rows: [
      { stat: "Attack", value: 30, finalDamagePercent: 0.6 },
      { stat: "Main Stat", value: 30, finalDamagePercent: 0.3 },
      { stat: "Secondary Stat", value: 30, finalDamagePercent: 0.03 },
    ],
  });
  const profile = validateProfileInput({
    name: "15 to 22 armor",
    type: "starforce",
    statGains: { Attack: 12 },
    p50Cost: 10,
    p75Cost: 10,
    p95Cost: 10,
    notes: "",
    source: {
      itemType: "armor",
      itemLevel: 250,
      startStar: 15,
      targetStar: 22,
      hitProbability: 0.95,
    },
  });

  const fdGain = calculateStarforceFdGain(profile, statEquivalence);
  const metrics = deriveProfileMetrics(profile, statEquivalence);

  assert.equal(Number(fdGain.toFixed(6)), 3.949);
  assert.equal(Number(metrics.fdGain.toFixed(6)), 3.949);
  assert.equal(Number(metrics.fdPerMesoP95.toFixed(6)), 0.3949);
});

test("breaks star-force FD gain into automatic, manual, and net valued stats", () => {
  const statEquivalence = validateStatEquivalenceInput({
    className: "wind_archer",
    rows: [
      { stat: "Attack", value: 30, finalDamagePercent: 0.643 },
      { stat: "Main Stat", value: 30, finalDamagePercent: 0.243 },
      { stat: "Secondary Stat", value: 30, finalDamagePercent: 0.021 },
    ],
  });

  const rows = calculateStarforceFdBreakdown(
    {
      itemType: "armor",
      itemLevel: 250,
      startStar: 15,
      targetStar: 25,
      statGains: { Attack: -168, "Main Stat": -119 },
    },
    statEquivalence,
  );

  assert.deepEqual(
    rows.map(({ stat, label, automatic, manual, net, fdGain }) => ({
      stat,
      label,
      automatic,
      manual,
      net,
      fdGain: Number(fdGain.toFixed(6)),
    })),
    [
      {
        stat: "Attack",
        label: "Attack",
        automatic: 195,
        manual: -168,
        net: 27,
        fdGain: 0.5787,
      },
      {
        stat: "Main Stat",
        label: "Main Stat (Class Stat)",
        automatic: 119,
        manual: -119,
        net: 0,
        fdGain: 0,
      },
      {
        stat: "Secondary Stat",
        label: "Secondary Stat (Class Stat)",
        automatic: 119,
        manual: 0,
        net: 119,
        fdGain: 0.0833,
      },
    ],
  );
});

test("expands star-force class stat into tertiary stat for melee thieves", () => {
  const statEquivalence = validateStatEquivalenceInput({
    className: "shadower",
    rows: [
      { stat: "Attack", value: 30, finalDamagePercent: 0.6 },
      { stat: "Main Stat", value: 30, finalDamagePercent: 0.3 },
      { stat: "Secondary Stat", value: 30, finalDamagePercent: 0.03 },
      { stat: "Tertiary Stat", value: 30, finalDamagePercent: 0.015 },
    ],
  });

  const rows = calculateStarforceFdBreakdown(
    {
      itemType: "armor",
      itemLevel: 250,
      startStar: 15,
      targetStar: 22,
      statGains: {},
    },
    statEquivalence,
  );

  assert.deepEqual(
    rows.map(({ stat, automatic, fdGain }) => ({
      stat,
      automatic,
      fdGain: Number(fdGain.toFixed(6)),
    })),
    [
      { stat: "Attack", automatic: 120, fdGain: 2.4 },
      { stat: "Main Stat", automatic: 119, fdGain: 1.19 },
      { stat: "Secondary Stat", automatic: 119, fdGain: 0.119 },
      { stat: "Tertiary Stat", automatic: 119, fdGain: 0.0595 },
    ],
  );
});

test("expands class stat gains for star-force previews", () => {
  assert.deepEqual(
    expandClassStatGains(
      { Attack: 120, "Class Stat": 119 },
      validateStatEquivalenceInput({ className: "wind_archer" }),
    ),
    {
      Attack: 120,
      "Main Stat": 119,
      "Secondary Stat": 119,
    },
  );

  assert.deepEqual(
    expandClassStatGains(
      { Attack: 120, "Class Stat": 119 },
      validateStatEquivalenceInput({ className: "shadower" }),
    ),
    {
      Attack: 120,
      "Main Stat": 119,
      "Secondary Stat": 119,
      "Tertiary Stat": 119,
    },
  );
});

test("presents DEX and STR stat rows as generic main and secondary stat labels", () => {
  const statEquivalence = validateStatEquivalenceInput({
    rows: [
      { stat: "DEX", value: 30, finalDamagePercent: 0.243 },
      { stat: "DEX%", value: 12, finalDamagePercent: 0.956 },
      { stat: "Not Affected by % DEX", value: 200, finalDamagePercent: 0.183 },
      { stat: "STR", value: 30, finalDamagePercent: 0.021 },
      { stat: "STR%", value: 12, finalDamagePercent: 0.122 },
      { stat: "Not Affected by % STR", value: 200, finalDamagePercent: 0.046 },
    ],
  });
  const profile = validateProfileInput({
    name: "legacy stat labels",
    type: "custom",
    statGains: {
      DEX: -119,
      "DEX%": 12,
      "Not Affected by % DEX": 200,
      STR: 30,
      "STR%": -12,
      "Not Affected by % STR": -200,
    },
    p50Cost: 1,
    p75Cost: 1,
    p95Cost: 1,
    notes: "",
  });

  assert.deepEqual(
    statEquivalence.rows.map((row) => row.stat),
    [
      "Main Stat",
      "Main Stat%",
      "Not Affected by % Main Stat",
      "Secondary Stat",
      "Secondary Stat%",
      "Not Affected by % Secondary Stat",
    ],
  );
  assert.deepEqual(profile.statGains, {
    "Main Stat": -119,
    "Main Stat%": 12,
    "Not Affected by % Main Stat": 200,
    "Secondary Stat": 30,
    "Secondary Stat%": -12,
    "Not Affected by % Secondary Stat": -200,
  });
});

test("stat-equivalence storage keeps class metadata and drops stale image previews", () => {
  const statEquivalence = validateStatEquivalenceInput({
    className: "demon_avenger",
    rows: [{ stat: "HP", value: 30, finalDamagePercent: 0.012 }],
    images: [
      {
        id: "legacy-image",
        name: "old upload",
        dataUrl: "data:image/png;base64,abc",
      },
    ],
  });

  assert.deepEqual(statEquivalence, {
    className: "demon_avenger",
    rows: [{ stat: "Main Stat", value: 30, finalDamagePercent: 0.012 }],
  });
});

test("refreshes stored star-force costs and recovery strategy from source settings", () => {
  const [profile] = refreshStarforceProfileCosts([
    validateProfileInput({
      id: "profile-1",
      name: "21 to 22 weapon",
      type: "starforce",
      statGains: {},
      p50Cost: 1,
      p75Cost: 1,
      p95Cost: 1,
      notes: "",
      source: {
        itemType: "weapon",
        itemLevel: 250,
        startStar: 21,
        targetStar: 22,
        spareCount: 6,
        hitProbability: 0.95,
        events: {
          starCatch: true,
          costReduction30: true,
          boomReduction30: true,
        },
        percentileCosts: {
          strategy: [{ star: 21, nextStar: 22, mode: 4 }],
        },
      },
    }),
  ]);

  assert.notEqual(profile.p95Cost, 1);
  assert.equal(profile.source.spareCount, 6);
  assert.equal(profile.source.percentileCosts.availableSpares, 6);
  assert.match(formatStrategy(profile.source.percentileCosts.strategy), /^\d{3}\/\d{2}\/\d{2}$/);
});

test("refreshes stored cubing costs from source settings", () => {
  const [profile] = refreshStarforceProfileCosts([
    validateProfileInput({
      id: "profile-1",
      name: "3L attack weapon",
      type: "cubing",
      statGains: { "Attack%": 39 },
      p50Cost: 1,
      p75Cost: 1,
      p95Cost: 1,
      notes: "",
      source: {
        cubeType: "red",
        itemType: "weapon",
        itemLevel: 250,
        desiredTier: "legendary",
        target: "lineAtt+3",
      },
    }),
  ]);

  assert.notEqual(profile.p95Cost, 1);
  assert.equal(profile.source.cubeType, "red");
  assert.equal(profile.source.percentileCosts.strategy, "lineAtt+3");
  assert.ok(profile.source.percentileCosts.p85Cubes > 0);
  assert.equal(profile.source.percentileCosts.p95Cost, profile.source.percentileCosts.p85Cost);
});

test("loads recommended saved upgrades when no profile library exists", () => {
  const profiles = loadProfiles(new MapStorage());
  const names = profiles.map((profile) => profile.name);

  assert.ok(profiles.length >= 10);
  assert.deepEqual(
    [
      "21★ → 22★ armor (250)",
      "22★ → 23★ accessory (160, 10 spares)",
      "24★ → 25★ armor (250)",
      "Emblem: 33% → double-prime attack",
      "Weapon: 33% attack → 23/40",
      "Gloves: 2L crit+stat → 3L crit",
      "Hat: -4s cooldown + stat",
    ].every((name) => names.includes(name)),
    true,
  );
  assert.ok(profiles.every((profile) => Number.isFinite(profile.p95Cost) && profile.p95Cost > 1));
  assert.ok(profiles.every((profile) => profile.source?.percentileCosts));
  assert.equal(
    profiles.filter((profile) => profile.type === "starforce").every((profile) => profile.source.spareCount === 10),
    true,
  );
  assert.equal(
    profiles.find((profile) => profile.name === "22★ → 23★ accessory (160, 10 spares)")?.source.itemType,
    "accessory",
  );
  assert.equal(
    profiles.find((profile) => profile.name === "Emblem: 33% → double-prime attack")?.source.target,
    "percAtt+36",
  );
  assert.equal(
    profiles.find((profile) => profile.name === "Secondary: 33% → double-prime attack")?.source.target,
    "percAtt+36",
  );
  assert.equal(
    profiles.find((profile) => profile.name === "Armor: 3L stat → double-prime stat")?.source.target,
    "percStat+36",
  );
});

test("keeps an explicitly empty saved upgrade library empty", () => {
  const storage = new MapStorage();
  storage.setItem("sfcalc.enhancementPlanner.profiles.v2", JSON.stringify([]));

  assert.deepEqual(loadProfiles(storage), []);
});

test("migrates the old 160 armor recommended row to 160 accessory with 10 spares", () => {
  const storage = new MapStorage();
  storage.setItem(
    "sfcalc.enhancementPlanner.profiles.v2",
    JSON.stringify([
      {
        id: "recommended-sf-22-23-armor-160",
        name: "22★ → 23★ armor (160)",
        type: "starforce",
        statGains: {},
        p50Cost: 1,
        p75Cost: 1,
        p95Cost: 1,
        notes: "",
        source: {
          itemType: "armor",
          itemLevel: 160,
          startStar: 22,
          targetStar: 23,
          hitProbability: 0.85,
          events: {},
        },
      },
    ]),
  );

  const [profile] = loadProfiles(storage);

  assert.equal(profile.id, "recommended-sf-22-23-accessory-160");
  assert.equal(profile.name, "22★ → 23★ accessory (160, 10 spares)");
  assert.equal(profile.source.itemType, "accessory");
  assert.equal(profile.source.spareCount, 10);
});

test("saves and loads stat-equivalence rows and profiles", () => {
  const storage = new MapStorage();
  const statEquivalence = validateStatEquivalenceInput({
    className: "night_lord",
    rows: [{ stat: "Attack", value: 30, finalDamagePercent: 0.643 }],
  });
  const profiles = [
    validateProfileInput({
      id: "profile-1",
      name: "22 to 23 glove",
      type: "starforce",
      statGains: { Attack: 12 },
      p50Cost: 20_000_000_000,
      p75Cost: 42_000_000_000,
      p95Cost: 110_000_000_000,
      notes: "",
    }),
  ];

  saveStatEquivalence(storage, statEquivalence);
  saveProfiles(storage, profiles);

  assert.deepEqual(loadStatEquivalence(storage), statEquivalence);
  assert.deepEqual(loadProfiles(storage), profiles);
});

test("saves and loads named stat-equivalence presets", () => {
  const storage = new MapStorage();
  const presets = [
    validateStatEquivalencePresetInput({
      id: "preset-1",
      name: "Bossing",
      className: "wind_archer",
      rows: [{ stat: "Attack", value: 30, finalDamagePercent: 0.643 }],
    }),
  ];

  saveStatEquivalencePresets(storage, presets);

  assert.deepEqual(loadStatEquivalencePresets(storage), presets);
});

test("falls back to defaults when saved planner data is corrupt", () => {
  const storage = new MapStorage();
  storage.setItem("sfcalc.enhancementPlanner.statEquivalence.v2", "{not json");
  storage.setItem("sfcalc.enhancementPlanner.profiles.v2", JSON.stringify({ not: "an array" }));
  storage.setItem("sfcalc.enhancementPlanner.statEquivalencePresets.v1", JSON.stringify({ not: "an array" }));

  assert.deepEqual(
    loadStatEquivalence(storage),
    validateStatEquivalenceInput({ className: DEFAULT_STAT_EQUIVALENCE_CLASS }),
  );
  assert.deepEqual(loadStatEquivalencePresets(storage), []);
  assert.deepEqual(loadProfiles(storage), []);
});

class MapStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, value);
  }
}
