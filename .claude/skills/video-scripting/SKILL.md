---
name: video-scripting
description: Write or improve the narration script for a howitworks explainer video — the hook, the retention structure, and the spoken voiceover in video.js. Use BEFORE writing/editing an explainer's video.js editorial, or whenever asked to make a script, hook, or narration punchier, more engaging, higher-retention, or easier to understand. Covers the retention spine (hook → loops → mechanism → stat → payoff → button), the professional formulas (ABT, open loops, Hook-Retain-Reward, SUCCESs), a worked before/after, and a pre-flight checklist. Hands the finished script to export-content; it does not render.
---

# Scripting an explainer video

The script IS the retention curve. On a short, viewers leave in the first 3
seconds and again at every soft transition after. Spend your effort here — a
world-class 3D model narrated over a flat script gets scrolled past.

This skill shapes **words only** — the hook plus the spoken line per shot in
`src/explainers/<id>/video.js`. It hands a finished script to `export-content`,
which renders the picture, synthesizes the ElevenLabs voice, and burns the
voice-matched caption rail. It does **not** touch rendering, TTS, or captions.

## The one hard truth about this pipeline

Captions are the **verbatim voice rail** — the exact spoken words appear on
screen, word-synced. There is **no separate title card** anymore. So:

- The hook must live in **shot 1's first spoken sentence.** That one sentence is
  simultaneously the audio hook AND the on-screen hook.
- Every word is read *and* heard. Write lines that land in the ear and read
  clean on screen — short, punchy, no tongue-twisters, no run-ons.

## The retention spine

Structure every script on this. Times are for a ~60-75s short; a ~2min long
develops the same beats with more room to breathe.

| Zone | Time (short) | Job |
| --- | --- | --- |
| 1. **Hook** | 0-3s | The boldest true sentence, word one. Visual matches. |
| 2. **Stakes + promise** | 3-8s | Stack a 2nd surprise; open the main loop; imply the payoff. |
| 3. **Question** | 8-14s | Say the mystery out loud, as a real spoken question. |
| 4. **Mechanism** | 14-40s | 3-4 beats as a BUT/THEREFORE chain, one analogy each, re-hook mid-way. |
| 5. **The stat** | ~40-50s | The single most surprising number, ISOLATED, with a beat of space. |
| 6. **So-what** | 50-60s | The everyday consequence — why the viewer should care. |
| 7. **Button** | last ~5s | A callback that CLOSES the opening loop. Quotable, ≤8 words. |

## The formulas (how to apply, not theory)

- **ABT — And / But / Therefore.** The spine of momentum. Connect beats with
  **"but"** (tension) or **"therefore"** (consequence). If a transition reads
  **"and then,"** rewrite it — that's a list, not a story. Highest-leverage fix
  in the whole skill.
- **Open loop (plant & close).** In zone 2, plant a question you do NOT answer
  ("…and it cooks from the inside out"). Close it — same words — in the button.
  One primary loop per script; never leave it dangling.
- **Hook → Retain → Reward.** Re-hook every ~15-20s with a mini pattern-interrupt
  ("here's the part that gets me"). The stat (zone 5) is the reward — never bury
  it inside the mechanism beats.
- **SUCCESs (comprehension).** Simple, Unexpected, Concrete, Credible, Emotional,
  Story. In practice: one idea per sentence; a concrete analogy for every
  abstract noun; a specific number over a vague claim ("boils water in 90
  seconds" beats "cooks fast").

## Non-negotiables (the checklist)

- **Hook in the first spoken sentence.** No warm-up, no "in this video," no
  restating the title. The counterintuitive claim is word one.
- **One flowing single-take voiceover.** Each shot's line HANDS OFF into the next
  (a trailing thought the next line finishes). The whole script is synthesized as
  one ElevenLabs take — write it to be read start-to-finish, not as a stack of
  standalone facts.
- **But/therefore, never and-then** between beats.
- **Plant one loop; close it in the button.**
- **Isolate the stat** on its own shot with a beat of space around it.
- **One idea per sentence.** Break run-ons — short sentences read and hear better.
- **Analogy per abstract concept;** define jargon the instant it appears.
- **Second person, contractions, ~2.3 words/sec.** Talk to one viewer.
- **Button ≤8 words, quotable, closes the loop.** End on the callback — not a new
  fact, and not "like & subscribe."
- **Never paste the step body copy** — it's written for reading, not listening.

## Worked example (microwave-oven short)

**Hook** — soft open → cold-open claim with a planted loop:
> BEFORE: "There's no flame in here. No hot coil, nothing that even touches your
> food — and yet, close the door, and it cooks in seconds."
>
> AFTER: "Nothing in this box ever touches your food. No flame, no coil, no
> contact — and it'll still boil water in ninety seconds. Whatever's doing it is
> basically caged lightning… that cooks from the inside out."

**Mechanism beat** — "and then" → BUT + a more universal analogy:
> BEFORE: "Magnets bend their path, they ring twelve little cavities like tuning
> forks, and out comes a radio wave — the same kind that carries Wi-Fi, just far
> more powerful."
>
> AFTER: "But the electrons don't fly straight — two magnets bend them into
> loops. As they whip past twelve little cavities, they make them ring like a wet
> finger on a wine glass. That ringing IS a radio wave — same as your Wi-Fi,
> cranked up a thousand times."

**Button** — close the "inside out" loop + callback:
> BEFORE: "…the food heats itself from the inside. No flame. Just a storm of
> invisible waves, and water that can't sit still."
>
> AFTER: "That flipping is friction — and friction is heat. So the food cooks
> itself, from the inside out. No flame. No touch. Just invisible lightning, and
> water that can't sit still."

## Pre-flight (run before handing to make-narration)

1. Read shot 1's first sentence **alone** — does it stop a scroll? If not, rewrite.
2. Walk every transition — is each a but/therefore? Kill every "and then."
3. Find the loop — planted in zone 2, closed word-for-word in the button?
4. Is the stat on its own beat, not buried in the mechanism?
5. Read the whole script **aloud as one take** — does it flow, or is it a list?
6. Any sentence with two ideas → split it. Any undefined jargon → define or cut.
7. Length in range (~60-75s short / ~2min long) at ~2.3 words/sec.

Then write it into `video.js` and hand off to **`export-content`** (make-narration
→ export). The spoken words become the on-screen captions automatically, so a
script that reads well IS a caption track that reads well.
