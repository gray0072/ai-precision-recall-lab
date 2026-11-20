# ADR-0001 — A static site in vanilla JS, no build step (the `ivan` conventions)

- **Status:** Accepted
- **Date:** 2026-11-19
- **Iteration:** I00

## Context
The game is a demo for GitHub Pages and a PWA for phones. The owner already has a working set of conventions for such games in the `ivan` repo (plain scripts, folders by role, `constants.js`, an event bus, the Icons engine, `update.js`, PWA rules, three languages, three difficulty levels) and wants this project to follow them. The game is small: a canvas, a few panels, some math.

## Options
1. **Vanilla JS, plain scripts, no build** (as `ivan`): opens from `file://`, deploys by pushing, nothing to install or update, the tooling of `ivan` can be copied as is. Cons: no types, no modules, globals need discipline.
2. **React + Vite + TypeScript** (as `ai-rag-film-search`'s web app): types, components, a test runner. Cons: a build and a deploy workflow for Pages, `node_modules`, the `ivan` conventions and tools do not apply, more weight than the game needs.
3. **A single-file page with a CDN chart library**: quickest to start. Cons: grows into one big file, depends on a CDN (offline PWA breaks), against both repos' rules.

## Decision
Option 1. The `ivan` rules apply in full (AGENTS.md restates them); the game lives at the repo root instead of a gallery folder.

## Consequences
- Pages serves the repo root from `main`; `.nojekyll` keeps Jekyll away from `docs/`. (Superseded by [ADR-0008](0008-game-in-web-folder.md): the game moved to `web/`, deployed by a workflow.)
- Correctness of the math is guarded by Node tests over `sim/` loaded into a `vm` context, since there is no type checker.
- Reversal: the `sim/` files are framework-free and could be wrapped by a React UI later without changing the math.
