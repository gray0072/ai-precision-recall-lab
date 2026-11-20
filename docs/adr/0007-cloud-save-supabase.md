# ADR-0007 — An optional cloud save through Supabase (Google sign-in), with supabase-js vendored

- **Status:** Accepted
- **Date:** 2026-11-20
- **Iteration:** after I07 (owner's request, session S09)

## Context
The campaign lives in `localStorage` of one browser: a player who starts on a phone cannot go on on a computer. The owner asked for a sync with a Google account "the way `ivan/world-aviation` does it", in the same Supabase project, with `ivan`'s rule for table names. The game is a static site (ADR-0001: no build step, no third-party libraries, anything needed vendored into `lib/`), so there is no server of our own and no place for secrets.

## Options
1. **Supabase Auth + Postgres, as in the `ivan` games** (`world-aviation`, `lift-logic`): Google sign-in with PKCE, a row per account guarded by row-level security; the URL and the publishable key are public by design. Pros: proven in the owner's other games, one shared project, no backend code. Cons: a 200 KB third-party library (an exception to ADR-0001), and the shared project needs prefixed names.
2. **Google Drive appData through Google Identity Services**: no third party besides Google. Cons: its own OAuth client and consent screen, a different flow from the owner's other games, more code to write by hand.
3. **An export / import code** (copy a string between devices): no network at all. Cons: not a sync; the owner asked for Google.

## Decision
Option 1, copied from `lift-logic` (one account per device; `world-aviation`'s many careers are not needed: the game has one campaign). The library `lib/supabase.min.js` is the same vendored supabase-js 2.109 file as `ivan`'s, loaded first and never edited; the game runs without it (and from `file://`) with the cloud simply absent. The table is `prlab_progress` with policies prefixed `prlab:` (the `localStorage` prefix `prLab.` in lower case, like `liftLogic.` → `liftlogic_progress`); the session is kept under `prLab.auth`.

The merge (01 §15.1) is the part that differs from `lift-logic`, whose progress only grows: our balance is spent on upgrades. Stars, bests, quiz bonuses, coach marks and opened contracts are merged by union / maximum; the balance and the upgrades come together from the copy saved last, so an upgrade is never free and money is never counted twice. New campaign starts an `epoch` that replaces older campaigns everywhere.

## Consequences
- The site now loads one third-party file; it must stay vendored (never a CDN) and is updated only by copying `ivan`'s file.
- The owner must run `supabase/schema.sql` once in the project and add `https://gray0072.github.io/ai-precision-recall-lab/` to Auth → Redirect URLs; until then sign-in fails and the start screen says "Sync failed".
- Two devices played without syncing in between can lose the fees and bonuses earned on the one that saved first (its stars are kept). Accepted: the sync runs at every start, return to the foreground and change, so this needs offline play on both.
- To reverse: remove `lib/`, `core/cloud.js`, the account row and the two script tags; the save format stays readable (`updatedAt` / `epoch` are ignored by nothing else).
