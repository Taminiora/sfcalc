// Total-spending distribution for a fixed Star Force policy. A boom pays for
// its replacement AND the entire recovery path; neither reward is averaged away.
const EULER_SHIFT = 18.4;
const EULER_ORDER = 24;
const DEFAULT_TERMS = 32;
const MAX_EXACT_CELLS = 200_000;

function gcd(left, right) {
  while (right) [left, right] = [right, left % right];
  return left;
}

export function createStarforceCostModel({ taps, startStar, replacementCostPerBoom = 0 }) {
  const means = [];
  let costUnit = 0;
  for (let star = 0; star < taps.length; star += 1) {
    const tap = taps[star];
    let recoveryMean = 0;
    for (let lower = tap.restoreStar ?? star; lower < star; lower += 1) {
      recoveryMean += means[lower];
    }
    means.push((tap.tapCost + tap.boomProbability * (replacementCostPerBoom + recoveryMean)) / tap.successRate);
    costUnit = gcd(costUnit, tap.tapCost);
  }
  if (replacementCostPerBoom) costUnit = gcd(costUnit, replacementCostPerBoom);
  return {
    taps,
    startStar,
    replacementCostPerBoom,
    costUnit,
    mean: means.slice(startStar).reduce((sum, cost) => sum + cost, 0),
    minimumCost: taps.slice(startStar).reduce((sum, tap) => sum + tap.tapCost, 0),
  };
}

function exactCostCdf(model, budgetUnits) {
  const { taps, startStar, replacementCostPerBoom, costUnit } = model;
  const size = taps.length;
  const cdf = new Float64Array((budgetUnits + 1) * size);
  const replacementUnits = replacementCostPerBoom / costUnit;
  for (let budget = 0; budget <= budgetUnits; budget += 1) {
    for (let star = 0; star < size; star += 1) {
      const tap = taps[star];
      const remaining = budget - tap.tapCost / costUnit;
      if (remaining < 0) continue;
      let probability = tap.successRate * (star + 1 === size ? 1 : cdf[remaining * size + star + 1]);
      probability += tap.failureProbability * cdf[remaining * size + star];
      if (tap.boomProbability > 0 && remaining >= replacementUnits) {
        probability += tap.boomProbability * cdf[(remaining - replacementUnits) * size + tap.restoreStar];
      }
      cdf[budget * size + star] = probability;
    }
  }
  return cdf[budgetUnits * size + startStar];
}

function sparseCostCdf(model, budget) {
  const { taps, replacementCostPerBoom, startStar } = model;
  const memo = new Map();
  const minimumCosts = new Float64Array(taps.length + 1);
  for (let star = taps.length - 1; star >= 0; star -= 1) {
    minimumCosts[star] = minimumCosts[star + 1] + taps[star].tapCost;
  }
  const limitReached = Symbol("cost-state limit");
  let visited = 0;
  function cdf(star, remaining, depth = 0) {
    if (remaining < minimumCosts[star]) return 0;
    if (star === taps.length) return 1;
    const key = `${star}:${remaining}`;
    if (memo.has(key)) return memo.get(key);
    if (++visited > MAX_EXACT_CELLS || depth > 256) throw limitReached;
    const tap = taps[star];
    const afterTap = remaining - tap.tapCost;
    let probability = tap.successRate * cdf(star + 1, afterTap, depth + 1);
    if (tap.failureProbability > 0) probability += tap.failureProbability * cdf(star, afterTap, depth + 1);
    if (tap.boomProbability > 0) probability += tap.boomProbability * cdf(tap.restoreStar, afterTap - replacementCostPerBoom, depth + 1);
    memo.set(key, probability);
    return probability;
  }
  try {
    return cdf(startStar, budget);
  } catch (error) {
    if (error !== limitReached) throw error;
    return null;
  }
}

// H_i(z) = E[exp(-z * cost to advance i -> i+1)], including repeat attempts.
// H_i = s_i / (exp(z*c_i) - f_i - b_i*exp(-z*R)*product(H_restore..H_i-1)).
// Keep 1-H separately: high-star budgets make the lower-star transforms very
// close to 1, where subtracting rounded values would amplify cancellation.
function costTransform(model, real, imaginary) {
  const { taps, startStar, replacementCostPerBoom } = model;
  const deficitsReal = new Float64Array(taps.length);
  const deficitsImaginary = new Float64Array(taps.length);
  let totalReal = 1;
  let totalImaginary = 0;
  const replacementReal = real * replacementCostPerBoom;
  const replacementImaginary = imaginary * replacementCostPerBoom;
  const replacementDecay = Math.exp(-replacementReal);
  const replacementDeficitReal = -Math.expm1(-replacementReal) +
    2 * replacementDecay * Math.sin(replacementImaginary / 2) ** 2;
  const replacementDeficitImaginary = replacementDecay * Math.sin(replacementImaginary);

  for (let star = 0; star < taps.length; star += 1) {
    const tap = taps[star];
    let recoveryReal = replacementDeficitReal;
    let recoveryImaginary = replacementDeficitImaginary;
    if (tap.boomProbability > 0) {
      for (let lower = tap.restoreStar; lower < star; lower += 1) {
        const nextReal = deficitsReal[lower];
        const nextImaginary = deficitsImaginary[lower];
        const productReal = recoveryReal * nextReal - recoveryImaginary * nextImaginary;
        const productImaginary = recoveryReal * nextImaginary + recoveryImaginary * nextReal;
        recoveryReal += nextReal - productReal;
        recoveryImaginary += nextImaginary - productImaginary;
      }
    }
    const x = real * tap.tapCost;
    const y = imaginary * tap.tapCost;
    if (x > 700) {
      deficitsReal[star] = 1;
      if (star >= startStar) return [0, 0];
      continue;
    }
    const correctionReal = (Math.expm1(x) * Math.cos(y) - 2 * Math.sin(y / 2) ** 2 +
      tap.boomProbability * recoveryReal) / tap.successRate;
    const correctionImaginary = (Math.exp(x) * Math.sin(y) +
      tap.boomProbability * recoveryImaginary) / tap.successRate;
    const denominatorReal = 1 + correctionReal;
    const norm = denominatorReal ** 2 + correctionImaginary ** 2;
    const transformReal = denominatorReal / norm;
    const transformImaginary = -correctionImaginary / norm;
    deficitsReal[star] = (correctionReal * denominatorReal + correctionImaginary ** 2) / norm;
    deficitsImaginary[star] = correctionImaginary / norm;
    if (star >= startStar) {
      const nextReal = totalReal * transformReal - totalImaginary * transformImaginary;
      totalImaginary = totalReal * transformImaginary + totalImaginary * transformReal;
      totalReal = nextReal;
    }
  }
  return [totalReal, totalImaginary];
}

