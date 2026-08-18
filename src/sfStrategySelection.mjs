import {
  calculateBoomDistribution,
  calculateSpareCapProbability,
  calculateSpareProbability,
  findRequiredSpares,
} from "./sfBoomProbability.mjs";
import {
  getExhaustivePolicyCandidates,
  getPrunedPolicyCandidates,
} from "./sfPolicyEvaluation.mjs";

// Strategy selection: choose which evaluated strategy to show for a benchmark,
// a spare cap, or cheapest expected meso.

function getPolicyTotalCost(policy, spareCost) {
  return policy.expectedMeso + policy.expectedBooms * spareCost;
}

function getSpareCostFrontier(candidates) {
  const frontier = [];
  let lowEndSpareCost = 0;
  let current = candidates.reduce((best, policy) =>
    policy.expectedMeso < best.expectedMeso ? policy : best,
  );

  while (current) {
    frontier.push(current);

    let nextSpareCost = Infinity;
    let nextPolicy = null;
    for (const policy of candidates) {
      if (policy.expectedBooms >= current.expectedBooms) {
        continue;
      }

      const crossover =
        (policy.expectedMeso - current.expectedMeso) /
        (current.expectedBooms - policy.expectedBooms);
      if (
        crossover > lowEndSpareCost + 1e-4 &&
        crossover < nextSpareCost &&
        getPolicyTotalCost(policy, crossover + 1) < getPolicyTotalCost(current, crossover + 1)
      ) {
        nextSpareCost = crossover;
        nextPolicy = policy;
      }
    }

    lowEndSpareCost = nextSpareCost;
    current = nextPolicy;
  }

  return frontier;
}

function getPolicyBoomResult({ policy, itemLevel, startStar, targetStar, spareCount, hitProbability }) {
  const boomDistribution = calculateBoomDistribution({
    itemLevel,
    startStar,
    targetStar,
    modeMap: policy.modeMap,
    events: policy.normalizedEvents,
  });
  const spareResult = findRequiredSpares(boomDistribution, hitProbability);
  const hasSpareCap = spareCount !== undefined;
  const achievedProbability = calculateSpareProbability(
    boomDistribution,
    hasSpareCap ? spareCount : spareResult.requiredSpares,
  );

  return {
    ...policy,
    boomDistribution,
    requiredSpares: spareResult.requiredSpares,
    achievedProbability,
    availableSpares: hasSpareCap ? spareCount : null,
    guaranteeMet: hasSpareCap ? achievedProbability + 1e-12 >= hitProbability : true,
  };
}

export function getCheapestPolicy({
  itemLevel,
  startStar,
  targetStar,
  hitProbability,
  events,
  replacementCostPerBoom = 0,
}) {
  const [candidate] = getPrunedPolicyCandidates({
    itemLevel,
    startStar,
    targetStar,
    events,
  }).sort(
    (left, right) =>
      getPolicyTotalCost(left, replacementCostPerBoom) -
      getPolicyTotalCost(right, replacementCostPerBoom),
  );

  return getPolicyBoomResult({
    policy: candidate,
    itemLevel,
    startStar,
    targetStar,
    hitProbability,
  });
}

export function getBestPolicyForBenchmark({
  itemLevel,
  startStar,
  targetStar,
  sfFdGain,
  benchmarkFdPerMeso,
  hitProbability,
  events,
  replacementCostPerBoom = 0,
}) {
  const candidates = getSpareCostFrontier(
    getPrunedPolicyCandidates({
      itemLevel,
      startStar,
      targetStar,
      events,
    }),
  );
  const [leastConservative] = [...candidates].sort(
    (left, right) =>
      getPolicyTotalCost(left, replacementCostPerBoom) -
      getPolicyTotalCost(right, replacementCostPerBoom),
  );
  const leastConservativeCost = getPolicyTotalCost(leastConservative, replacementCostPerBoom);
  const leastConservativeFdPerMeso = sfFdGain / leastConservativeCost;

  if (leastConservativeFdPerMeso + 1e-18 < benchmarkFdPerMeso) {
    return getPolicyBoomResult({
      policy: leastConservative,
      itemLevel,
      startStar,
      targetStar,
      hitProbability,
    });
  }

  const [bestConservative] = candidates
    .filter(
      (candidate) =>
        sfFdGain / getPolicyTotalCost(candidate, replacementCostPerBoom) + 1e-18 >=
        benchmarkFdPerMeso,
    )
    .sort(
      (left, right) =>
        left.expectedBooms - right.expectedBooms ||
        getPolicyTotalCost(left, replacementCostPerBoom) -
          getPolicyTotalCost(right, replacementCostPerBoom),
    );

  return getPolicyBoomResult({
    policy: bestConservative,
    itemLevel,
    startStar,
    targetStar,
    hitProbability,
  });
}

export function getBestPolicyForSpareCount({
  itemLevel,
  startStar,
  targetStar,
  spareCount,
  hitProbability,
  events,
  replacementCostPerBoom = 0,
}) {
  const candidates = getExhaustivePolicyCandidates({
    itemLevel,
    startStar,
    targetStar,
    events,
  }).sort(
    (left, right) =>
      getPolicyTotalCost(left, replacementCostPerBoom) -
      getPolicyTotalCost(right, replacementCostPerBoom),
  );
  let bestFallback = null;

  for (const candidate of candidates) {
    const achievedProbability = calculateSpareCapProbability({
      itemLevel,
      startStar,
      targetStar,
      modeMap: candidate.modeMap,
      events: candidate.normalizedEvents,
      spareCount,
    });
    const candidateResult = {
      ...candidate,
      achievedProbability,
      guaranteeMet: achievedProbability + 1e-12 >= hitProbability,
    };

    if (candidateResult.guaranteeMet) {
      return getPolicyBoomResult({
        policy: candidate,
        itemLevel,
        startStar,
        targetStar,
        spareCount,
        hitProbability,
      });
    }

    if (
      !bestFallback ||
      candidateResult.achievedProbability > bestFallback.achievedProbability + 1e-12 ||
      (Math.abs(candidateResult.achievedProbability - bestFallback.achievedProbability) < 1e-12 &&
        (candidateResult.expectedBooms < bestFallback.expectedBooms - 1e-12 ||
          (Math.abs(candidateResult.expectedBooms - bestFallback.expectedBooms) < 1e-12 &&
            getPolicyTotalCost(candidateResult, replacementCostPerBoom) <
              getPolicyTotalCost(bestFallback, replacementCostPerBoom))))
    ) {
      bestFallback = candidateResult;
    }
  }

  return getPolicyBoomResult({
    policy: bestFallback,
    itemLevel,
    startStar,
    targetStar,
    spareCount,
    hitProbability,
  });
}
