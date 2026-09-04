# Astra total-cost probabilities

Astra uses level 200 tap costs and a 1,000,000,000 meso replacement after each
destruction. There is no inventory limit. For a fixed strategy, let M be total
tap spending and B be total booms before reaching the target. The cost is

```
C = M + 1,000,000,000 * B
Q_p(C) = smallest budget x such that P(C <= x) >= p
```

Strategy selection minimizes Q_p(C). Adding an average tap cost to a boom
percentile does not produce a total-cost percentile, because tap spending is
random and correlated with booms.

## Markov reward calculation

At star i, write s_i for success probability, f_i for same-star failure,
b_i for destruction, c_i for tap cost, and r_i for the restoration star.
All probabilities and costs include the selected events. Restoration paths
use the same strategy, including when another destruction occurs during recovery.

Let H_i(z) be the Laplace transform of the total cost to first reach i+1 from i.
The next-tap recurrence is

```
H_i = exp(-z*c_i) * [s_i + f_i*H_i
      + b_i*exp(-z*R)*product(H_j, j=r_i..i-1)*H_i]

H_i = s_i / [exp(z*c_i) - f_i
      - b_i*exp(-z*R)*product(H_j, j=r_i..i-1)]

L_C(z) = product(H_i(z), i=start..target-1)
```

Compute H from low stars upward. The transform of the total-cost CDF is
L_C(z)/z. This includes every ordinary failed tap, every replacement, and
every recovery attempt. No fitted lognormal or average-tap approximation is used.

`src/sfCostDistribution.mjs` numerically inverts that transform using
[Abate and Whitt's Fourier/Euler method](https://www.columbia.edu/~ww2040/LaplaceInversionJoC95.pdf).
Small integer-cost models use exact dynamic programming. Low-star paths can
use sparse enumeration. For a single-star upgrade, the no-boom component is
handled analytically to remove large jumps from numerical inversion:

```
P(finish without booming, cost <= x)
  = s_i/(s_i+b_i) * [1 - f_i^floor(x/c_i)]
```

## Search and precision

The search checks all stationary strategies: up to 4^7 = 16,384 choices for
15 through 21, followed by mandatory base-mode taps above 21. It evaluates
each candidate at the current best budget and solves another quantile only
when that candidate can improve the budget. This does not optimize policies
that change mode based on remaining budget or previous outcomes.

The initial inversion uses shift 18.4, 32 Fourier terms and 24 Euler terms.
The winning target percentile is checked with twice the Fourier cutoff and
refined when the probabilities differ by more than 0.00001. Quantile search
uses relative budget resolution 0.000001 and rounds to the tap-cost lattice.
These are numerical convergence controls, not a universal error bound.
Tests independently compare budgets against seeded simulations, exact small
Markov examples, and a closed-form negative-binomial CDF. Targets through 30
remain feasible without a grid proportional to the size of the meso budget.

## Reported and cached values

- Expected cost is E[M] + R*E[B].
- p50Cost, p75Cost, p95Cost and pTargetCost describe the selected strategy.
- achievedProbability describes finishing within pTargetCost.
- Boom percentiles are separate diagnostics, not an additional spare cap.
- Astra cost-model versioning refreshes stale custom rows and named presets
  from their saved inputs. Recommended snapshots are precomputed to avoid
  recalculating them during initial page load.
