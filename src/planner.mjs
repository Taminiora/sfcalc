import {
  calculateCubingProfileCosts,
  getCubingStrategyOptions,
} from "./cubing.mjs?v=20260617-cd-hat-options";
import {
  CLASS_NAMES,
  parseScouterFinalDamageTable,
} from "./statEquivalenceParser.mjs";
import { calculateStarforceStatGains } from "./starforceStats.mjs";
import {
  DEFAULT_STAT_EQUIVALENCE_CLASS,
  applyAdditionalMesoCost,
  calculateStarforceFdBreakdown,
  calculateStarforceFdGain,
  deriveProfileMetrics,
  expandClassStatGains,
  getRecommendedProfiles,
  loadProfiles,
  loadStatEquivalence,
  loadStatEquivalencePresets,
  saveProfiles,
  saveStatEquivalence,
  saveStatEquivalencePresets,
  validateProfileInput,
  validateStatEquivalenceInput,
  validateStatEquivalencePresetInput,
} from "./profiles.mjs";
import {
  calculateStarforceProfileCosts,
  formatStarforceStrategyForSource,
  optimizeStarforce,
} from "./plannerStarforce.mjs?v=20260619-reachable-strategy-display";
import { formatStrategy } from "./strategyFormat.mjs?v=20260617-strategy-display";

const tabs = document.querySelectorAll("[data-tab]");
const panels = document.querySelectorAll("[data-panel]");
const themeToggle = document.querySelector("#theme-toggle");
const statEquivalenceForm = document.querySelector("#stat-equivalence-form");
const statEquivalenceClass = document.querySelector("#stat-equivalence-class");
const statEquivalencePaste = document.querySelector("#stat-equivalence-paste");
const statEquivalenceParse = document.querySelector("#stat-equivalence-parse");
const statEquivalencePreset = document.querySelector("#stat-equivalence-preset");
const statEquivalencePresetName = document.querySelector("#stat-equivalence-preset-name");
const statEquivalencePresetSave = document.querySelector("#stat-equivalence-preset-save");
const statEquivalencePresetLoad = document.querySelector("#stat-equivalence-preset-load");
const statEquivalencePresetDelete = document.querySelector("#stat-equivalence-preset-delete");
const statRows = document.querySelector("#stat-equivalence-rows");
const statEquivalenceMessage = document.querySelector("#stat-equivalence-message");
const profileForm = document.querySelector("#profile-form");
const profileRows = document.querySelector("#profile-rows");
const profileEmpty = document.querySelector("#profile-empty");
const profileMessage = document.querySelector("#profile-message");
const profileReset = document.querySelector("#profile-reset");
const profileClearAll = document.querySelector("#profile-clear-all");
const profileRestoreRecommended = document.querySelector("#profile-restore-recommended");
const profileSortButtons = document.querySelectorAll("[data-profile-sort]");
const profileSfAutoGains = document.querySelector("#profile-sf-auto-gains");
const profileStatGains = document.querySelector("#profile-stat-gains");
const profileCubingStatGains = document.querySelector("#profile-cubing-stat-gains");
const benchmarkProfileSelect = document.querySelector("#benchmark-profile");
const optimizerForm = document.querySelector("#optimizer-form");
const optimizerMessage = document.querySelector("#optimizer-message");
const optimizerContext = document.querySelector("#optimizer-context");
const optimizerSfAutoGains = document.querySelector("#optimizer-sf-auto-gains");
const optimizerStatGains = document.querySelector("#optimizer-stat-gains");
const strategyRows = document.querySelector("#strategy-rows");
const statBreakdownRows = document.querySelector("#stat-breakdown-rows");

const profileFields = {
  upgradeType: document.querySelector("#profile-upgrade-type"),
  name: document.querySelector("#profile-name"),
  sfFields: document.querySelector("#profile-sf-fields"),
  cubingFields: document.querySelector("#profile-cubing-fields"),
  itemType: document.querySelector("#profile-item-type"),
  itemLevel: document.querySelector("#profile-item-level"),
  startStar: document.querySelector("#profile-start-star"),
  targetStar: document.querySelector("#profile-target-star"),
  spareCount: document.querySelector("#profile-spare-count"),
  hitProbability: document.querySelector("#profile-hit-probability"),
  starCatch: document.querySelector("#profile-event-star-catch"),
  costReduction30: document.querySelector("#profile-event-cost-reduction"),
  fullCostReduction30: document.querySelector("#profile-event-full-cost-reduction"),
  boomReduction30: document.querySelector("#profile-event-boom-reduction"),
  cubingItemType: document.querySelector("#profile-cubing-item-type"),
  cubingItemLevel: document.querySelector("#profile-cubing-item-level"),
  cubeType: document.querySelector("#profile-cube-type"),
  cubeSale: document.querySelector("#profile-cube-sale"),
  cubingDesiredTier: document.querySelector("#profile-cubing-desired-tier"),
  cubingTarget: document.querySelector("#profile-cubing-target"),
  additionalMesoCost: document.querySelector("#profile-additional-meso-cost"),
  notes: document.querySelector("#profile-notes"),
};

const optimizerFields = {
  itemType: document.querySelector("#optimizer-item-type"),
  itemLevel: document.querySelector("#optimizer-item-level"),
  startStar: document.querySelector("#optimizer-start-star"),
  targetStar: document.querySelector("#optimizer-target-star"),
  hitProbability: document.querySelector("#optimizer-hit-probability"),
  starCatch: document.querySelector("#event-star-catch"),
  costReduction30: document.querySelector("#event-cost-reduction"),
  fullCostReduction30: document.querySelector("#event-full-cost-reduction"),
  boomReduction30: document.querySelector("#event-boom-reduction"),
};

