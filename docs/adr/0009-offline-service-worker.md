# ADR-0009 — Offline play through a self-updating service worker

- **Status:** Accepted
- **Date:** 2026-11-20
- **Iteration:** — (after I07, session S11)

## Context
The game is an installable PWA (spec 05 §6) and the overview promises it "works offline" (00 §2), but there was no service worker: an installed app opened without a network showed the browser's offline page. Every file the game loads is static and already versioned (`?v=N` on each `<script>` / `<link>`, bumped with every change); `core/update.js` already notices a new deploy by fetching `index.html`. The Pages origin `gray0072.github.io` is shared with other apps, and so is its Cache Storage.

## Options
1. **A precache list in `sw.js` with a version constant**, the classic scheme: install caches the listed files, a new deploy bumps the constant. Cons: a second list of every file next to `index.html`, and one more thing to bump on each deploy; forgetting either breaks offline play silently.
2. **Cache whatever the page happens to load (runtime caching only).** No list. Cons: a file the player has not needed yet (a flag, a script loaded later) is missing offline; old versions pile up.
3. **A service worker that reads `index.html` itself.** `index.html` goes to the network first (the cache only when it fails); every fresh copy that differs from the cached one is parsed for its `src` / `href` links (plus the manifest's icons and a short `EXTRA` list of files the page loads without a link), the missing files are fetched, and only when all are in does the new `index.html` replace the cached one and the files it no longer links get deleted. Every other file is cache-first: its `?v=N` makes its URL unique to its content.

## Decision
Option 3: `web/sw.js`, registered by `core/offline.js` (only over http(s); from `file://` there is nothing to do). The existing `?v=N` discipline is the whole version scheme, so a deploy needs nothing new, and the cache always holds one whole version of the game. The cache is named `prLab.offline.v1` and activate deletes only caches with the `prLab.` prefix. Requests to other origins (Supabase) and outside the game's folder are not touched.

## Consequences
- An installed app starts and plays offline after its first online start (the install caches everything). The cloud save just does not sync until the network is back (01 §15.1).
- `core/update.js` keeps working: its fetch of `index.html` goes to the network, and it also fills the cache with the next version in the background.
- A changed file whose `?v=N` was not bumped now stays old for everyone who has the cache, not just for the HTTP cache's ten minutes: bumping is no longer optional.
- A file the page loads that `index.html` does not link (built in JS) must be added to `EXTRA` in `sw.js`, or it is missing offline.
- The cache name changes (`.v2`) only when the caching scheme itself changes.
- Reversal: replace `sw.js` with one that deletes the `prLab.` caches and unregisters itself (`self.registration.unregister()`), and drop `core/offline.js`.
