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

test("exports sorted Maple class names for the parser UI", () => {
  assert.equal(CLASS_NAMES.includes("demon_avenger"), true);
  assert.equal(CLASS_NAMES.includes("night_lord"), true);
  assert.deepEqual(CLASS_NAMES, [...CLASS_NAMES].sort());
});

test("parses Demon Avenger FD scouter rows into generic planner stat rows", () => {
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
    { stat: "Main Stat", value: 30, finalDamagePercent: 0.012 },
    { stat: "Main Stat%", value: 12, finalDamagePercent: 0.731 },
    { stat: "Not Affected by % Main Stat", value: 200, finalDamagePercent: 0.006 },
    { stat: "Secondary Stat", value: 30, finalDamagePercent: 0.004 },
    { stat: "Secondary Stat%", value: 12, finalDamagePercent: 0.078 },
    { stat: "Not Affected by % Secondary Stat", value: 200, finalDamagePercent: 0.026 },
    { stat: "All Stat%", value: 9, finalDamagePercent: 0.059 },
  ]);
});

test("preserves Xenon three-stat FD rows as main, secondary, and tertiary stats", () => {
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
      "Main Stat",
      "Main Stat%",
      "Not Affected by % Main Stat",
      "Secondary Stat",
      "Secondary Stat%",
      "Not Affected by % Secondary Stat",
      "Tertiary Stat",
      "Tertiary Stat%",
      "Not Affected by % Tertiary Stat",
      "All Stat%",
    ],
  );
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
