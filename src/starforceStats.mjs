export const CLASS_STAT = "Class Stat";
export const ATTACK = "Attack";

const ARMOR_BRACKETS = [128, 138, 150, 160, 200, 250];
const WEAPON_BRACKETS = [128, 138, 150, 160, 200];

const ARMOR_HIGH_STAR_DELTAS = Object.freeze({
  16: {
    128: { classStat: 7, attack: 7 },
    138: { classStat: 9, attack: 8 },
    150: { classStat: 11, attack: 9 },
    160: { classStat: 13, attack: 10 },
    200: { classStat: 15, attack: 12 },
    250: { classStat: 17, attack: 14 },
  },
  17: {
    128: { classStat: 7, attack: 8 },
    138: { classStat: 9, attack: 9 },
    150: { classStat: 11, attack: 10 },
    160: { classStat: 13, attack: 11 },
    200: { classStat: 15, attack: 13 },
    250: { classStat: 17, attack: 15 },
  },
  18: {
    128: { classStat: 7, attack: 9 },
    138: { classStat: 9, attack: 10 },
    150: { classStat: 11, attack: 11 },
    160: { classStat: 13, attack: 12 },
    200: { classStat: 15, attack: 14 },
    250: { classStat: 17, attack: 16 },
  },
  19: {
    128: { classStat: 7, attack: 10 },
    138: { classStat: 9, attack: 11 },
    150: { classStat: 11, attack: 12 },
    160: { classStat: 13, attack: 13 },
    200: { classStat: 15, attack: 15 },
    250: { classStat: 17, attack: 17 },
  },
  20: {
    128: { classStat: 7, attack: 11 },
    138: { classStat: 9, attack: 12 },
    150: { classStat: 11, attack: 13 },
    160: { classStat: 13, attack: 14 },
    200: { classStat: 15, attack: 16 },
    250: { classStat: 17, attack: 18 },
  },
  21: {
    138: { classStat: 9, attack: 13 },
    150: { classStat: 11, attack: 14 },
    160: { classStat: 13, attack: 15 },
    200: { classStat: 15, attack: 17 },
    250: { classStat: 17, attack: 19 },
  },
  22: {
    138: { classStat: 9, attack: 15 },
    150: { classStat: 11, attack: 16 },
    160: { classStat: 13, attack: 17 },
    200: { classStat: 15, attack: 19 },
    250: { classStat: 17, attack: 21 },
  },
  23: {
    138: { attack: 17 },
    150: { attack: 18 },
    160: { attack: 19 },
    200: { attack: 21 },
    250: { attack: 23 },
  },
  24: {
    138: { attack: 19 },
    150: { attack: 20 },
    160: { attack: 21 },
    200: { attack: 23 },
    250: { attack: 25 },
  },
  25: {
    138: { attack: 21 },
    150: { attack: 22 },
    160: { attack: 23 },
    200: { attack: 25 },
    250: { attack: 27 },
  },
});

const WEAPON_HIGH_STAR_DELTAS = Object.freeze({
  16: {
    128: { classStat: 7, attack: 6 },
    138: { classStat: 9, attack: 7 },
    150: { classStat: 11, attack: 8 },
    160: { classStat: 13, attack: 9 },
    200: { classStat: 15, attack: 13 },
  },
  17: {
    128: { classStat: 7, attack: 6 },
    138: { classStat: 9, attack: 7 },
    150: { classStat: 11, attack: 8 },
    160: { classStat: 13, attack: 9 },
    200: { classStat: 15, attack: 13 },
  },
  18: {
    128: { classStat: 7, attack: 7 },
    138: { classStat: 9, attack: 8 },
    150: { classStat: 11, attack: 9 },
    160: { classStat: 13, attack: 10 },
    200: { classStat: 15, attack: 14 },
  },
  19: {
    128: { classStat: 7, attack: 8 },
    138: { classStat: 9, attack: 9 },
    150: { classStat: 11, attack: 10 },
    160: { classStat: 13, attack: 11 },
    200: { classStat: 15, attack: 14 },
  },
  20: {
    128: { classStat: 7, attack: 9 },
    138: { classStat: 9, attack: 10 },
    150: { classStat: 11, attack: 11 },
    160: { classStat: 13, attack: 12 },
    200: { classStat: 15, attack: 15 },
  },
  21: {
    138: { classStat: 9, attack: 11 },
    150: { classStat: 11, attack: 12 },
    160: { classStat: 13, attack: 13 },
    200: { classStat: 15, attack: 16 },
  },
  22: {
    138: { classStat: 9, attack: 12 },
    150: { classStat: 11, attack: 13 },
    160: { classStat: 13, attack: 14 },
    200: { classStat: 15, attack: 17 },
  },
  23: {
    138: { attack: 30 },
    150: { attack: 31 },
    160: { attack: 32 },
    200: { attack: 34 },
  },
  24: {
    138: { attack: 31 },
    150: { attack: 32 },
    160: { attack: 33 },
    200: { attack: 35 },
  },
  25: {
    138: { attack: 32 },
    150: { attack: 33 },
    160: { attack: 34 },
    200: { attack: 36 },
  },
});

function getBracket(itemLevel, brackets) {
  const level = Number(itemLevel);
  if (!Number.isFinite(level)) {
    throw new Error("Item level must be a finite number");
  }

  return brackets
    .filter((bracket) => level >= bracket)
    .at(-1);
}

function getLowStarClassStatDelta(star) {
  if (star >= 1 && star <= 5) {
    return 2;
  }
  if (star >= 6 && star <= 15) {
    return 3;
  }
  return 0;
}

function getLowStarGloveAttackDelta(star) {
  return [5, 7, 9, 11, 13, 14, 15].includes(star) ? 1 : 0;
}

function addGain(gains, stat, value = 0) {
  if (value > 0) {
    gains[stat] = (gains[stat] ?? 0) + value;
  }
}

function getDelta({ itemType, itemLevel, star }) {
  const normalizedType = String(itemType ?? "").toLowerCase();
  if (normalizedType === "weapon") {
    const bracket = getBracket(itemLevel, WEAPON_BRACKETS);
    return {
      classStat: getLowStarClassStatDelta(star) + (WEAPON_HIGH_STAR_DELTAS[star]?.[bracket]?.classStat ?? 0),
      attack: WEAPON_HIGH_STAR_DELTAS[star]?.[bracket]?.attack ?? 0,
    };
  }

  const bracket = getBracket(itemLevel, ARMOR_BRACKETS);
  return {
    classStat: getLowStarClassStatDelta(star) + (ARMOR_HIGH_STAR_DELTAS[star]?.[bracket]?.classStat ?? 0),
    attack:
      (ARMOR_HIGH_STAR_DELTAS[star]?.[bracket]?.attack ?? 0) +
      (normalizedType === "glove" ? getLowStarGloveAttackDelta(star) : 0),
  };
}

export function calculateStarforceStatGains({ itemType, itemLevel, startStar, targetStar }) {
  if (!Number.isInteger(Number(startStar)) || !Number.isInteger(Number(targetStar))) {
    throw new Error("Start star and target star must be integers");
  }
  if (Number(targetStar) <= Number(startStar)) {
    throw new Error("Target star must be greater than start star");
  }

  const gains = {};
  for (let star = Number(startStar) + 1; star <= Number(targetStar); star += 1) {
    const delta = getDelta({ itemType, itemLevel, star });
    addGain(gains, ATTACK, delta.attack);
    addGain(gains, CLASS_STAT, delta.classStat);
  }

  return gains;
}
