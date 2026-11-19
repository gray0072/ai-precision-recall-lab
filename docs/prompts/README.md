# Prompt history

Every prompt the owner sends to an AI agent in this repo is saved here **verbatim**, one file per session.
Agents do this themselves; see the "Prompt logging" rule in [AGENTS.md](../../AGENTS.md).

## Why

- To see how the project was built and which prompts worked.
- To review and improve prompting over time. This is part of the learning goal.

## Format

File name: `sessions/YYYY-MM-DD_SNN_<short-topic>.md`. `SNN` is a session number that runs across the whole project (S01, S02, …).

````markdown
# Session SNN — YYYY-MM-DD — <topic>

- **Iteration:** I02 (simulation core)
- **Agent:** Claude Code / Codex / …
- **Outcome:** <one or two lines, filled in at the end of the session>

---

## Prompt 1

English:

```text
<the prompt in English: a faithful translation, or the prompt itself if it was written in English>
```

Original (ru):

```text
<verbatim prompt, including typos, in the original language>
```

## Prompt 2
...
````

Rules:
- English comes first: a faithful, complete translation (no summarizing). Then the original, copied exactly: no fixes of typos or formatting. The heading names the language: `Original (ru):`, `Original (sv):`, ….
- A prompt written in English is saved once, under `English:`, without an original block.
- Text the owner pasted into a prompt (an earlier answer, a log) is part of the prompt and is saved with it.
- Messages sent mid-turn count as separate prompts.
- Never save secrets (API keys etc.). Replace them with `<redacted>`.
- If several agents work in parallel (worktrees), each session gets its own file.

## Index

| Session | Date | Iteration | Topic |
|---|---|---|---|
| [S01](sessions/2026-11-19_S01_preparation.md) | 2026-11-19 | I00 | Project preparation: game idea, spec, roadmap, AGENTS.md |
| [S02](sessions/2026-11-19_S02_skeleton.md) | 2026-11-19 | I01 | Skeleton: tools, core, start screen, PWA, test loader |
| [S03](sessions/2026-11-19_S03_simulation-core.md) | 2026-11-19 | I02 | Simulation core: score model, streams, metrics, curves, best thresholds, tests |
| [S04](sessions/2026-11-19_S04_play-screen-sandbox.md) | 2026-11-19 | I03 | Play screen and sandbox: belt, threshold, pile, live panel, charts |
| [S05](sessions/2026-11-19_S05_campaign-act1.md) | 2026-11-19 | I04 | Campaign Act 1 and the cheat sheet: map, briefing, contracts, results, coach marks, balance check |
| [S06](sessions/2026-11-19_S06_lab-incidents-act2.md) | 2026-11-19 | I05 | The Lab, incidents, the review desk, the drift monitor, Act 2 (C06–C09) |
