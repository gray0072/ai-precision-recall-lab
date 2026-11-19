'use strict';

// ============================================================
// AI Precision Recall Lab — the score model (spec 02 §2.1, §2.3). Synthetic binormal scores (ADR-0002):
//   z | y = 0 ~ N(−d'/2, 1),  z | y = 1 ~ N(+d'/2 − drift, 1),  s = σ(γ·z + β), rounded to 0.01 in [0.01, 0.99].
// Here: the effective d', quantization, the true posterior P(y = 1 | z), the mapping of a posterior back to
// the raw score axis (the ghost line on Easy), Platt scaling fitted by Newton's method, the theoretical AUC.
// A "model" is a plain object { dPrime, prevalence, gamma, beta }. No drawing, no DOM, no sound.
// Used by sim/stream.js, sim/contract.js, the sandbox, the Lab cards and the tests.
// ============================================================

const Model = (() => {
  // the scenario's base d' + the Lab's bonus + the difficulty's offset, clamped to [0, D_PRIME_MAX]
  function effectiveDPrime(base, bonus = 0, offset = 0) { return clamp(base + bonus + offset, 0, D_PRIME_MAX); }

  // the model of a scenario, with optional overrides ({ dPrime, prevalence } of a contract or the sandbox)
  function of(scenario, over = {}) {
    return {
      dPrime: over.dPrime !== undefined ? over.dPrime : scenario.dPrime,
      prevalence: over.prevalence !== undefined ? over.prevalence : scenario.prevalence,
      gamma: over.gamma !== undefined ? over.gamma : scenario.gamma,
      beta: over.beta !== undefined ? over.beta : scenario.beta
    };
  }

  // every score and calibrated p: rounded to 0.01, clamped to [0.01, 0.99], so the badge is the value decided on
  function quantize(x) { return clamp(round2(x), SCORE_MIN, SCORE_MAX); }

  // the mean of the hidden logit z for class y (drift moves only the positives down, 02 §6.2)
  function logitMean(y, dPrime, drift = 0) { return y ? dPrime / 2 - drift : -dPrime / 2; }

  // the raw score of a logit with the model's temperament γ, β: changes no ranking, only what a number means
  function rawScore(z, m) { return quantize(sigmoid(m.gamma * z + m.beta)); }

  // The true posterior. With equal variances the likelihood ratio N(z; d'/2, 1) / N(z; −d'/2, 1) = e^(d'z),
  // so logit P(y = 1 | z) = logit(π) + d'·z: exactly logistic in z. This is why Platt scaling fits so well here.
  function posterior(z, m) { return sigmoid(logit(m.prevalence) + m.dPrime * z); }
  // the posterior of a raw score: undo the temperament, z = (logit(s) − β) / γ
  function posteriorOfScore(s, m) { return posterior((logit(clamp(s, SCORE_MIN, SCORE_MAX)) - m.beta) / m.gamma, m); }

  // The raw-score threshold that flags exactly the items whose true posterior is ≥ p (the ghost line on Easy,
  // 02 §5.1), on the 0.01 grid. At d' = 0 the posterior is π for every item: flag all or nothing.
  function scoreForPosterior(p, m) {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    if (m.dPrime <= 0) return m.prevalence >= p ? 0 : 1;
    const z = (logit(p) - logit(m.prevalence)) / m.dPrime;
    const s = sigmoid(m.gamma * z + m.beta);
    return clamp(Math.ceil(s * 100 - 1e-9) / 100, 0, 1);   // the lowest grid score whose posterior is ≥ p
  }

  // AUC of the binormal model: P(z₁ > z₀) with z₁ − z₀ ~ N(d', 2), i.e. Φ(d'/√2)
  function theoreticalAuc(dPrime) { return normCdf(dPrime / Math.SQRT2); }

  // What Platt scaling should find (02 §2.3): logit(s) = γz + β, so logit P = logit(π) + d'(logit(s) − β)/γ
  function plattExpected(m) { return { a: m.dPrime / m.gamma, b: logit(m.prevalence) - m.dPrime * m.beta / m.gamma }; }

  // Platt scaling: p = σ(a·logit(s) + b), with a, b by maximum likelihood — a logistic regression on the one
  // feature x = logit(s). Newton's method (gradient and 2×2 Hessian of the log-loss), at most PLATT_MAX_ITER
  // steps, stopping when a step is under PLATT_TOL; a step that makes the log-loss worse is halved.
  // With one class only there is nothing to fit: { a: 1, b: 0, ok: false } (the identity on logit(s)).
  function fitPlatt(scores, ys) {
    const n = scores.length;
    const x = new Float64Array(n);
    let pos = 0;
    for (let i = 0; i < n; i++) { x[i] = logit(clamp(scores[i], SCORE_MIN, SCORE_MAX)); pos += ys[i] ? 1 : 0; }
    if (pos === 0 || pos === n) return { a: 1, b: 0, ok: false, iterations: 0 };

    function loss(a, b) {   // mean negative log-likelihood, computed stably: log(1 + e^u) − y·u
      let L = 0;
      for (let i = 0; i < n; i++) {
        const u = a * x[i] + b;
        L += (u > 0 ? u + Math.log1p(Math.exp(-u)) : Math.log1p(Math.exp(u))) - (ys[i] ? u : 0);
      }
      return L / n;
    }

    let a = 0, b = logit(pos / n), L = loss(a, b), it = 0;
    for (; it < PLATT_MAX_ITER; it++) {
      let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0;
      for (let i = 0; i < n; i++) {
        const p = sigmoid(a * x[i] + b), r = p - (ys[i] ? 1 : 0), w = p * (1 - p);
        ga += r * x[i]; gb += r;
        haa += w * x[i] * x[i]; hab += w * x[i]; hbb += w;
      }
      const det = haa * hbb - hab * hab;
      if (!(det > 1e-12)) break;
      let da = (hbb * ga - hab * gb) / det, db = (haa * gb - hab * ga) / det;
      let na = a - da, nb = b - db, nL = loss(na, nb);
      for (let h = 0; h < 30 && nL > L + 1e-15; h++) { da /= 2; db /= 2; na = a - da; nb = b - db; nL = loss(na, nb); }
      a = na; b = nb; L = nL;
      if (Math.max(Math.abs(da), Math.abs(db)) < PLATT_TOL) { it++; break; }
    }
    return { a, b, ok: true, iterations: it };
  }

  // the calibrated p of a raw score, on the same 0.01 grid (a monotone map: no ranking changes)
  function calibrate(s, platt) { return quantize(sigmoid(platt.a * logit(clamp(s, SCORE_MIN, SCORE_MAX)) + platt.b)); }

  // The raw-score threshold equivalent to "p ≥ t" (ADR-0004): the rounded p is a monotone non-decreasing
  // function of s, so the items with p ≥ t are exactly those with s ≥ the smallest grid score whose p is ≥ t.
  // 0 when every score qualifies, 1 when none does. The operating point on the raw curves is read there.
  function rawThreshold(t, platt) {
    if (hundredths(t) <= hundredths(SCORE_MIN)) return 0;
    for (let k = hundredths(SCORE_MIN); k <= hundredths(SCORE_MAX); k++) {
      if (atOrAbove(calibrate(k / 100, platt), t)) return k === hundredths(SCORE_MIN) ? 0 : k / 100;
    }
    return 1;
  }

  return {
    effectiveDPrime, of, quantize, logitMean, rawScore, posterior, posteriorOfScore, scoreForPosterior,
    theoreticalAuc, plattExpected, fitPlatt, calibrate, rawThreshold
  };
})();
