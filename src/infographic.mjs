import { calculateBreakpointTable } from "./breakpoints.mjs";

const ITEM_LEVELS = [150, 160, 200, 250];
const grid = document.querySelector("#level-grid");

function formatInteger(value) {
  return Math.round(value).toLocaleString("en-US");
}

function createCell(text, scope) {
  const cell = document.createElement(scope ? "th" : "td");
  cell.textContent = text;
  if (scope) {
    cell.scope = scope;
  }
  return cell;
}

function createLevelCard(itemLevel) {
  const card = document.createElement("article");
  card.className = "level-card";

  const header = document.createElement("div");
  header.className = "level-card-header";
  header.innerHTML = `
    <span>Item level</span>
    <strong>${itemLevel}</strong>
  `;

  const tableWrap = document.createElement("div");
  tableWrap.className = "compact-table-wrap";
  const table = document.createElement("table");
  table.className = "breakpoint-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Spare cost</th>
        <th scope="col">Optimal</th>
        <th scope="col">Booms</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");
  for (const row of calculateBreakpointTable({ itemLevel })) {
    const tr = document.createElement("tr");
    tr.append(
      createCell(formatInteger(row.lowEndSpareCost), "row"),
      createCell(row.optimal),
      createCell(row.expectedBooms.toFixed(3)),
    );
    tbody.append(tr);
  }

  table.append(tbody);
  tableWrap.append(table);
  card.append(header, tableWrap);
  return card;
}

grid.replaceChildren(...ITEM_LEVELS.map(createLevelCard));
