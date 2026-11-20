'use strict';

// ============================================================
// AI Precision Recall Lab — small helpers shared by every other file: math (clamp, lerp, erf, the normal
// CDF Φ, logit, sigmoid, the 0.01 grid of scores and thresholds), the canvas scale for the device and a
// frame limiter. No game rules here. Used by sim/, render/, ui/, game.js and the tests (tests/load.js).
// ============================================================

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// σ(x) = 1 / (1 + e^(−x)), written so that a large |x| never overflows
function sigmoid(x) {
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const e = Math.exp(x);
  return e / (1 + e);
}
// logit(p) = ln(p / (1 − p)), the inverse of σ; infinite at 0 and 1 (callers clamp first)
function logit(p) { return Math.log(p / (1 - p)); }

// erf by Abramowitz & Stegun 7.1.26 (absolute error < 1.5e−7, plenty for AUC = Φ(d'/√2) on a badge)
function erf(x) {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
// Φ, the standard normal CDF
function normCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }

// Scores and thresholds live on a grid of 0.01 (spec 02 §2.1). They are compared as integers in hundredths,
// so 0.62 ≥ 0.62 holds even when the floats differ in the last bit (AGENTS.md "Quantized scores").
function round2(x) { return Math.round(x * 100) / 100; }
function hundredths(x) { return Math.round(x * 100); }
function atOrAbove(score, t) { return hundredths(score) >= hundredths(t); }

// Canvas backing-store scale: the device's pixel density (capped at 2.5), lowered on huge screens so the
// canvas never holds more than about 2560×1440 pixels
const MAX_DPR = 2.5;
const MAX_RENDER_PIXELS = 2560 * 1440;
function canvasScale(w, h, maxPixels = MAX_RENDER_PIXELS) {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  return Math.min(dpr, Math.sqrt(maxPixels / Math.max(1, w * h)));
}
// For requestAnimationFrame loops: on 120/144 Hz monitors it skips frames to hold about MAX_FPS
function frameLimiter() {
  const step = 1000 / MAX_FPS;
  let next = 0;
  return (now) => {
    if (now < next - 2) return false;
    next = Math.max(next + step, now);
    return true;
  };
}
