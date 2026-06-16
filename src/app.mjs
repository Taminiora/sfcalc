import { calculateRange } from "./starforce.mjs";

const form = document.querySelector("#calculator-form");
const itemLevelInput = document.querySelector("#item-level");
const startStarInput = document.querySelector("#start-star");
const endStarInput = document.querySelector("#end-star");
const spareCostInput = document.querySelector("#spare-cost");
const errorMessage = document.querySelector("#error-message");
const expectedBooms = document.querySelector("#expected-booms");
const expectedMeso = document.querySelector("#expected-meso");
const expectedTotal = document.querySelector("#expected-total");
const resultRows = document.querySelector("#result-rows");

function parseMeso(value) {
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") {
    return 0;
  }
  return Number(normalized);
}

function formatInteger(value) {
  return Math.round(value).toLocaleString("en-US");
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

function renderRows(rows) {
  resultRows.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.star} - ${row.nextStar}</td>
        <td><span class="tier">${row.bestTier.id}</span></td>
        <td>${formatPercent(row.successRate)}</td>
        <td>${formatPercent(row.boomProbability)}</td>
        <td title="${formatInteger(row.tapCost)}">${formatCompactMeso(row.tapCost)}</td>
        <td>${row.expectedBooms.toFixed(3)}</td>
        <td title="${formatInteger(row.expectedMeso)}">${formatCompactMeso(row.expectedMeso)}</td>
        <td title="${formatInteger(row.expectedTotal)}">${formatCompactMeso(row.expectedTotal)}</td>
      `;
      return tr;
    }),
  );
}

function render() {
  try {
    const result = calculateRange({
      itemLevel: Number(itemLevelInput.value),
      startStar: Number(startStarInput.value),
      endStar: Number(endStarInput.value),
      spareCost: parseMeso(spareCostInput.value),
    });

    errorMessage.textContent = "";
    expectedBooms.textContent = result.expectedBooms.toFixed(3);
    expectedMeso.textContent = formatCompactMeso(result.expectedMeso);
    expectedMeso.title = formatInteger(result.expectedMeso);
    expectedTotal.textContent = formatCompactMeso(result.expectedTotal);
    expectedTotal.title = formatInteger(result.expectedTotal);
    renderRows(result.rows);
  } catch (error) {
    errorMessage.textContent = error.message;
    expectedBooms.textContent = "-";
    expectedMeso.textContent = "-";
    expectedTotal.textContent = "-";
    resultRows.replaceChildren();
  }
}

form.addEventListener("input", render);
spareCostInput.addEventListener("blur", () => {
  const meso = parseMeso(spareCostInput.value);
  if (Number.isFinite(meso)) {
    spareCostInput.value = formatInteger(meso);
  }
});

render();
