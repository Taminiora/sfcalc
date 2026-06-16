import assert from "node:assert/strict";
import test from "node:test";

import { formatStrategy } from "./strategyFormat.mjs";

test("formats star-force strategy by star tiers", () => {
  const allModeOne = [15, 16, 17, 18, 19, 20, 21].map((star) => ({
    star,
    mode: "1",
  }));
  const mixedStrategy = [15, 16, 17, 18, 19, 20, 21].map((star, index) => ({
    star,
    mode: ["1", "1", "3", "1", "1", "4", "4"][index],
  }));

  assert.equal(formatStrategy(allModeOne), "111/11/11");
  assert.equal(formatStrategy(mixedStrategy), "113/11/44");
});

test("formats partial and base-only strategies", () => {
  assert.equal(
    formatStrategy([
      { star: 18, mode: "2" },
      { star: 19, mode: "3" },
      { star: 20, mode: "4" },
    ]),
    "23/4",
  );

  assert.equal(
    formatStrategy([
      { star: 22, mode: "Base" },
      { star: 23, mode: "Base" },
    ]),
    "BB",
  );
});
