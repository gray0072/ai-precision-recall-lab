# ADR-0008 — The game in `web/`, deployed to Pages by a workflow

- **Status:** Accepted
- **Date:** 2026-11-20
- **Iteration:** — (after I07, session S10)

## Context
The game lived at the repo root ([ADR-0001](0001-static-vanilla-js.md)): `index.html`, five entry scripts, eight code folders, six icons, the manifest and the screenshot sat next to the docs, the tests, the tools and the cloud save's schema. The owner asked to tidy the root: the front-end files and the images go into a folder. GitHub Pages "deploy from a branch" can serve only the repo root or `docs/`, and `docs/` is the documentation.

## Options
1. **`web/`, deployed by a GitHub Actions workflow** (`actions/upload-pages-artifact` with `path: web`): the site URL, the PWA `id`, `start_url` and every relative link stay the same; the root keeps only docs, tests, tools and the schema. The workflow can run the Node checks before it deploys. Cons: a workflow to keep; Pages' source setting changes from "branch" to "GitHub Actions".
2. **`web/` plus a redirecting `index.html` at the root**: no workflow. Cons: the game's URL changes to `…/web/`, an installed PWA (its `id`, `scope`) and shared links break, and a redirect file stays in the root.
3. **Move the docs out of `docs/` and serve the game from `docs/`**: no workflow. Cons: the folder name lies, and every link to the spec breaks.

## Decision
Option 1. `web/` holds everything the site serves (the paths inside it are unchanged); `.github/workflows/pages.yml` runs `node --test tests/*.test.js`, `tools/i18n-check.js web` and `tools/icons-build.js web --check`, then uploads `web/` as it is. `.nojekyll` is gone: an uploaded artifact is not run through Jekyll.

## Consequences
- The URL `https://gray0072.github.io/ai-precision-recall-lab/` and the cloud save's redirect URL do not change.
- A failing test or a missing translation now stops the deploy.
- The tools take the game's folder: `web` instead of `.`; `tests/load.js` and `tools/cdp.js` point at `web/`.
- Anything outside `web/` is not served: the READMEs link to `web/screenshot.png` through GitHub, the `og:image` stays the site's own `screenshot.png`.
- Reversal: move the files back, delete the workflow, set Pages to "deploy from a branch", `main` / root, and restore `.nojekyll`.