const resultFields = {
  strategy: document.querySelector("#result-strategy"),
  spares: document.querySelector("#result-spares"),
  probability: document.querySelector("#result-probability"),
  total: document.querySelector("#result-total"),
  expectedBooms: document.querySelector("#result-expected-booms"),
  fdPerMeso: document.querySelector("#result-fd-per-meso"),
  benchmarkFdPerMeso: document.querySelector("#result-benchmark-fd-per-meso"),
  benchmarkStatus: document.querySelector("#result-benchmark-status"),
  benchmarkOutcome: document.querySelector("#result-benchmark-outcome"),
};

const FD_PER_BILLION_MESO = 1_000_000_000;
const THEME_STORAGE_KEY = "sfcalc.enhancementPlanner.theme.v1";

let profiles = loadProfiles();
let statEquivalence = loadStatEquivalence();
let statEquivalencePresets = loadStatEquivalencePresets();
let profileSort = { key: "fdPerMesoP95", direction: "desc" };
saveProfiles(undefined, profiles);
saveStatEquivalence(undefined, statEquivalence);
saveStatEquivalencePresets(undefined, statEquivalencePresets);
initializeTheme();

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getPreferredTheme() {
  const storedTheme = getStoredTheme();
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.checked = theme === "dark";
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme still applies for the current page when storage is unavailable.
  }
}

function initializeTheme() {
  setTheme(getPreferredTheme());
  themeToggle?.addEventListener("change", () => {
    const theme = themeToggle.checked ? "dark" : "light";
    setTheme(theme);
    saveTheme(theme);
  });
}

function formatInteger(value) {
  return Math.round(value).toLocaleString("en-US");
}

function readFormattedIntegerInput(input) {
  const rawValue = String(input.value ?? "").replace(/,/g, "").trim();
  return rawValue ? Number(rawValue) : 0;
}

function formatIntegerInput(input) {
  const digits = String(input.value ?? "").replace(/[^\d]/g, "");
  input.value = digits ? formatInteger(Number(digits)) : "";
}

