import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASS_NAMES,
  parseScouterFinalDamageTable,
} from "./statEquivalenceParser.mjs";

const DEMON_AVENGER_FD = `항목\tValue\tFinal Damage%
Boss Damage\t40\t3.805%
Attack\t30\t0.479%
Attack%\t12\t3.585%
Critical Dmg\t8\t2.578%
Ignore Dff(300)\t40\t0.428%
Ignore Dff(380)\t40\t0.543%
HP\t30\t0.012%
HP%\t12\t0.731%
Not Affected by % HP\t200\t0.006%
STR\t30\t0.004%
STR%\t12\t0.078%
Not Affected by % STR\t200\t0.026%
All Stat%\t9\t0.059%`;

const XENON_FD = `항목\tValue\tFinal Damage%
Boss Damage\t40\t3.476%
Attack\t30\t0.484%
Attack%\t12\t3.812%
Critical Dmg\t8\t2.523%
Ignore Dff(300)\t40\t0.478%
Ignore Dff(380)\t40\t0.607%
STR\t30\t0.118%
STR%\t12\t0.314%
Not Affected by % STR\t200\t0.089%
DEX\t30\t0.118%
DEX%\t12\t0.372%
Not Affected by % DEX\t200\t0.089%
LUK\t30\t0.118%
LUK%\t12\t0.410%
Not Affected by % LUK\t200\t0.089%
All Stat%\t9\t0.822%`;

const NIGHT_LORD_MAIN_STAT = `항목\tValue\tMain Stat
Boss Damage\t40\t496.03
Attack\t30\t60.17
Attack%\t12\t536.06
Critical Dmg\t8\t327.38
Ignore Dff(300)\t40\t49.81
Ignore Dff(380)\t40\t63.24
LUK\t30\t30.00
LUK%\t12\t111.07
Not Affected by % LUK\t200\t18.81
DEX\t30\t2.98
DEX%\t12\t15.81
Not Affected by % DEX\t200\t4.70
All Stat%\t9\t104.48`;

const PHANTOM_FD_WITH_SPACES = `항목    Value    Final Damage%
Boss Damage    40    3.394%
Attack    30    0.611%
Attack%    12    5.233%
Critical Dmg    8    2.369%
Ignore Dff(300)    40    0.614%
Ignore Dff(380)    40    0.781%
LUK    30    0.232%
LUK%    12    1.037%
Not Affected by % LUK    200    0.201%
DEX    30    0.019%
DEX%    12    0.141%
Not Affected by % DEX    200    0.050%
All Stat%    9    0.883%`;

test("exports sorted Maple class names for the parser UI", () => {
  assert.equal(CLASS_NAMES.includes("demon_avenger"), true);
  assert.equal(CLASS_NAMES.includes("night_lord"), true);
  assert.deepEqual(CLASS_NAMES, [...CLASS_NAMES].sort());
});

test("parses Demon Avenger FD scouter rows into HP and STR stat rows", () => {
  const result = parseScouterFinalDamageTable(DEMON_AVENGER_FD, "demon_avenger");

  assert.equal(result.className, "demon_avenger");
  assert.equal(result.statType, "hp");
  assert.equal(result.equivalenceType, "final_damage");
  assert.deepEqual(result.rows, [
    { stat: "Boss Damage", value: 40, finalDamagePercent: 3.805 },
    { stat: "Attack", value: 30, finalDamagePercent: 0.479 },
    { stat: "Attack%", value: 12, finalDamagePercent: 3.585 },
    { stat: "Critical Dmg", value: 8, finalDamagePercent: 2.578 },
    { stat: "Ignore Dff(300)", value: 40, finalDamagePercent: 0.428 },
    { stat: "Ignore Dff(380)", value: 40, finalDamagePercent: 0.543 },
    { stat: "HP", value: 30, finalDamagePercent: 0.012 },
    { stat: "HP%", value: 12, finalDamagePercent: 0.731 },
    { stat: "Not Affected by % HP", value: 200, finalDamagePercent: 0.006 },
    { stat: "STR", value: 30, finalDamagePercent: 0.004 },
    { stat: "STR%", value: 12, finalDamagePercent: 0.078 },
    { stat: "Not Affected by % STR", value: 200, finalDamagePercent: 0.026 },
    { stat: "All Stat%", value: 9, finalDamagePercent: 0.059 },
  ]);
});

test("preserves Xenon three-stat FD rows as STR, DEX, and LUK stats", () => {
  const result = parseScouterFinalDamageTable(XENON_FD, "xenon");

  assert.deepEqual(
    result.rows.map((row) => row.stat),
    [
      "Boss Damage",
      "Attack",
      "Attack%",
      "Critical Dmg",
      "Ignore Dff(300)",
      "Ignore Dff(380)",
      "STR",
      "STR%",
      "Not Affected by % STR",
      "DEX",
      "DEX%",
      "Not Affected by % DEX",
      "LUK",
      "LUK%",
      "Not Affected by % LUK",
      "All Stat%",
    ],
  );
});

test("parses Scouter FD rows copied with multiple spaces between columns", () => {
  const result = parseScouterFinalDamageTable(PHANTOM_FD_WITH_SPACES, "phantom");

  assert.equal(result.className, "phantom");
  assert.equal(result.statType, "luk");
  assert.deepEqual(result.rows.slice(6, 12), [
    { stat: "Main Stat", value: 30, finalDamagePercent: 0.232 },
    { stat: "Main Stat%", value: 12, finalDamagePercent: 1.037 },
    { stat: "Not Affected by % Main Stat", value: 200, finalDamagePercent: 0.201 },
    { stat: "Secondary Stat", value: 30, finalDamagePercent: 0.019 },
    { stat: "Secondary Stat%", value: 12, finalDamagePercent: 0.141 },
    { stat: "Not Affected by % Secondary Stat", value: 200, finalDamagePercent: 0.05 },
  ]);
});

test("rejects Main Stat scouter rows until planner supports non-FD units", () => {
  assert.throws(
    () => parseScouterFinalDamageTable(NIGHT_LORD_MAIN_STAT, "night_lord"),
    /Only Final Damage% stat equivalence is supported/,
  );
});

test("rejects class and table stat mismatches", () => {
  assert.throws(
    () => parseScouterFinalDamageTable(DEMON_AVENGER_FD, "night_lord"),
    /Stat mismatch/,
  );
});
