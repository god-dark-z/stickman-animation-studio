# Agent playbook — Windsurf

## Where things live

> Verification status: **by convention.** This research pass did not confirm Windsurf's current
> paths from an official source, so treat the paths below as the conventional layout and check your
> build. `install/INSTALL.md` marks Windsurf convention-only for the same reason.

| Thing | Location |
|---|---|
| Rules | `.windsurf/rules/*.md` (activation mode: always-on / manual / glob) and the legacy `.windsurfrules` |
| Workflows | `.windsurf/workflows/*.md` — multi-step procedures invoked by name |
| Cascade | the agent surface, with terminal + file tools |

Windsurf has no skill folder. Install = a rule pointing at SKILL.md + a workflow for the pipeline.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Workflows** | This is the best fit for the 13-stage pipeline: one workflow file that lists the stages in order with the exact command per stage. Cascade follows it step by step and stops where the gate fails. |
| **Rules with activation modes** | Put the non-negotiables in an always-on rule; put the Bangla-specific screen rules in a glob rule scoped to `engine/stories/**/*.json` so they only load when editing stories. |
| **Terminal + background where supported** | Run the render as a background command if the build allows; otherwise draft first, final second. |
| **Vision** | Model-dependent. If the configured model reads images, review `contact-sheet.png`; otherwise state "geometric only". |
| **Web search** | Use where available for `fact-check.md`, one search per claim. |

## Order of operations

```
1  terminal: resolve_language.ts --text "<user text>" --json
2  terminal: npm run doctor
3  research → fact-check.md
4  script.md → choose_voice --write voice-decision.md
5  Scene Spec → story JSON
6  terminal: qa_sync / qa_geometry / qa_commonsense (＋ qa_bangla, qa_gloss, qa_glyphs for bn)
7  terminal: stills → qa_stills → contact sheet → verdicts (if vision)
8  terminal: render → qa_video → qa_audio → ffprobe
9  deliver
```

## Pitfalls specific to Windsurf

- **Rules and workflows overlap.** Do not write the same instructions in both — the workflow runs
  the stages, the rule states the invariants. Duplication confuses the agent about which is current.
- **Cascade's "continue" habit.** After a failed gate it may try to "fix" the engine. Stop it: the
  gate error names the story change, not an engine change.
- **Legacy `.windsurfrules`.** If both exist, newer builds may read only `.windsurf/rules/`. Pick
  one and delete the other.
- **No vision = no visual claim.**

## Verification line for the report

```
agent: Windsurf | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
visual QA: <contact sheet reviewed | geometric only>
```