function formatCompactMeso(value) {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}b`;
  }
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  return formatInteger(value);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatFd(value) {
  return `${value.toFixed(3)}%`;
}

function formatSignedFd(value) {
  if (value === 0) {
    return "0.000%";
  }
  return `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(3)}%`;
}

function formatSignedStat(value) {
  if (value === 0) {
    return "0";
  }
  const absValue = Math.abs(value);
  const formatted = Number.isInteger(absValue)
    ? formatInteger(absValue)
    : absValue.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function getSignedClass(value) {
  if (value > 0) {
    return "signed-value positive";
  }
  if (value < 0) {
    return "signed-value negative";
  }
  return "signed-value neutral";
}

function formatEfficiency(value) {
  return (value * FD_PER_BILLION_MESO).toFixed(5);
}

function setMessage(element, message) {
  element.textContent = message;
}

function readStatRows() {
  return [...statRows.querySelectorAll("tr")].map((row) => ({
    stat: row.dataset.stat,
    value: row.dataset.value,
    finalDamagePercent: row.querySelector("[data-field='finalDamagePercent']").value,
  }));
}

function readStatGains(container) {
  return Object.fromEntries(
    [...container.querySelectorAll("[data-stat-gain]")].map((input) => [
      input.dataset.statGain,
      input.value,
    ]),
  );
}

function setStatGains(container, statGains = {}) {
  for (const input of container.querySelectorAll("[data-stat-gain]")) {
    input.value = statGains[input.dataset.statGain] ?? "";
  }
}

function getActiveProfileStatGains() {
  return profileFields.upgradeType.value === "cubing"
    ? readStatGains(profileCubingStatGains)
    : readStatGains(profileStatGains);
}

function renderCubingTargetOptions(selectedValue = profileFields.cubingTarget.value) {
  const options = getCubingStrategyOptions({
    itemType: profileFields.cubingItemType.value,
    itemLevel: Number(profileFields.cubingItemLevel.value),
    desiredTier: profileFields.cubingDesiredTier.value,
  });
  const groupedOptions = new Map();
  for (const strategy of options) {
    const groupLabel = strategy.group ?? "Target strategies";
    groupedOptions.set(groupLabel, [...(groupedOptions.get(groupLabel) ?? []), strategy]);
  }
  profileFields.cubingTarget.replaceChildren(
    ...[...groupedOptions.entries()].map(([label, strategies]) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = label;
      optgroup.append(
        ...strategies.map((strategy) => {
          const option = document.createElement("option");
          option.value = strategy.value;
          option.textContent = strategy.label;
          return option;
        }),
      );
      return optgroup;
    }),
  );

  const optionElements = [...profileFields.cubingTarget.options];
  const fallbackValue = getDefaultCubingTargetValue(options);
  if (optionElements.some((option) => option.value === selectedValue)) {
    profileFields.cubingTarget.value = selectedValue;
  } else if (fallbackValue && optionElements.some((option) => option.value === fallbackValue)) {
    profileFields.cubingTarget.value = fallbackValue;
  }
}

function getDefaultCubingTargetValue(options) {
  const attackTargets = options
    .filter((option) => option.value.startsWith("percAtt+"))
    .map((option) => ({
      ...option,
      amount: Number(option.value.split("+")[1]),
    }))
    .filter((option) => Number.isFinite(option.amount));
  if (attackTargets.length > 0) {
    return attackTargets.reduce((best, option) => (option.amount > best.amount ? option : best)).value;
  }
  return options[0]?.value ?? "";
}

function getSelectedCubingStrategyLabel() {
  return profileFields.cubingTarget.selectedOptions[0]?.textContent ?? profileFields.cubingTarget.value;
}

function normalizeCubingItemTypeForForm(itemType) {
  return itemType === "armor" ? "top" : itemType;
}

function renderProfileMode() {
  const isCubing = profileFields.upgradeType.value === "cubing";
  profileFields.sfFields.classList.toggle("hidden", isCubing);
  profileFields.cubingFields.classList.toggle("hidden", !isCubing);
  renderProfileStarforceGains();
}

function getProfileEvents() {
  return {
    starCatch: profileFields.starCatch.checked,
    costReduction30: profileFields.costReduction30.checked,
    fullCostReduction30: profileFields.fullCostReduction30.checked,
    boomReduction30: profileFields.boomReduction30.checked,
  };
}

function getOptimizerEvents() {
  return {
    starCatch: optimizerFields.starCatch.checked,
    costReduction30: optimizerFields.costReduction30.checked,
    fullCostReduction30: optimizerFields.fullCostReduction30.checked,
    boomReduction30: optimizerFields.boomReduction30.checked,
  };
}

function renderStatRows() {
  statRows.replaceChildren(
    ...statEquivalence.rows.map((row) => {
      const tr = document.createElement("tr");
      tr.dataset.stat = row.stat;
      tr.dataset.value = String(row.value);
      tr.innerHTML = `
        <td class="stat-name-cell">${row.stat}</td>
        <td class="stat-value-cell">${row.value}</td>
        <td><input data-field="finalDamagePercent" inputmode="decimal" min="0" step="0.001" type="number" value="${row.finalDamagePercent}"></td>
      `;
      return tr;
    }),
  );
}

function formatClassName(className) {
  return className
    .split("_")
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatItemTypeName(itemType) {
  return String(itemType ?? "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getDefaultProfileName({ isCubing, source }) {
  if (isCubing) {
    return `${formatItemTypeName(source.itemType)}: ${source.targetLabel ?? source.target}`;
  }

  return `${source.startStar}★ → ${source.targetStar}★ level ${source.itemLevel} ${source.itemType} (${formatSpareCount(source.spareCount)})`;
}

function formatSpareCount(spareCount) {
  const count = Number(spareCount);
  const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  const label = normalizedCount === 1 ? "spare" : "spares";
  return `${formatInteger(normalizedCount)} ${label}`;
}

function getProfileName({ isCubing, source }) {
  return profileFields.name.value.trim() || getDefaultProfileName({ isCubing, source });
}

function renderClassOptions() {
  const selectedValue =
    statEquivalence.className || statEquivalenceClass.value || DEFAULT_STAT_EQUIVALENCE_CLASS;
  statEquivalenceClass.replaceChildren(
    ...CLASS_NAMES.map((className) => {
      const option = document.createElement("option");
      option.value = className;
      option.textContent = formatClassName(className);
      return option;
    }),
  );

  if ([...statEquivalenceClass.options].some((option) => option.value === selectedValue)) {
    statEquivalenceClass.value = selectedValue;
  }
}

function getSelectedStatEquivalencePreset() {
  return statEquivalencePresets.find((preset) => preset.id === statEquivalencePreset.value);
}

function syncStatEquivalencePresetControls() {
  const hasSelection = Boolean(getSelectedStatEquivalencePreset());
  statEquivalencePresetLoad.disabled = !hasSelection;
  statEquivalencePresetDelete.disabled = !hasSelection;
}

function renderStatEquivalencePresetOptions(selectedValue = statEquivalencePreset.value) {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = statEquivalencePresets.length > 0 ? "Select preset" : "No presets";

  statEquivalencePreset.replaceChildren(
    placeholder,
    ...statEquivalencePresets.map((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name;
      return option;
    }),
  );

  if (statEquivalencePresets.some((preset) => preset.id === selectedValue)) {
    statEquivalencePreset.value = selectedValue;
  } else {
    statEquivalencePreset.value = "";
  }
  syncStatEquivalencePresetControls();
}

function renderStatGains(container, defaultValues = {}) {
  container.replaceChildren(
    ...statEquivalence.rows.map((row) => {
      const label = document.createElement("label");
      label.innerHTML = `
        <span>${row.stat}</span>
        <input data-stat-gain="${row.stat}" inputmode="decimal" step="0.01" type="number" value="${defaultValues[row.stat] ?? ""}">
      `;
      return label;
    }),
  );
}

function getStarforceGainSummaryItems(entries) {
  if (entries.length === 0) {
    return [{ className: "stat-change-chip empty", text: "No star-only stat changes" }];
  }

  return entries.map(([stat, value]) => ({
    className: "stat-change-chip",
    text: `${formatSignedStat(value)} ${stat}`,
  }));
}

function renderStatChangeChips(element, items) {
  element.replaceChildren(
    ...items.map((item) => {
      const chip = document.createElement("span");
      chip.className = item.className;
      chip.textContent = item.text;
      return chip;
    }),
  );
}

function renderStarforceGainSummary(element, input) {
  try {
    const gains = calculateStarforceStatGains(input);
    const entries = Object.entries(
      expandClassStatGains(gains, {
        ...statEquivalence,
        className: statEquivalenceClass.value,
      }),
    );
    renderStatChangeChips(element, getStarforceGainSummaryItems(entries));
  } catch (error) {
    renderStatChangeChips(element, [{ className: "stat-change-chip error", text: error.message }]);
  }
}

function renderProfileStarforceGains() {
  if (profileFields.upgradeType.value === "cubing") {
    return;
  }

  renderStarforceGainSummary(profileSfAutoGains, {
    itemType: profileFields.itemType.value,
    itemLevel: Number(profileFields.itemLevel.value),
    startStar: Number(profileFields.startStar.value),
    targetStar: Number(profileFields.targetStar.value),
  });
}

function renderOptimizerStarforceGains() {
  renderStarforceGainSummary(optimizerSfAutoGains, {
    itemType: optimizerFields.itemType.value,
    itemLevel: Number(optimizerFields.itemLevel.value),
    startStar: Number(optimizerFields.startStar.value),
    targetStar: Number(optimizerFields.targetStar.value),
  });
}

function getProfileMetrics() {
  return profiles.map((profile) => deriveProfileMetrics(profile, statEquivalence));
}

function getSavedExpectedSortValue(profile) {
  const costs = profile.source?.percentileCosts ?? {};
  if (profile.type === "cubing") {
    return Number(costs.expectedCost);
  }
  return Number(costs.expectedMeso ?? profile.p95Cost);
}

function getSavedTargetOddsSortValue(profile) {
  const costs = profile.source?.percentileCosts ?? {};
  if (profile.type === "cubing") {
    return Number(costs.p85Cost ?? profile.p95Cost);
  }
  return Number(costs.p85Cost ?? costs.expectedMeso ?? profile.p95Cost);
}

const PROFILE_SORTERS = {
  expected: getSavedExpectedSortValue,
  fdGain: (profile) => Number(profile.fdGain),
  targetOdds: getSavedTargetOddsSortValue,
  fdPerMesoP95: (profile) => Number(profile.fdPerMesoP95),
};

function compareProfileSortValues(left, right) {
  const leftIsFinite = Number.isFinite(left);
  const rightIsFinite = Number.isFinite(right);
  if (!leftIsFinite && !rightIsFinite) {
    return 0;
  }
  if (!leftIsFinite) {
    return 1;
  }
  if (!rightIsFinite) {
    return -1;
  }
  return left - right;
}

function getSortedProfileMetrics(metrics = getProfileMetrics()) {
  const getSortValue = PROFILE_SORTERS[profileSort.key] ?? PROFILE_SORTERS.fdPerMesoP95;
  const direction = profileSort.direction === "asc" ? 1 : -1;
  return [...metrics].sort((left, right) => {
    const leftValue = getSortValue(left);
    const rightValue = getSortValue(right);
    const leftIsFinite = Number.isFinite(leftValue);
    const rightIsFinite = Number.isFinite(rightValue);
    if (!leftIsFinite || !rightIsFinite) {
      const sortResult = compareProfileSortValues(leftValue, rightValue);
      return sortResult || left.name.localeCompare(right.name);
    }
    const sortResult = (leftValue - rightValue) * direction;
    if (sortResult !== 0) {
      return sortResult;
    }
    return left.name.localeCompare(right.name);
  });
}

function renderProfileSortControls() {
  profileSortButtons.forEach((button) => {
    const isActive = button.dataset.profileSort === profileSort.key;
    const indicator = button.querySelector(".sort-indicator");
    const header = button.closest("th");
    const sortLabel = profileSort.direction === "asc" ? "ascending" : "descending";
    if (indicator) {
      indicator.textContent = isActive ? (profileSort.direction === "asc" ? "▲" : "▼") : "";
    }
    if (header) {
      header.setAttribute("aria-sort", isActive ? sortLabel : "none");
    }
  });
}

function formatSavedStrategy(profile) {
  if (profile.type === "cubing") {
    return profile.source?.targetLabel ?? profile.source?.percentileCosts?.strategy ?? profile.source?.target ?? "-";
  }

  return formatStrategy(
    formatStarforceStrategyForSource(profile.source?.percentileCosts?.strategy ?? [], profile.source),
    {
    showBaseSuffix: false,
    },
  ) || "-";
}

function formatSavedExpected(profile) {
  const costs = profile.source?.percentileCosts ?? {};
  if (profile.type === "cubing") {
    const expectedCost = Number(costs.expectedCost);
    const meanCubes = Number(costs.meanCubes);
    if (!Number.isFinite(expectedCost)) {
      return "-";
    }

    return `
      <strong title="${formatInteger(expectedCost)}">${formatCompactMeso(expectedCost)}</strong>
      <span class="row-note">${Number.isFinite(meanCubes) ? meanCubes.toFixed(1) : "-"} cubes avg.</span>
    `;
  }

  const expectedMeso = Number(costs.expectedMeso ?? profile.p95Cost);
  const expectedBooms = Number(costs.expectedBooms);
  if (!Number.isFinite(expectedMeso)) {
    return "-";
  }

  return `
    <strong title="${formatInteger(expectedMeso)}">${formatCompactMeso(expectedMeso)}</strong>
    <span class="row-note">${Number.isFinite(expectedBooms) ? expectedBooms.toFixed(2) : "-"} booms avg.</span>
  `;
}

function formatSavedTargetOdds(profile) {
  const costs = profile.source?.percentileCosts ?? {};
  if (profile.type === "cubing") {
    const targetCost = Number(costs.p85Cost ?? profile.p95Cost);
    const targetCubes = Number(costs.p85Cubes ?? costs.p95Cubes);
    if (!Number.isFinite(targetCost)) {
      return "-";
    }

    return `
      <strong title="${formatInteger(targetCost)}">${formatCompactMeso(targetCost)}</strong>
      <span class="row-note">${Number.isFinite(targetCubes) ? formatInteger(targetCubes) : "-"} cubes</span>
    `;
  }

  const targetOddsMeso = Number(costs.p85Cost ?? costs.expectedMeso ?? profile.p95Cost);
  const requiredSpares = Number(costs.requiredSpares);
  const achievedProbability = Number(costs.achievedProbability);
  if (!Number.isFinite(targetOddsMeso) || !Number.isFinite(requiredSpares)) {
    return "-";
  }

  return `
    <strong title="${formatInteger(targetOddsMeso)}">${formatCompactMeso(targetOddsMeso)}</strong>
    <span class="row-note">${formatInteger(requiredSpares)} spares</span>
    <span class="row-note">${Number.isFinite(achievedProbability) ? formatPercent(achievedProbability) : "target"} odds</span>
  `;
}

function renderProfiles() {
  const metrics = getSortedProfileMetrics();
  profileEmpty.hidden = metrics.length > 0;
  profileClearAll.disabled = metrics.length === 0;
  renderProfileSortControls();
  profileRows.replaceChildren(
    ...metrics.map((profile) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <strong>${profile.name}</strong>
          <span class="row-note">${profile.type}</span>
        </td>
        <td class="strategy-cell">${formatSavedStrategy(profile)}</td>
        <td>${formatSavedExpected(profile)}</td>
        <td>${formatFd(profile.fdGain)}</td>
        <td>${formatSavedTargetOdds(profile)}</td>
        <td>${formatEfficiency(profile.fdPerMesoP95)}</td>
        <td>
          <div class="table-actions">
            <div class="action-stack">
              <button data-action="edit" data-id="${profile.id}" type="button">Edit</button>
              <button data-action="clone" data-id="${profile.id}" type="button">Clone</button>
            </div>
          </div>
        </td>
        <td class="delete-action-cell">
          <button
            aria-label="Delete ${profile.name}"
            class="icon-danger-button"
            data-action="delete"
            data-id="${profile.id}"
            title="Delete"
            type="button"
          >×</button>
        </td>
      `;
      return row;
    }),
  );
}