// Abate-Whitt Fourier inversion with Euler summation, applied to L(z)/z (the
// Laplace transform of the CDF). See https://www.columbia.edu/~ww2040/LaplaceInversionJoC95.pdf
function invertCostTransform(model, budget, terms) {
  const real = EULER_SHIFT / 2;
  const singleTap = model.startStar === model.taps.length - 1 ? model.taps[model.startStar] : null;
  let partialSum = 0;
  let eulerSum = 0;
  let weight = 2 ** -EULER_ORDER;
  for (let k = 0; k <= terms + EULER_ORDER; k += 1) {
    const imaginary = Math.PI * k;
    let [transformReal, transformImaginary] = costTransform(model, real / budget, imaginary / budget);
    if (singleTap) {
      // Remove the large no-boom atoms before numerical inversion, then add
      // their exact geometric CDF below. This avoids ringing on short upgrades.
      const x = real * singleTap.tapCost / budget;
      const y = imaginary * singleTap.tapCost / budget;
      const denominatorReal = Math.expm1(x) * Math.cos(y) - 2 * Math.sin(y / 2) ** 2 +
        singleTap.successRate + singleTap.boomProbability;
      const denominatorImaginary = Math.exp(x) * Math.sin(y);
      const norm = denominatorReal ** 2 + denominatorImaginary ** 2;
      transformReal -= singleTap.successRate * denominatorReal / norm;
      transformImaginary += singleTap.successRate * denominatorImaginary / norm;
    }
    const value = (transformReal * real + transformImaginary * imaginary) / (real ** 2 + imaginary ** 2);
    partialSum += (k === 0 ? 0.5 : k % 2 ? -1 : 1) * value;
    if (k >= terms) {
      eulerSum += weight * partialSum;
      const j = k - terms;
      weight *= (EULER_ORDER - j) / (j + 1);
    }
  }
  return Math.exp(real) * eulerSum + (singleTap ? noBoomSingleTapCdf(singleTap, budget) : 0);
}

function noBoomSingleTapCdf(tap, budget) {
  const eventProbability = tap.successRate + tap.boomProbability;
  return tap.successRate / eventProbability *
    -Math.expm1(Math.floor(budget / tap.tapCost) * Math.log1p(-eventProbability));
}

export function calculateTotalCostCdf(model, budget, { terms = DEFAULT_TERMS } = {}) {
  if (Number.isNaN(budget)) throw new Error("Meso budget must be a number");
  if (budget < model.minimumCost) return 0;
  if (budget === Infinity) return 1;
  const onlyTap = model.taps[model.startStar];
  if (model.startStar === model.taps.length - 1) {
    const earliestBoomCost = onlyTap.boomProbability === 0 ? Infinity : onlyTap.tapCost +
      model.replacementCostPerBoom + model.taps.slice(onlyTap.restoreStar).reduce((sum, tap) => sum + tap.tapCost, 0);
    if (budget < earliestBoomCost) {
      return noBoomSingleTapCdf(onlyTap, budget);
    }
  }
  const budgetUnits = Math.floor(budget / model.costUnit);
  if ((budgetUnits + 1) * model.taps.length <= MAX_EXACT_CELLS) {
    return exactCostCdf(model, budgetUnits);
  }
  // Low-star distributions have visible jumps. Enumerating their affordable
  // paths avoids Fourier ringing at those jumps without allocating a meso grid.
  if (model.startStar >= 12 && model.startStar < model.taps.length - 1 && model.taps.length <= 18) {
    const exactProbability = sparseCostCdf(model, budget);
    if (exactProbability !== null) return exactProbability;
  }
  const probability = invertCostTransform(model, budget, terms);
  if (!Number.isFinite(probability)) throw new Error("Total-cost CDF did not converge");
  return Math.max(0, Math.min(1, probability));
}

export function findTotalCostPercentile(model, probability, { upperBound, terms = DEFAULT_TERMS } = {}) {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new Error("Target odds must be greater than 0% and less than 100%");
  }
  let low = model.minimumCost;
  if (calculateTotalCostCdf(model, low, { terms }) >= probability) return low;
  let high = upperBound ?? Math.max(model.mean, low);
  while (calculateTotalCostCdf(model, high, { terms }) < probability) high *= 2;
  for (let iteration = 0; iteration < 40 && high - low > Math.max(model.costUnit, high * 1e-6); iteration += 1) {
    const mid = (low + high) / 2;
    if (calculateTotalCostCdf(model, mid, { terms }) >= probability) high = mid;
    else low = mid;
  }
  const roundedDown = Math.floor(high / model.costUnit) * model.costUnit;
  return calculateTotalCostCdf(model, roundedDown, { terms }) >= probability
    ? roundedDown
    : roundedDown + model.costUnit;
}
