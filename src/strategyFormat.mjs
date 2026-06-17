const STAR_GROUPS = Object.freeze([
  [15, 16, 17],
  [18, 19],
  [20, 21],
]);

function isBaseMode(mode) {
  return mode === "Base" || mode === "B";
}

function formatMode(mode) {
  return isBaseMode(mode) ? "B" : String(mode);
}

function formatGroup(rows, stars) {
  const rowsByStar = new Map(rows.map((row) => [row.star, row]));
  const matchingRows = stars.map((star) => rowsByStar.get(star)).filter(Boolean);
  if (matchingRows.length === 0) {
    return null;
  }

  return matchingRows.map((row) => formatMode(row.mode)).join("");
}

export function formatStrategy(strategy = [], { showBaseSuffix = true } = {}) {
  const rows = [...strategy].sort((left, right) => left.star - right.star);
  const groupedStars = new Set(STAR_GROUPS.flat());
  const groupedParts = STAR_GROUPS.map((stars) => formatGroup(rows, stars)).filter(Boolean);
  const extraParts = rows
    .filter((row) => !groupedStars.has(row.star))
    .filter((row) => showBaseSuffix || !isBaseMode(row.mode))
    .map((row) => formatMode(row.mode));

  return [...groupedParts, extraParts.join("")].filter(Boolean).join("/");
}