function renderBenchmarkOptions() {
  const selectedValue = benchmarkProfileSelect.value;
  benchmarkProfileSelect.replaceChildren(
    ...getProfileMetrics().map((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      return option;
    }),
  );

  if ([...benchmarkProfileSelect.options].some((option) => option.value === selectedValue)) {
    benchmarkProfileSelect.value = selectedValue;
  }
}

function renderEmptyOptimizer(message) {
  optimizerContext.textContent = message;
  Object.values(resultFields).forEach((field) => {
    field.textContent = "-";
  });
  resultFields.benchmarkOutcome.textContent = "No benchmark";
  resultFields.benchmarkOutcome.className = "status-pill neutral";
  renderStatBreakdown([]);
  strategyRows.replaceChildren();
}

function appendSignedCell(row, value, formatter = formatSignedStat) {
  const cell = document.createElement("td");
  const span = document.createElement("span");
  span.className = getSignedClass(value);
  span.textContent = formatter(value);
  cell.append(span);
  row.append(cell);
}

function renderStatBreakdown(rows) {
  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-state-cell";
    cell.textContent = "No stat changes";
    row.append(cell);
    statBreakdownRows.replaceChildren(row);
    return;
  }

  statBreakdownRows.replaceChildren(
    ...rows.map((breakdown) => {
      const row = document.createElement("tr");
      const statCell = document.createElement("td");
      statCell.textContent = breakdown.label;
      row.append(statCell);
      appendSignedCell(row, breakdown.automatic);
      appendSignedCell(row, breakdown.manual);
      appendSignedCell(row, breakdown.net);
      appendSignedCell(row, breakdown.fdGain, formatSignedFd);
      return row;
    }),
  );
}

