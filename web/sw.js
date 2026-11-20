// AI Precision Recall Lab — the service worker: lets the game (above all the installed app) start and
// play without a network. Registered by core/offline.js; spec 05 §6, ADR-0009.
//
// Its cache holds index.html plus every file index.html links (the versioned ?v=N scripts, styles,
// icons and the manifest), the manifest's icons and the few files the page loads that index.html does
// not link (EXTRA). It never needs bumping for a new deploy:
//   - index.html (a navigation, or core/update.js asking for it) goes to the network first and comes
//     from the cache only when the network fails; each fresh copy that differs from the cached one is
//     taken apart in the background: its new files are fetched, and only when all of them are in does
//     it replace the cached index.html, and the files it no longer links are dropped. So the cache is
//     always one whole version of the game, never half of two.
//   - every other file of the game comes from the cache first (its ?v=N makes the URL unique to its
//     content), and from the network on a miss.
// Requests outside the game's folder or to other origins (the cloud save's Supabase) are not touched.

'use strict';

// Cache Storage is shared by every app on gray0072.github.io, like localStorage: the name carries the
// game's prefix, and activate deletes only the game's own old caches. A new name is needed only when
// the way this file caches changes, not for a deploy.
const CACHE_PREFIX = 'prLab.';
const CACHE = CACHE_PREFIX + 'offline.v1';
// Files the page loads that index.html does not link: the flags of the language switcher (core/i18n.js).
const EXTRA = ['art/flag-gb.svg?v=1', 'art/flag-ru.svg?v=1', 'art/flag-se.svg?v=1'];

const SCOPE = new URL('./', self.location.href).href;  // https://…/ai-precision-recall-lab/
const SCOPE_PATH = new URL(SCOPE).pathname;
const PAGE = SCOPE;                                       // the cache key of index.html

const isPage = (url) => url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + 'index.html';

// The relative src / href links of index.html, as absolute URLs (the og: tags use content=, not href).
function linksOf(html) {
  const urls = [];
  for (const m of html.matchAll(/\s(?:src|href)="([^"#]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(m[1])) continue;     // https:, data:, mailto:, protocol-relative
    urls.push(new URL(m[1].replace(/&amp;/g, '&'), SCOPE).href);
  }
  return urls;
}

async function ensure(cache, url) {
  if (await cache.match(url, { ignoreVary: true })) return;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(url + ': HTTP ' + res.status);
  await cache.put(url, res);
}

// Makes the cache hold the version of the game that this index.html text describes.
async function store(html) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(PAGE);
  if (cached && (await cached.text()) === html) return;
  const keep = new Set([PAGE, ...linksOf(html), ...EXTRA.map((u) => new URL(u, SCOPE).href)]);
  await Promise.all([...keep].filter((u) => u !== PAGE).map((u) => ensure(cache, u)));
  const manifest = [...keep].find((u) => /\.webmanifest(?:\?|$)/.test(u));
  if (manifest) {
    const icons = (await (await cache.match(manifest, { ignoreVary: true })).json()).icons || [];
    const urls = icons.map((i) => new URL(i.src, manifest).href);
    urls.forEach((u) => keep.add(u));
    await Promise.all(urls.map((u) => ensure(cache, u)));
  }
  // every file is in: only now does this index.html become the one an offline start gets
  await cache.put(PAGE, new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
}

// One update of the cache at a time (a navigation and core/update.js can bring index.html together).
let queue = Promise.resolve();
const refresh = (html) => (queue = queue.then(() => store(html)).catch(() => { /* offline or a failed file: the next fresh index.html tries again */ }));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const res = await fetch(PAGE, { cache: 'no-cache' });
    if (!res.ok) throw new Error('index.html: HTTP ' + res.status);
    await store(await res.text());   // a failure fails the install; the browser tries again on a later visit
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.href.startsWith(SCOPE)) return;               // another origin or another app on this one
  if (isPage(url)) {
    // network first: the player gets a new deploy as soon as there is one; the cache only offline
    const net = fetch(req).then((res) => [res, res.ok && !res.redirected ? res.clone() : null]);
    event.respondWith(net.then(([res]) => res, async () => (await caches.match(PAGE, { cacheName: CACHE })) || Response.error()));
    event.waitUntil(net.then(([, copy]) => copy && copy.text().then(refresh), () => {}));
  } else if (req.mode === 'navigate') {
    return;                                              // some other page of the folder: the network as usual
  } else {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
      return res;
    })());
  }
});
