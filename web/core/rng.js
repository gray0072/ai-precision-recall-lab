'use strict';

// ============================================================
// AI Precision Recall Lab — seeded randomness (spec 02 §2.2, 05 §4 "Determinism"). mulberry32 generators,
// named sub-streams derived from one attempt seed (the item stream, the validation set and the incidents
// each get their own, so changing one never reshuffles the others), and the samplers the score model needs:
// uniform, integer, Bernoulli, normal, exponential, Poisson, log-normal.
// Everything random in sim/ comes from here; sim/ never calls Math.random. Used by sim/ and the tests.
// ============================================================

const Rng = (() => {
  // 32-bit FNV-1a of a string: turns a stream name into a number
  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // a 32-bit finaliser (from MurmurHash3): neighbouring seeds give unrelated generators
  function mix(a, b) {
    let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }

  // A generator: mulberry32 plus samplers. Each sampler uses a fixed number of draws (normal: two), so the
  // n-th item of a stream always uses the same draws whatever the parameters.
  function create(seed) {
    let a = seed >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next,
      uniform(lo = 0, hi = 1) { return lo + (hi - lo) * next(); },
      int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },          // lo..hi inclusive
      bernoulli(p) { return next() < p ? 1 : 0; },
      // Box–Muller; 1 − u keeps the logarithm away from 0
      normal(mu = 0, sd = 1) {
        const u = 1 - next(), v = next();
        return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      exponential(rate) { return -Math.log(1 - next()) / rate; },             // waiting time of a Poisson process
      // Knuth's product method; fine for the small means of the game
      poisson(lambda) {
        const limit = Math.exp(-lambda);
        let k = 0, p = next();
        while (p > limit) { k++; p *= next(); }
        return k;
      },
      lognormal(mu, sigma) { return Math.exp(this.normal(mu, sigma)); }
    };
  }

  // the generator of a named sub-stream of an attempt seed ('items', 'validation', 'incidents', …)
  function stream(seed, name) { return create(mix(seed >>> 0, hashString(name))); }

  // a new attempt seed. Outside sim/, so it may use the clock and Math.random; shown on the results screen.
  function freshSeed() { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0; }

  return { create, stream, hashString, freshSeed };
})();
