import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("does not show the source label in the header", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.equal(html.includes("Cary base costs + tier multipliers"), false);
});

test("infographic uses compact breakpoint columns", () => {
  const script = readFileSync(new URL("./infographic.mjs", import.meta.url), "utf8");

  assert.equal(script.includes("Spare cost"), true);
  assert.equal(script.includes("Low end of spare cost"), false);
  assert.equal(script.includes("Cost to 22"), false);
});

test("planner shell includes library and SF optimization tabs without 5/10/15", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");

  assert.equal(html.includes("Upgrade Library"), true);
  assert.equal(html.includes("SF Optimization"), true);
  assert.equal(html.includes("5/10/15"), false);
});

test("planner uses stable static asset URLs for production hosting", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.match(html, /href="\.\/src\/styles\.css\?v=\d{8}-[a-z0-9-]+"/);
  assert.match(html, /src="\.\/src\/planner\.mjs\?v=\d{8}-[a-z0-9-]+"/);
  assert.doesNotMatch(html, /\?(?:fresh|reload)=/);
  assert.equal(script.includes('from "./cubing.mjs?v=20260617-cd-hat-options"'), true);
  assert.equal(script.includes('from "./strategyFormat.mjs?v=20260617-strategy-display"'), true);
  assert.doesNotMatch(script, /from "\.\/[^"]+\?(?:fresh|reload)=/);
});

