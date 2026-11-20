# Session S11 — 2026-11-20 — Offline PWA (after I07)

No iteration: a fix after the release, owner's request.

## Prompt 1

English:

```text
There is a PWA now, but it doesn't work offline. Make it work.
```

Original (ru):

```text
сейчас есть PWA но оно не работает оффлан. сделай чтобы работало.
```

## Prompt 2

English:

```text
push
```

Original (ru):

```text
пуш
```

## Outcome

The game works offline: `web/sw.js`, registered by `core/offline.js` (http(s) only), caches `index.html`, every file it links, the manifest's icons and the language flags (`EXTRA`) under `prLab.offline.v1`. `index.html` is network-first (cache when offline); each new `index.html` is parsed in the background, its missing files fetched, and only then does it replace the cached one and the files it no longer links are dropped, so a deploy needs no change in `sw.js`; every other file is cache-first by its `?v=N` URL; Supabase is not touched. Checked in headless Chrome: after one online start the page reloads with the server stopped and plays (start screen, sandbox, flags); a simulated deploy (bumped `?v=N` fetched like `core/update.js` does) swaps the cache to the new files and the new version starts offline; `file://` boots on phone portrait / landscape and desktop without errors. ADR-0009; spec 01 §15, 05 §2 / §3 / §5 / §6, AGENTS.md and the three READMEs updated. On a real phone the owner still has to check an installed app in airplane mode.