function renderOptimizer() {
  try {
    const metricProfiles = getProfileMetrics();
    if (metricProfiles.length === 0) {
      renderEmptyOptimizer("Save a benchmark upgrade to begin.");
      return;
    }

    const selectedProfile =
      metricProfiles.find((profile) => profile.id === benchmarkProfileSelect.value) ?? metricProfiles[0];
    const optimizerInput = {
      itemType: optimizerFields.itemType.value,
      itemLevel: Number(optimizerFields.itemLevel.value),
      startStar: Number(optimizerFields.startStar.value),
      targetStar: Number(optimizerFields.targetStar.value),
      statGains: readStatGains(optimizerStatGains),
    };
    const statBreakdown = calculateStarforceFdBreakdown(optimizerInput, statEquivalence);
    const sfFdGain = calculateStarforceFdGain(optimizerInput, statEquivalence);
    const result = optimizeStarforce({
      itemLevel: Number(optimizerFields.itemLevel.value),
      startStar: Number(optimizerFields.startStar.value),
      targetStar: Number(optimizerFields.targetStar.value),
      sfFdGain,
      benchmarkFdPerMeso: selectedProfile.fdPerMesoP95,
      hitProbability: Number(optimizerFields.hitProbability.value) / 100,
      events: getOptimizerEvents(),
    });

    setMessage(optimizerMessage, "");
    optimizerContext.textContent = result.meetsBenchmark
      ? `Clears ${selectedProfile.name} at target odds. Keep ${formatInteger(result.requiredSpares)} spares for ${formatPercent(result.achievedProbability)} hit odds with this strategy.`
      : `Even the least conservative strategy cannot compete with ${selectedProfile.name} benchmark FD/meso.`;
    resultFields.strategy.textContent = formatStrategy(result.strategy);
    resultFields.spares.textContent = formatInteger(result.requiredSpares);
    resultFields.probability.textContent = formatPercent(result.achievedProbability);
    resultFields.total.textContent = formatCompactMeso(result.totalExpectedCost);
    resultFields.total.title = formatInteger(result.totalExpectedCost);
    resultFields.expectedBooms.textContent = result.expectedBooms.toFixed(3);
    resultFields.fdPerMeso.textContent = formatEfficiency(result.fdPerMeso);
    resultFields.benchmarkFdPerMeso.textContent = formatEfficiency(selectedProfile.fdPerMesoP95);
    resultFields.benchmarkStatus.textContent = result.meetsBenchmark ? "Meets" : "Cannot compete";
    resultFields.benchmarkOutcome.textContent = result.meetsBenchmark
      ? "Meets benchmark"
      : "Cannot compete";
    resultFields.benchmarkOutcome.className = result.meetsBenchmark
      ? "status-pill success"
      : "status-pill danger";
    renderStatBreakdown(statBreakdown);

    strategyRows.replaceChildren(
      ...result.strategy.map((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.star} - ${row.nextStar}</td>
          <td><span class="tier">${row.mode}</span></td>
          <td>${formatPercent(row.successRate)}</td>
          <td>${formatPercent(row.boomProbability)}</td>
          <td title="${formatInteger(row.expectedMeso)}">${formatCompactMeso(row.expectedMeso)}</td>
        `;
        return tr;
      }),
    );
  } catch (error) {
    setMessage(optimizerMessage, error.message);
    renderEmptyOptimizer("Fix the optimizer inputs to see a recommendation.");
  }
}

function clearProfileForm() {
  profileForm.dataset.editingId = "";
  profileFields.name.value = "";
  profileFields.upgradeType.value = "starforce";
  profileFields.itemType.value = "armor";
  profileFields.itemLevel.value = "250";
  profileFields.startStar.value = "21";
  profileFields.targetStar.value = "22";
  profileFields.spareCount.value = "6";
  profileFields.hitProbability.value = "85";
  profileFields.starCatch.checked = true;
  profileFields.costReduction30.checked = true;
  profileFields.fullCostReduction30.checked = false;
  profileFields.boomReduction30.checked = true;
  profileFields.cubingItemType.value = "weapon";
  profileFields.cubingItemLevel.value = "250";
  profileFields.cubeType.value = "red";
  profileFields.cubeSale.checked = false;
  profileFields.cubingDesiredTier.value = "legendary";
  profileFields.additionalMesoCost.value = "0";
  renderCubingTargetOptions("percAtt+39");
  profileFields.notes.value = "";
  setStatGains(profileStatGains);
  setStatGains(profileCubingStatGains);
  setMessage(profileMessage, "");
  renderProfileMode();
}

function fillProfileForm(profile) {
  profileForm.dataset.editingId = profile.id;
  profileFields.name.value = profile.name;
  profileFields.upgradeType.value = profile.type === "cubing" ? "cubing" : "starforce";
  profileFields.itemType.value = profile.source?.itemType ?? "weapon";
  profileFields.itemLevel.value = profile.source?.itemLevel ?? 250;
  profileFields.startStar.value = profile.source?.startStar ?? 21;
  profileFields.targetStar.value = profile.source?.targetStar ?? 22;
  profileFields.spareCount.value =
    profile.source?.spareCount ??
    profile.source?.percentileCosts?.availableSpares ??
    profile.source?.percentileCosts?.requiredSpares ??
    0;
  profileFields.hitProbability.value = profile.source?.hitProbability
    ? profile.source.hitProbability * 100
    : 85;
  profileFields.starCatch.checked = Boolean(profile.source?.events?.starCatch);
  profileFields.costReduction30.checked = Boolean(profile.source?.events?.costReduction30);
  profileFields.fullCostReduction30.checked = Boolean(profile.source?.events?.fullCostReduction30);
  profileFields.boomReduction30.checked = Boolean(profile.source?.events?.boomReduction30);
  profileFields.cubingItemType.value = normalizeCubingItemTypeForForm(profile.source?.itemType ?? "weapon");
  profileFields.cubingItemLevel.value = profile.source?.itemLevel ?? 250;
  profileFields.cubeType.value = profile.source?.cubeType ?? "red";
  profileFields.cubeSale.checked = Boolean(profile.source?.cubeSale);
  profileFields.cubingDesiredTier.value = profile.source?.desiredTier ?? "legendary";
  profileFields.additionalMesoCost.value = formatInteger(profile.source?.additionalMesoCost ?? 0);
  renderCubingTargetOptions(profile.source?.target ?? "percAtt+39");
  profileFields.notes.value = profile.notes;
  setStatGains(profileStatGains, profile.statGains);
  setStatGains(profileCubingStatGains, profile.statGains);
  renderProfileMode();
}

function cloneProfileForm(profile) {
  fillProfileForm(profile);
  profileForm.dataset.editingId = "";
  profileFields.name.value = `Copy of ${profile.name}`;
  setMessage(profileMessage, "Loaded a copy. Make changes, then calculate and save.");
}

function renderAll() {
  renderClassOptions();
  renderStatEquivalencePresetOptions();
  renderStatRows();
  renderStatGains(profileStatGains, readStatGains(profileStatGains));
  renderStatGains(profileCubingStatGains, readStatGains(profileCubingStatGains));
  renderStatGains(optimizerStatGains, readStatGains(optimizerStatGains));
  renderCubingTargetOptions();
  renderProfileMode();
  renderProfileStarforceGains();
  renderOptimizerStarforceGains();
  renderProfiles();
  renderBenchmarkOptions();
  renderOptimizer();
}

function renderSavedProfileDependents() {
  renderProfiles();
  renderBenchmarkOptions();
  renderOptimizer();
}

function updateLiveStatEquivalence({ statusMessage = "" } = {}) {
  try {
    statEquivalence = validateStatEquivalenceInput({
      className: statEquivalenceClass.value,
      rows: readStatRows(),
    });
    setMessage(statEquivalenceMessage, statusMessage);
    renderProfiles();
    renderBenchmarkOptions();
    renderOptimizer();
    return true;
  } catch (error) {
    setMessage(statEquivalenceMessage, error.message);
    return false;
  }
}

function getDefaultStatEquivalencePresetName() {
  return `${formatClassName(statEquivalenceClass.value || DEFAULT_STAT_EQUIVALENCE_CLASS)} preset`;
}

function saveCurrentStatEquivalencePreset() {
  if (!updateLiveStatEquivalence()) {
    return;
  }

  const selectedPreset = getSelectedStatEquivalencePreset();
  const presetName = statEquivalencePresetName.value.trim() || getDefaultStatEquivalencePresetName();
  const matchingIndex = selectedPreset
    ? statEquivalencePresets.findIndex((preset) => preset.id === selectedPreset.id)
    : statEquivalencePresets.findIndex(
        (preset) => preset.name.toLowerCase() === presetName.toLowerCase(),
      );
  const preset = validateStatEquivalencePresetInput({
    ...(matchingIndex >= 0 ? { id: statEquivalencePresets[matchingIndex].id } : {}),
    name: presetName,
    ...statEquivalence,
  });

  statEquivalencePresets =
    matchingIndex >= 0
      ? statEquivalencePresets.map((existing) => (existing.id === preset.id ? preset : existing))
      : [...statEquivalencePresets, preset];
  saveStatEquivalencePresets(undefined, statEquivalencePresets);
  renderStatEquivalencePresetOptions(preset.id);
  statEquivalencePresetName.value = preset.name;
  setMessage(statEquivalenceMessage, `Saved preset "${preset.name}".`);
}

function loadSelectedStatEquivalencePreset() {
  const preset = getSelectedStatEquivalencePreset();
  if (!preset) {
    setMessage(statEquivalenceMessage, "Choose a preset to load.");
    return;
  }

  statEquivalence = validateStatEquivalenceInput(preset);
  saveStatEquivalence(undefined, statEquivalence);
  statEquivalencePaste.value = "";
  renderAll();
  renderStatEquivalencePresetOptions(preset.id);
  statEquivalencePresetName.value = preset.name;
  setMessage(statEquivalenceMessage, `Loaded preset "${preset.name}".`);
}

function deleteSelectedStatEquivalencePreset() {
  const preset = getSelectedStatEquivalencePreset();
  if (!preset) {
    setMessage(statEquivalenceMessage, "Choose a preset to delete.");
    return;
  }

  statEquivalencePresets = statEquivalencePresets.filter((candidate) => candidate.id !== preset.id);
  saveStatEquivalencePresets(undefined, statEquivalencePresets);
  renderStatEquivalencePresetOptions();
  statEquivalencePresetName.value = "";
  setMessage(statEquivalenceMessage, `Deleted preset "${preset.name}".`);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((button) => button.classList.toggle("active", button === tab));
    panels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.panel !== tab.dataset.tab);
    });
  });
});

statEquivalenceParse.addEventListener("click", () => {
  try {
    statEquivalence = validateStatEquivalenceInput(
      parseScouterFinalDamageTable(statEquivalencePaste.value, statEquivalenceClass.value),
    );
    saveStatEquivalence(undefined, statEquivalence);
    setMessage(
      statEquivalenceMessage,
      `Loaded ${formatClassName(statEquivalence.className)} Final Damage% rows.`,
    );
    renderAll();
  } catch (error) {
    setMessage(statEquivalenceMessage, error.message);
  }
});

statEquivalencePreset.addEventListener("change", () => {
  const preset = getSelectedStatEquivalencePreset();
  statEquivalencePresetName.value = preset?.name ?? "";
  syncStatEquivalencePresetControls();
});

statEquivalencePresetSave.addEventListener("click", saveCurrentStatEquivalencePreset);
statEquivalencePresetLoad.addEventListener("click", loadSelectedStatEquivalencePreset);
statEquivalencePresetDelete.addEventListener("click", deleteSelectedStatEquivalencePreset);

statRows.addEventListener("input", () => {
  updateLiveStatEquivalence();
});

statEquivalenceClass.addEventListener("change", () => {
  updateLiveStatEquivalence();
  renderProfileStarforceGains();
  renderOptimizerStarforceGains();
});

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const editingId = profileForm.dataset.editingId || "";
    const isCubing = profileFields.upgradeType.value === "cubing";
    const additionalMesoCost = readFormattedIntegerInput(profileFields.additionalMesoCost);
    const source = isCubing
      ? {
          cubeType: profileFields.cubeType.value,
          itemType: profileFields.cubingItemType.value,
          itemLevel: Number(profileFields.cubingItemLevel.value),
          cubeSale: profileFields.cubeSale.checked,
          desiredTier: profileFields.cubingDesiredTier.value,
          target: profileFields.cubingTarget.value,
          targetLabel: getSelectedCubingStrategyLabel(),
          additionalMesoCost,
        }
      : {
          itemType: profileFields.itemType.value,
          itemLevel: Number(profileFields.itemLevel.value),
          startStar: Number(profileFields.startStar.value),
          targetStar: Number(profileFields.targetStar.value),
          spareCount: Number(profileFields.spareCount.value),
          hitProbability: Number(profileFields.hitProbability.value) / 100,
          events: getProfileEvents(),
          additionalMesoCost,
        };
    const costs = applyAdditionalMesoCost(
      isCubing ? calculateCubingProfileCosts(source) : calculateStarforceProfileCosts(source),
      additionalMesoCost,
    );
    const profile = validateProfileInput({
      id: editingId,
      name: getProfileName({ isCubing, source }),
      type: isCubing ? "cubing" : "starforce",
      statGains: getActiveProfileStatGains(),
      p50Cost: costs.p50Cost,
      p75Cost: costs.p75Cost,
      p95Cost: costs.p95Cost,
      notes: profileFields.notes.value,
      source: { ...source, percentileCosts: costs },
    });
    const strategy = isCubing ? source.targetLabel : formatStrategy(costs.strategy);

    profiles = editingId
      ? profiles.map((existingProfile) => (existingProfile.id === editingId ? profile : existingProfile))
      : [...profiles, profile];
    saveProfiles(undefined, profiles);
    clearProfileForm();
    setMessage(profileMessage, `Saved. Strategy: ${strategy}.`);
    renderProfiles();
    renderBenchmarkOptions();
    renderOptimizer();
  } catch (error) {
    setMessage(profileMessage, error.message);
  }
});

profileReset.addEventListener("click", clearProfileForm);
profileRestoreRecommended.addEventListener("click", () => {
  if (!window.confirm("Replace saved upgrades with the recommended starter list?")) {
    return;
  }

  profiles = getRecommendedProfiles();
  saveProfiles(undefined, profiles);
  renderSavedProfileDependents();
  setMessage(profileMessage, "Restored recommended saved upgrades.");
});
profileClearAll.addEventListener("click", () => {
  if (!window.confirm("Clear all saved upgrades? This cannot be undone.")) {
    return;
  }

  profiles = [];
  saveProfiles(undefined, profiles);
  renderSavedProfileDependents();
  setMessage(profileMessage, "Cleared saved upgrades.");
});
profileFields.upgradeType.addEventListener("change", renderProfileMode);
profileFields.cubingItemType.addEventListener("change", () => renderCubingTargetOptions());
profileFields.cubingItemLevel.addEventListener("input", () => renderCubingTargetOptions());
profileFields.cubingDesiredTier.addEventListener("change", () => renderCubingTargetOptions());
profileFields.itemType.addEventListener("change", renderProfileStarforceGains);
profileFields.itemLevel.addEventListener("input", renderProfileStarforceGains);
profileFields.startStar.addEventListener("input", renderProfileStarforceGains);
profileFields.targetStar.addEventListener("input", renderProfileStarforceGains);
profileFields.additionalMesoCost.addEventListener("input", () => {
  formatIntegerInput(profileFields.additionalMesoCost);
});
optimizerFields.itemType.addEventListener("change", renderOptimizerStarforceGains);
optimizerFields.itemLevel.addEventListener("input", renderOptimizerStarforceGains);
optimizerFields.startStar.addEventListener("input", renderOptimizerStarforceGains);
optimizerFields.targetStar.addEventListener("input", renderOptimizerStarforceGains);

profileSortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextKey = button.dataset.profileSort;
    profileSort = {
      key: nextKey,
      direction:
        profileSort.key === nextKey && profileSort.direction === "desc" ? "asc" : "desc",
    };
    renderProfiles();
  });
});

profileRows.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const profile = profiles.find((candidate) => candidate.id === button.dataset.id);
  if (!profile) {
    return;
  }

  if (button.dataset.action === "edit") {
    fillProfileForm(profile);
  }

  if (button.dataset.action === "clone") {
    cloneProfileForm(profile);
  }

  if (button.dataset.action === "delete") {
    if (!window.confirm(`Delete "${profile.name}"?`)) {
      return;
    }

    profiles = profiles.filter((candidate) => candidate.id !== profile.id);
    saveProfiles(undefined, profiles);
    renderProfiles();
    renderBenchmarkOptions();
    renderOptimizer();
  }
});

optimizerForm.addEventListener("input", renderOptimizer);
benchmarkProfileSelect.addEventListener("change", renderOptimizer);

renderAll();