test("planner supports a persisted dark mode toggle", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(html.includes('id="theme-toggle"'), true);
  assert.equal(html.includes('role="switch"'), true);
  assert.equal(html.includes("theme-toggle-light"), true);
  assert.equal(html.includes("theme-toggle-dark"), true);
  assert.equal(script.includes('THEME_STORAGE_KEY = "sfcalc.enhancementPlanner.theme.v1"'), true);
  assert.equal(script.includes("document.documentElement.dataset.theme"), true);
  assert.equal(script.includes("localStorage.setItem(THEME_STORAGE_KEY"), true);
  assert.match(css, /html\[data-theme="dark"\]\s*\{/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /\.theme-toggle\s*\{/);
  assert.match(css, /\.theme-toggle:has\(input:checked\) \.theme-toggle-dark\s*\{/);
});

test("planner stat equivalence supports scouter FD paste and manual edits", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(html.includes("Scouter FD paste"), true);
  assert.equal(html.includes('<details class="planner-card stat-equivalence-card" open>'), true);
  assert.equal(html.includes('class="stat-equivalence-summary"'), true);
  assert.equal(html.includes("Paste Scouter Final Damage% rows directly."), true);
  assert.equal(html.includes("get your numbers here"), false);
  assert.equal(html.includes('href="https://satsivi.github.io/maple_data_parser/"'), false);
  assert.equal(html.includes("stat-equivalence-class"), true);
  assert.equal(html.includes("stat-equivalence-paste"), true);
  assert.equal(html.includes("Parse Scouter paste"), true);
  assert.equal(html.includes("stat-equivalence-preset"), true);
  assert.equal(html.includes("stat-equivalence-preset-name"), true);
  assert.equal(html.includes("Save preset"), true);
  assert.equal(html.includes("Load"), true);
  assert.equal(html.includes("Delete"), true);
  assert.equal(html.includes("Save manual values"), false);
  assert.equal(html.includes("Image"), false);
  assert.equal(html.includes("stat-equivalence-rows"), true);
  assert.equal(html.includes("stat-image-preview"), false);
  assert.equal(html.includes("stat-image-upload"), false);
  assert.equal(html.includes("profile-p50-cost"), false);
  assert.equal(html.includes("profile-p75-cost"), false);
  assert.equal(html.includes("profile-p95-cost"), false);
  assert.equal(script.includes("parseScouterFinalDamageTable"), true);
  assert.equal(script.includes("loadStatEquivalencePresets"), true);
  assert.equal(script.includes("saveStatEquivalencePresets"), true);
  assert.equal(script.includes("renderClassOptions"), true);
});

test("planner stat equivalence card is compact and collapsible", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(css, /\.stat-equivalence-card\s*\{[\s\S]*?max-width: none/s);
  assert.match(css, /\.stat-equivalence-card\s*\{[\s\S]*?width: 100%/s);
  assert.match(css, /\.stat-equivalence-summary\s*\{[\s\S]*?cursor: pointer/s);
  assert.match(css, /\.stat-equivalence-summary\s*\{[\s\S]*?padding-right: 34px/s);
  assert.match(css, /\.stat-equivalence-summary\s*\{[\s\S]*?position: relative/s);
  assert.match(css, /\.stat-equivalence-summary::after\s*\{[\s\S]*?content: "\+"/s);
  assert.match(css, /\.stat-equivalence-card\[open\] \.stat-equivalence-summary::after\s*\{[\s\S]*?content: "-"/s);
});

test("planner defaults stat equivalence class input to Wind Archer", () => {
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const profiles = readFileSync(new URL("./profiles.mjs", import.meta.url), "utf8");

  assert.equal(profiles.includes('export const DEFAULT_STAT_EQUIVALENCE_CLASS = "wind_archer"'), true);
  assert.equal(script.includes("|| DEFAULT_STAT_EQUIVALENCE_CLASS"), true);
  assert.equal(script.includes('|| "night_lord"'), false);
});

test("planner save upgrade form supports star-force and cubing modes", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const cubing = readFileSync(new URL("./cubing.mjs", import.meta.url), "utf8");

  assert.equal(html.includes("profile-upgrade-type"), true);
  assert.match(html, /id="profile-name"(?![^>]*required)/);
  assert.equal(html.includes("profile-cubing-fields"), true);
  assert.equal(html.includes("profile-cube-type"), true);
  assert.equal(html.includes("profile-cube-sale"), true);
  assert.equal(html.includes("Cube sale"), true);
  assert.equal(html.includes("profile-cubing-target"), true);
  const cubingItemTypeSelect = html.match(
    /<select id="profile-cubing-item-type">([\s\S]*?)<\/select>/,
  )?.[1];
  assert.ok(cubingItemTypeSelect);
  for (const itemType of [
    "accessory",
    "badge",
    "belt",
    "bottom",
    "cape",
    "emblem",
    "gloves",
    "hat",
    "heart",
    "overall",
    "top",
    "secondary",
    "shoes",
    "shoulder",
    "weapon",
  ]) {
    assert.match(cubingItemTypeSelect, new RegExp(`<option value="${itemType}"(?: selected)?>`));
  }
  assert.equal(cubingItemTypeSelect.includes('<option value="armor">'), false);
  assert.equal(html.includes("Stat gear"), false);
  assert.equal(html.includes("profile-cubing-stat-gains"), true);
  assert.equal(script.includes("calculateCubingProfileCosts"), true);
  assert.equal(script.includes("getCubingStrategyOptions"), true);
  assert.equal(script.includes("function getDefaultProfileName"), true);
  assert.equal(script.includes("name: getProfileName({ isCubing, source })"), true);
  assert.equal(script.includes("const groupedOptions = new Map()"), true);
  assert.equal(script.includes("document.createElement(\"optgroup\")"), true);
  assert.equal(script.includes("cubeSale: profileFields.cubeSale.checked"), true);
  assert.equal(script.includes("profileFields.cubeSale.checked = false"), true);
  assert.equal(script.includes('renderCubingTargetOptions("percAtt+39")'), true);
  assert.equal(cubing.includes("Double prime main stat"), false);
  assert.equal(cubing.includes("Triple prime main stat"), false);
  assert.equal(cubing.includes("CUBE_SALE_DISCOUNT = 0.3"), true);
  assert.equal(script.includes('type: isCubing ? "cubing" : "starforce"'), true);
});

test("planner leaves the saved upgrade name blank by default", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.match(html, /id="profile-name"[^>]*value=""/);
  assert.match(html, /<option value="armor" selected>Armor<\/option>/);
  assert.match(html, /id="profile-start-star"[^>]*value="21"/);
  assert.match(html, /id="profile-target-star"[^>]*value="22"/);
  assert.equal(script.includes('profileFields.name.value = ""'), true);
  assert.equal(script.includes('profileFields.itemType.value = "armor"'), true);
  assert.equal(script.includes("function formatSpareCount"), true);
  assert.equal(script.includes("formatSpareCount(source.spareCount)"), true);
  assert.equal(script.includes("return profileFields.name.value.trim() || getDefaultProfileName"), true);
});

test("planner defaults probability UX to 85 percent target odds", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.match(html, /id="profile-hit-probability"[^>]*value="85"/);
  assert.match(html, /id="optimizer-hit-probability"[^>]*value="85"/);
  assert.equal(html.includes("Target odds (%)"), true);
  assert.equal(html.includes("Higher odds protect against bad tails."), true);
  assert.equal(html.includes("<span>Spares for target odds</span>"), true);
  assert.equal(html.includes("<span>Hit odds</span>"), true);
  assert.equal(script.includes('profileFields.hitProbability.value = "85"'), true);
  assert.equal(script.includes(": 85;"), true);
  assert.equal(script.includes("Clears ${selectedProfile.name} at target odds."), true);
});

test("planner defaults SF event checkboxes to enabled", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.match(html, /id="profile-event-star-catch" checked type="checkbox"/);
  assert.match(html, /id="profile-event-cost-reduction" checked type="checkbox"/);
  assert.match(html, /id="profile-event-boom-reduction" checked type="checkbox"/);
  assert.match(html, /id="event-star-catch" checked type="checkbox"/);
  assert.match(html, /id="event-cost-reduction" checked type="checkbox"/);
  assert.match(html, /id="event-boom-reduction" checked type="checkbox"/);
  assert.equal(html.includes("30% cost reduction"), true);
  assert.equal(html.includes("30% base-cost reduction"), false);
  assert.equal(html.includes("Copium 30% full cost reduction"), false);
  assert.equal(html.includes("profile-event-full-cost-reduction"), false);
  assert.equal(html.includes("event-full-cost-reduction"), false);
  assert.equal(script.includes("profileFields.starCatch.checked = true"), true);
  assert.equal(script.includes("profileFields.costReduction30.checked = true"), true);
  assert.equal(script.includes("profileFields.boomReduction30.checked = true"), true);
  assert.equal(script.includes("fullCostReduction30: profileFields.fullCostReduction30.checked"), false);
  assert.equal(script.includes("fullCostReduction30: optimizerFields.fullCostReduction30.checked"), false);
});

test("planner collapses additional stat changes and takes spares on saved upgrades only", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(html.includes("Additional stat changes"), true);
  assert.equal(html.includes("Additional meso cost"), true);
  assert.equal(html.includes("Additional stat gains"), false);
  assert.equal(html.includes("<details"), true);
  assert.equal(html.includes("profile-additional-meso-cost"), true);
  assert.match(html, /id="profile-additional-meso-cost"[^>]*class="meso-cost-input"/);
  assert.match(html, /id="profile-additional-meso-cost"[^>]*type="text"/);
  assert.equal(html.includes("Meso cost"), true);
  assert.equal(html.includes("profile-spare-count"), true);
  assert.equal(html.includes("optimizer-spare-count"), false);
  assert.equal(html.includes("Available spares"), true);
  assert.equal(html.includes("profile-spare-cost"), false);
  assert.equal(html.includes("optimizer-spare-cost"), false);
  assert.equal(html.includes("Cost per spare"), false);
  assert.equal(html.includes("Banked-spare cost"), false);
  assert.equal(script.includes("additionalMesoCost: document.querySelector"), true);
  assert.equal(
    script.includes("const additionalMesoCost = readFormattedIntegerInput(profileFields.additionalMesoCost)"),
    true,
  );
  assert.equal(script.includes("function formatIntegerInput"), true);
  assert.equal(script.includes("function readFormattedIntegerInput"), true);
  assert.equal(script.includes('profileFields.additionalMesoCost.addEventListener("input"'), true);
  assert.equal(script.includes("applyAdditionalMesoCost("), true);
  assert.equal(script.includes('profileFields.additionalMesoCost.value = "0"'), true);
  assert.equal(
    script.includes("profileFields.additionalMesoCost.value = formatInteger(profile.source?.additionalMesoCost ?? 0)"),
    true,
  );
});

test("planner cubing stat changes are open and named plainly", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(html.includes("cubing-config-panel"), true);
  assert.match(html, /<h3[^>]*>Cubing target<\/h3>/);
  assert.equal(html.includes("cubing-target-grid"), true);
  assert.equal(html.includes('<details class="stat-gain-details" open>'), true);
  assert.equal(html.includes("<summary>Stat changes</summary>"), true);
  assert.equal(html.includes("profile-cubing-stat-gains"), true);
  assert.match(css, /\.cubing-config-panel\s*\{[\s\S]*?border: 1px solid #dbe1ea/s);
  assert.match(css, /\.planner-panel\s*\{[\s\S]*?max-width: 1280px/s);
  assert.match(
    css,
    /\.planner-grid\s*\{[\s\S]*?grid-template-columns: minmax\(360px, 400px\) minmax\(760px, 1fr\)/s,
  );
  assert.match(css, /\.planner-grid\s*\{[^}]*align-items: start/s);
  assert.match(css, /\.cubing-target-grid\s*\{[\s\S]*?grid-template-columns: minmax\(120px, 0\.8fr\) minmax\(220px, 1\.4fr\)/s);
});

test("planner save upgrade shows automatic star-force stat changes", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(html.includes("Star Force stat changes"), true);
  assert.equal(html.includes('id="profile-sf-auto-gains"'), true);
  assert.equal(script.includes("calculateStarforceStatGains"), true);
  assert.equal(script.includes("expandClassStatGains"), true);
  assert.equal(script.includes("className: statEquivalenceClass.value"), true);
  assert.equal(script.includes("renderProfileStarforceGains"), true);
  assert.equal(script.includes("getStarforceGainSummaryItems"), true);
  assert.equal(script.includes("renderStatChangeChips"), true);
  assert.equal(script.includes('className: "stat-change-chip"'), true);
  assert.equal(script.includes("profileFields.itemLevel.addEventListener"), true);
  assert.equal(script.includes("profileFields.targetStar.addEventListener"), true);
  assert.equal(script.includes("statEquivalenceClass.addEventListener(\"change\""), true);
  assert.match(css, /\.stat-change-list\s*\{[\s\S]*?display: flex/s);
  assert.match(css, /\.stat-change-chip\s*\{[\s\S]*?color: var\(--accent-soft-text\)/s);
  assert.match(css, /\.stat-change-chip\s*\{[\s\S]*?font-size: 0\.78rem/s);
  assert.match(css, /\.stat-change-chip\s*\{[\s\S]*?font-weight: 900/s);
});

test("planner SF target shows automatic star-force stat changes", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(html.includes('id="optimizer-sf-auto-gains"'), true);
  assert.equal(script.includes("optimizerSfAutoGains"), true);
  assert.equal(script.includes("renderOptimizerStarforceGains"), true);
  assert.equal(script.includes("renderStarforceGainSummary"), true);
  assert.equal(script.includes("optimizerFields.itemType.addEventListener"), true);
  assert.equal(script.includes("optimizerFields.itemLevel.addEventListener"), true);
  assert.equal(script.includes("optimizerFields.startStar.addEventListener"), true);
  assert.equal(script.includes("optimizerFields.targetStar.addEventListener"), true);
});

test("planner saved upgrades show cost and strategy without p50/p75 controls", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(html.includes("<th>p50</th>"), false);
  assert.equal(html.includes("<th>p75</th>"), false);
  assert.equal(html.includes("benchmark-percentile"), false);
  assert.equal(html.includes("<th>Strategy</th>"), true);
  assert.equal(html.includes("Expected"), true);
  assert.equal(html.includes("85% odds"), true);
  assert.equal(html.includes("<th>Spare count</th>"), false);
  assert.equal(html.includes("<th>Cost</th>"), false);
  assert.equal(html.includes("<th>p95 meso</th>"), false);
  assert.equal(script.includes("formatSavedExpected(profile)"), true);
  assert.equal(script.includes("formatSavedTargetOdds(profile)"), true);
  assert.equal(script.includes("targetOddsMeso"), true);
  assert.equal(script.includes("${formatInteger(requiredSpares)} spares"), true);
  assert.equal(script.includes("Saved. Strategy:"), true);
  assert.equal(script.includes("source?.percentileCosts?.strategy"), true);
  assert.equal(script.includes("showBaseSuffix: false"), true);
  assert.equal(script.includes("formatSavedSpareCount(profile)"), false);
  assert.equal(script.includes("spareCount: Number(profileFields.spareCount.value)"), true);
  assert.equal(script.includes("spareCount: Number(optimizerFields.spareCount.value)"), false);
  assert.equal(html.includes("saved-upgrades-table"), true);
  assert.match(css, /\.saved-upgrades-table\s*\{[^}]*min-width: 0/s);
  assert.match(css, /\.saved-upgrades-table\s*\{[^}]*table-layout: fixed/s);
  assert.match(css, /\.saved-upgrades-table th,[\s\S]*?\.saved-upgrades-table td\s*\{[\s\S]*?white-space: normal/s);
});

test("planner saved upgrades can sort by efficiency and costs", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(html.includes('data-profile-sort="expected"'), true);
  assert.equal(html.includes('data-profile-sort="fdGain"'), true);
  assert.equal(html.includes('data-profile-sort="targetOdds"'), true);
  assert.equal(html.includes('data-profile-sort="fdPerMesoP95"'), true);
  assert.equal(script.includes('const profileSortButtons = document.querySelectorAll("[data-profile-sort]")'), true);
  assert.equal(script.includes('key: "fdPerMesoP95", direction: "desc"'), true);
  assert.equal(script.includes("function getSortedProfileMetrics"), true);
  assert.equal(script.includes("profileSortButtons.forEach"), true);
  assert.equal(script.includes("aria-sort"), true);
  assert.match(css, /\.sort-button\s*\{[\s\S]*?cursor: pointer/s);
  assert.match(css, /\.sort-indicator\s*\{[\s\S]*?font-size: 0\.68rem/s);
});

test("planner saved upgrade actions stack clone and edit with compact delete", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(html.includes('class="delete-action-heading"'), true);
  assert.equal(html.includes('class="visually-hidden">Delete'), true);
  assert.equal(script.includes('data-action="clone"'), true);
  assert.equal(script.includes('class="action-stack"'), true);
  assert.equal(script.includes('class="delete-action-cell"'), true);
  assert.equal(script.includes('class="icon-danger-button"'), true);
  assert.equal(script.includes('aria-label="Delete'), true);
  assert.equal(script.includes('button.dataset.action === "clone"'), true);
  assert.equal(script.includes('window.confirm(`Delete "${profile.name}"?`)'), true);
  assert.equal(script.includes('profileForm.dataset.editingId = ""'), true);
  assert.ok(script.indexOf('data-action="edit"') < script.indexOf('data-action="clone"'));
  assert.match(css, /\.saved-upgrades-table th:nth-child\(8\),[\s\S]*?\.saved-upgrades-table td:nth-child\(8\)\s*\{[\s\S]*?width: 4%/s);
  assert.match(css, /\.delete-action-heading,[\s\S]*?\.delete-action-cell\s*\{/);
  assert.match(css, /\.visually-hidden\s*\{/);
  assert.match(css, /\.action-stack\s*\{/);
  assert.match(css, /\.icon-danger-button\s*\{/);
  assert.match(css, /\.icon-danger-button\s*\{[\s\S]*?background: transparent/s);
  assert.match(css, /\.icon-danger-button\s*\{[\s\S]*?border: 0/s);
});

test("planner can clear all saved upgrades with confirmation", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(html.includes('id="profile-clear-all"'), true);
  assert.equal(html.includes('id="profile-restore-recommended"'), true);
  assert.equal(html.includes("Clear saved upgrades"), true);
  assert.equal(html.includes("Restore recommended"), true);
  assert.equal(script.includes('const profileClearAll = document.querySelector("#profile-clear-all")'), true);
  assert.equal(
    script.includes('const profileRestoreRecommended = document.querySelector("#profile-restore-recommended")'),
    true,
  );
  assert.equal(script.includes("profileClearAll.disabled = metrics.length === 0"), true);
  assert.equal(script.includes("window.confirm"), true);
  assert.equal(script.includes("Clear all saved upgrades?"), true);
  assert.equal(script.includes("Replace saved upgrades with the recommended starter list?"), true);
  assert.equal(script.includes("getRecommendedProfiles()"), true);
  assert.equal(script.includes("profiles = [];"), true);
  assert.equal(script.includes("saveProfiles(undefined, profiles);"), true);
  assert.equal(script.includes("setMessage(profileMessage, \"Cleared saved upgrades.\")"), true);
  assert.equal(
    script.includes("setMessage(profileMessage, \"Restored recommended saved upgrades.\")"),
    true,
  );
});

test("planner refreshes saved upgrade efficiency when manual stat values change", () => {
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(script.includes("function updateLiveStatEquivalence"), true);
  assert.equal(script.includes('statRows.addEventListener("input"'), true);
  assert.equal(script.includes("updateLiveStatEquivalence();"), true);
  assert.equal(script.includes('statEquivalenceForm.addEventListener("submit"'), false);
  assert.equal(script.includes("persist: true"), false);
  assert.equal(script.includes("renderProfiles();"), true);
  assert.equal(script.includes("renderBenchmarkOptions();"), true);
  assert.equal(script.includes("renderOptimizer();"), true);
});

test("planner recommendation separates recommendation and benchmark FD per 1b meso", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(html.includes("FD/1b meso"), true);
  assert.equal(html.includes("<th>FD/meso</th>"), false);
  assert.equal(html.includes("<span>Recommendation FD/1b meso</span>"), true);
  assert.equal(html.includes('id="result-fd-per-meso"'), true);
  assert.equal(html.includes("<span>Benchmark FD/1b meso</span>"), true);
  assert.equal(html.includes('id="result-benchmark-fd-per-meso"'), true);
  assert.equal(html.includes("<span>Benchmark status</span>"), true);
  assert.equal(html.includes('id="result-benchmark-status"'), true);
  assert.equal(html.includes('id="result-benchmark-outcome"'), true);
  assert.equal(html.includes("Meets benchmark"), false);
  assert.equal(html.includes('id="result-benchmark"'), false);
  assert.equal(script.includes('fdPerMeso: document.querySelector("#result-fd-per-meso")'), true);
  assert.equal(
    script.includes(
      'benchmarkFdPerMeso: document.querySelector("#result-benchmark-fd-per-meso")',
    ),
    true,
  );
  assert.equal(script.includes("resultFields.fdPerMeso.textContent = formatEfficiency(result.fdPerMeso)"), true);
  assert.equal(
    script.includes(
      "resultFields.benchmarkFdPerMeso.textContent = formatEfficiency(selectedProfile.fdPerMesoP95)",
    ),
    true,
  );
  assert.equal(script.includes("const FD_PER_BILLION_MESO = 1_000_000_000"), true);
  assert.equal(script.includes("value * FD_PER_BILLION_MESO"), true);
  assert.equal(script.includes("toFixed(5)"), true);
  assert.equal(
    script.includes('resultFields.benchmarkStatus.textContent = result.meetsBenchmark ? "Meets" : "Cannot compete"'),
    true,
  );
  assert.equal(script.includes('benchmarkOutcome: document.querySelector("#result-benchmark-outcome")'), true);
  assert.equal(script.includes('resultFields.benchmarkOutcome.textContent = result.meetsBenchmark'), true);
  assert.equal(script.includes('"Meets benchmark"'), true);
  assert.equal(script.includes('resultFields.benchmark.textContent = result.meetsBenchmark ? "Pass" : "Below"'), false);
});

test("planner optimizer includes wiki star-force stat gains in FD gain", () => {
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");

  assert.equal(script.includes("calculateStarforceFdGain"), true);
  assert.equal(script.includes("calculateStarforceFdBreakdown"), true);
  assert.equal(script.includes("itemType: optimizerFields.itemType.value"), true);
  assert.equal(script.includes("statGains: readStatGains(optimizerStatGains)"), true);
  assert.equal(script.includes('const statBreakdownRows = document.querySelector("#stat-breakdown-rows")'), true);
  assert.equal(script.includes("renderStatBreakdown(statBreakdown)"), true);
  assert.equal(html.includes('<details class="stat-breakdown-details">'), true);
  assert.equal(html.includes("<summary>FD breakdown</summary>"), true);
  assert.equal(html.includes('id="stat-breakdown-rows"'), true);
  assert.equal(html.includes('<h3 class="compact-heading">Stat breakdown</h3>'), false);
  assert.equal(html.includes("Auto SF"), true);
  assert.equal(html.includes("Manual"), true);
  assert.equal(html.includes("Net"), true);
  assert.equal(script.includes("const sfFdGain = calculateFdGain(readStatGains(optimizerStatGains), statEquivalence)"), false);
});

test("planner presents generic main and secondary stat labels", () => {
  const profileSource = readFileSync(new URL("./profiles.mjs", import.meta.url), "utf8");

  assert.equal(profileSource.includes('{ stat: "Main Stat", value: 30'), true);
  assert.equal(profileSource.includes('{ stat: "Main Stat%", value: 12'), true);
  assert.equal(profileSource.includes('{ stat: "Secondary Stat", value: 30'), true);
  assert.equal(profileSource.includes('{ stat: "Secondary Stat%", value: 12'), true);
  assert.equal(profileSource.includes('{ stat: "DEX", value: 30'), false);
  assert.equal(profileSource.includes('{ stat: "STR", value: 30'), false);
});

test("planner optimizer says when the cheapest strategy cannot compete", () => {
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(script.includes("cannot compete with"), true);
  assert.equal(script.includes("Keep ${formatInteger(result.requiredSpares)} spares"), true);
});

test("planner recommendation shows aggregate expected booms only", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(html.includes("<span>Expected booms</span>"), true);
  assert.equal(html.includes('id="result-expected-booms"'), true);
  assert.equal(html.includes("<th>Expected booms</th>"), false);
  assert.equal(script.includes('expectedBooms: document.querySelector("#result-expected-booms")'), true);
  assert.equal(
    script.includes("resultFields.expectedBooms.textContent = result.expectedBooms.toFixed(3)"),
    true,
  );
  assert.equal(script.includes("row.expectedBooms"), false);
  assert.equal(html.includes('id="result-available-spares"'), false);
  assert.equal(script.includes("availableSpares: document.querySelector"), false);
});

test("planner keeps the manual stat save button compact", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(html.includes("Save manual values"), false);
  assert.match(css, /\.compact-button\s*\{[^}]*justify-self: start/s);
  assert.match(css, /\.compact-button\s*\{[^}]*width: fit-content/s);
});

test("planner keeps save-upgrade actions compact beside wide saved tables", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(css, /\.button-row\s*\{[\s\S]*?align-items: center/s);
  assert.match(css, /\.button-row\s*\{[\s\S]*?justify-content: flex-start/s);
  assert.match(css, /\.button-row \.primary-button\s*\{[\s\S]*?max-width: 150px/s);
  assert.match(css, /\.button-row \.primary-button\s*\{[\s\S]*?white-space: normal/s);
});

test("planner accepts item type for saved and optimized SF targets", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(html.includes("profile-item-type"), true);
  assert.equal(html.includes("optimizer-item-type"), true);
  assert.equal(html.includes("<span>Item type</span>"), true);
  assert.equal(html.includes('<option value="weapon">Weapon</option>'), true);
  assert.equal(script.includes("itemType: document.querySelector"), true);
  assert.equal(script.includes("itemType: profileFields.itemType.value"), true);
  assert.equal(script.includes("profile.source?.itemType"), true);
});

test("planner uses compact columns for bounded numeric SF inputs", () => {
  const html = readFileSync(new URL("../planner.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(html.includes("three-col compact-number-grid"), true);
  assert.equal(html.includes("two-col compact-number-grid"), true);
  assert.equal(html.includes("compact-grid-hint"), true);
  assert.equal(css.includes(".three-col.compact-number-grid"), true);
  assert.equal(css.includes(".two-col.compact-number-grid"), true);
  assert.match(css, /\.compact-number-grid\s*\{[^}]*align-items: start/s);
  assert.match(css, /\.compact-grid-hint\s*\{[^}]*grid-column: 1 \/ -1/s);
  assert.equal(css.includes("width: 8ch"), true);
  assert.equal(css.includes("width: 9ch"), true);
  assert.equal(css.includes(".compact-number-grid input.meso-cost-input"), true);
  assert.match(css, /\.compact-number-grid input\.meso-cost-input\s*\{[^}]*width: 18ch/s);
  assert.equal(css.includes(".stat-gain-grid input"), true);
});

test("planner left-aligns editable input text", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(css, /\.compact-number-grid input\s*\{[^}]*text-align: left/s);
  assert.match(css, /\.stat-table input\s*\{[^}]*text-align: left/s);
  assert.match(css, /\.stat-gain-grid input\s*\{[^}]*text-align: left/s);
});

test("planner additional stat changes accept signed values", () => {
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");

  assert.equal(script.includes('from "./profiles.mjs"'), true);
  assert.match(script, /<input data-stat-gain="\$\{row\.stat\}" inputmode="decimal" step="0\.01" type="number"/);
  assert.doesNotMatch(script, /data-stat-gain="\$\{row\.stat\}"[^>]*min="0"/);
  assert.equal(script.includes("statGains: readStatGains(optimizerStatGains)"), true);
});

test("planner renders manual stat rows with text stat and value columns", () => {
  const script = readFileSync(new URL("./planner.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.equal(script.includes('data-field="stat"'), false);
  assert.equal(script.includes('data-field="value"'), false);
  assert.equal(script.includes("stat-name-cell"), true);
  assert.equal(script.includes("stat-value-cell"), true);
  assert.equal(css.includes(".stat-table input"), true);
});

test("planner clamps stat-equivalence columns to expected content widths", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(css, /\.stat-table\s*\{[^}]*table-layout: fixed/s);
  assert.match(css, /\.stat-table th:first-child,[\s\S]*?\.stat-table td:first-child\s*\{[\s\S]*?width: 18ch/s);
  assert.match(css, /\.stat-table td:nth-child\(2\),[\s\S]*?\.stat-table th:nth-child\(2\)\s*\{[\s\S]*?width: 7ch/s);
  assert.match(css, /\.stat-table td:nth-child\(3\),[\s\S]*?\.stat-table th:nth-child\(3\)\s*\{[\s\S]*?width: 12ch/s);
  assert.match(css, /\.stat-name-cell\s*\{[\s\S]*?overflow-wrap: anywhere/s);
  assert.match(css, /\.stat-name-cell\s*\{[\s\S]*?white-space: normal/s);
});

test("planner gives long stat-change labels enough room inside the save form", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(css, /\.stat-gain-grid\s*\{[\s\S]*?grid-template-columns: 1fr/s);
  assert.match(css, /\.stat-gain-grid label\s*\{[\s\S]*?grid-template-columns: minmax\(18ch, 1fr\) max-content/s);
  assert.match(css, /\.stat-gain-grid span\s*\{[\s\S]*?overflow-wrap: anywhere/s);
  assert.match(css, /\.stat-gain-grid span\s*\{[\s\S]*?white-space: normal/s);
});

test("main calculator allows star ranges past 22", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /id="start-star"[^>]*max="24"/);
  assert.match(html, /id="end-star"[^>]*max="25"/);
});
