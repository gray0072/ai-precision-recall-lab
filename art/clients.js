'use strict';

// ============================================================
// AI Precision Recall Lab — the client avatars (spec 04 §5): six procedural portraits in the flat style of the
// items (rounded shapes, thick dark outlines, no images), one per scenario's client: a pigeon with a mailbag
// (Pigeon Post), a nurse with a mask (Harbor Clinic), a foreman with a helmet (Boltworks), a banker with a coin
// (Coinpurse Bank), a chat bubble mascot (Chatterbox), a magnifying-glass mascot (Seekwell Search). Each sits on
// a round tile. Used by the map, the briefing and the results.
// ============================================================

const ClientArt = (() => {
  const P = PALETTE;
  const SKIN = '#f2d2b6';

  function stroke(ctx, u, color) {
    ctx.lineWidth = Math.max(1.2, u * 0.035);
    ctx.strokeStyle = color || P.ink;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function circle(ctx, x, y, r, fill, u) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (u) stroke(ctx, u);
  }
  function eyes(ctx, u, y, dx, r) {
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.arc(-dx, y, r, 0, Math.PI * 2);
    ctx.arc(dx, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function smile(ctx, u, y, w) {
    ctx.beginPath();
    ctx.arc(0, y - w * 0.6, w, Math.PI * 0.25, Math.PI * 0.75);
    stroke(ctx, u);
  }
  // shoulders: a rounded body at the bottom of the tile
  function body(ctx, u, color) {
    ctx.beginPath();
    ctx.moveTo(-u * 0.36, u * 0.5);
    ctx.quadraticCurveTo(-u * 0.34, u * 0.14, 0, u * 0.12);
    ctx.quadraticCurveTo(u * 0.34, u * 0.14, u * 0.36, u * 0.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    stroke(ctx, u);
  }

  // Pigeon Post: a grey pigeon with a mailbag strap
  function spam(ctx, u) {
    ctx.beginPath();
    ctx.ellipse(0, u * 0.22, u * 0.3, u * 0.24, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9fb0c3'; ctx.fill(); stroke(ctx, u);
    circle(ctx, 0, -u * 0.12, u * 0.2, '#b8c6d4', u);
    ctx.beginPath();
    ctx.moveTo(u * 0.17, -u * 0.12); ctx.lineTo(u * 0.32, -u * 0.06); ctx.lineTo(u * 0.17, -u * 0.02); ctx.closePath();
    ctx.fillStyle = P.accent; ctx.fill(); stroke(ctx, u);
    eyes(ctx, u, -u * 0.15, u * 0.07, u * 0.03);
    // the strap and the bag with an envelope
    ctx.beginPath(); ctx.moveTo(-u * 0.2, u * 0.02); ctx.lineTo(u * 0.12, u * 0.34);
    ctx.lineWidth = u * 0.05; ctx.strokeStyle = '#8a5a32'; ctx.stroke();
    ItemArt.rr(ctx, u * 0.04, u * 0.26, u * 0.24, u * 0.18, u * 0.04);
    ctx.fillStyle = '#b07a48'; ctx.fill(); stroke(ctx, u);
  }

  // Harbor Clinic: a nurse with a cap and a mask
  function fever(ctx, u) {
    body(ctx, u, '#e8eef4');
    circle(ctx, 0, -u * 0.1, u * 0.2, SKIN, u);
    ItemArt.rr(ctx, -u * 0.14, -u * 0.36, u * 0.28, u * 0.12, u * 0.03);
    ctx.fillStyle = '#ffffff'; ctx.fill(); stroke(ctx, u);
    ctx.fillStyle = P.bad; ctx.fillRect(-u * 0.015, -u * 0.34, u * 0.03, u * 0.08); ctx.fillRect(-u * 0.04, -u * 0.315, u * 0.08, u * 0.03);
    ItemArt.rr(ctx, -u * 0.15, -u * 0.06, u * 0.3, u * 0.13, u * 0.04);
    ctx.fillStyle = '#8fd3f0'; ctx.fill(); stroke(ctx, u);
    eyes(ctx, u, -u * 0.13, u * 0.07, u * 0.025);
  }

  // Boltworks: a foreman with a yellow helmet and a moustache
  function bolts(ctx, u) {
    body(ctx, u, '#4a6f8f');
    circle(ctx, 0, -u * 0.06, u * 0.2, SKIN, u);
    ctx.beginPath();
    ctx.arc(0, -u * 0.12, u * 0.22, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = P.warn; ctx.fill(); stroke(ctx, u);
    ctx.fillStyle = P.warn;
    ItemArt.rr(ctx, -u * 0.27, -u * 0.14, u * 0.54, u * 0.06, u * 0.03); ctx.fill(); stroke(ctx, u);
    eyes(ctx, u, -u * 0.04, u * 0.07, u * 0.025);
    ctx.beginPath(); ctx.ellipse(0, u * 0.04, u * 0.09, u * 0.03, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6b4a2e'; ctx.fill();
  }

  // Coinpurse Bank: a banker with a bow tie and a coin
  function fraud(ctx, u) {
    body(ctx, u, '#2f3e4e');
    ctx.beginPath(); ctx.moveTo(-u * 0.08, u * 0.14); ctx.lineTo(0, u * 0.3); ctx.lineTo(u * 0.08, u * 0.14); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-u * 0.08, u * 0.15); ctx.lineTo(u * 0.08, u * 0.21); ctx.lineTo(u * 0.08, u * 0.15); ctx.lineTo(-u * 0.08, u * 0.21); ctx.closePath();
    ctx.fillStyle = P.bad; ctx.fill();
    circle(ctx, 0, -u * 0.1, u * 0.2, SKIN, u);
    ctx.beginPath(); ctx.arc(0, -u * 0.16, u * 0.2, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineWidth = u * 0.08; ctx.strokeStyle = '#3b2a1e'; ctx.stroke();
    eyes(ctx, u, -u * 0.1, u * 0.07, u * 0.025);
    smile(ctx, u, 0, u * 0.06);
    circle(ctx, u * 0.27, u * 0.3, u * 0.12, '#f0c24a', u);
    ctx.fillStyle = '#8a6a14';
    ctx.font = '800 ' + Math.round(u * 0.16) + 'px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', u * 0.27, u * 0.31);
  }

  // Chatterbox: a round speech-bubble mascot
  function moderation(ctx, u) {
    ctx.beginPath();
    ctx.ellipse(0, -u * 0.02, u * 0.34, u * 0.27, 0, 0, Math.PI * 2);
    ctx.moveTo(-u * 0.14, u * 0.22); ctx.lineTo(-u * 0.24, u * 0.42); ctx.lineTo(u * 0.02, u * 0.25);
    ctx.fillStyle = P.review; ctx.fill(); stroke(ctx, u);
    eyes(ctx, u, -u * 0.06, u * 0.1, u * 0.035);
    smile(ctx, u, u * 0.06, u * 0.08);
  }

  // Seekwell Search: a magnifying-glass mascot
  function retrieval(ctx, u) {
    ctx.beginPath(); ctx.moveTo(u * 0.12, u * 0.12); ctx.lineTo(u * 0.34, u * 0.38);
    ctx.lineWidth = u * 0.11; ctx.strokeStyle = '#8a5a32'; ctx.lineCap = 'round'; ctx.stroke();
    circle(ctx, -u * 0.05, -u * 0.06, u * 0.26, '#cfe9f7', u);
    ctx.beginPath(); ctx.arc(-u * 0.05, -u * 0.06, u * 0.26, 0, Math.PI * 2);
    ctx.lineWidth = u * 0.06; ctx.strokeStyle = '#5d6d7e'; ctx.stroke();
    eyes(ctx, u, -u * 0.1, u * 0.08, u * 0.03);
    smile(ctx, u, u * 0.02, u * 0.07);
  }

  const DRAW = { spam, fever, bolts, fraud, moderation, retrieval };
  const TILE = { spam: '#24425e', fever: '#1f4a4f', bolts: '#3d3f2a', fraud: '#3a2f45', moderation: '#2e2f52', retrieval: '#203c4a' };

  // the avatar of a scenario's client on its round tile, centred on x, y, `size` px across
  function draw(ctx, scenario, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = TILE[scenario] || P.bgPlay;
    ctx.fill();
    ctx.clip();
    (DRAW[scenario] || spam)(ctx, size * 0.92);
    ctx.restore();
  }

  // a small canvas with the avatar, for the DOM screens (DPR-aware)
  function canvas(scenario, size) {
    const c = document.createElement('canvas');
    const s = Math.min(window.devicePixelRatio || 1, 2.5);
    c.width = c.height = Math.round(size * s);
    c.style.width = c.style.height = size + 'px';
    c.className = 'avatar';
    const ctx = c.getContext('2d');
    ctx.scale(s, s);
    draw(ctx, scenario, size / 2, size / 2, size);
    return c;
  }

  return { draw, canvas };
})();
