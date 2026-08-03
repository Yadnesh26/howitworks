---
name: film-scripting
description: Write or restructure the script for a LONG-FORM film (6-12 min documentary spanning several explainers) — the spine, the act structure, the open loops, and the narration in films/<id>/film.js. Use when asked for a long-form video, a documentary, a deep dive, a "proper YouTube video", or when a film's script feels flat, slow, or like a narrated slideshow. Different job from video-scripting, which owns the ~70s short and ~2min per-explainer video.
---

# Scripting a long-form film

A long-form film is **not the short with more words**. The short wins on one
payoff; the film wins on a *journey the viewer wants to finish*. Everything
below exists to solve one problem: nobody has to keep watching.

Read `films/README.md` for the manifest shape before you write. This skill owns
what goes *in* it.

## The one decision that makes or breaks it: the spine

Before any act structure, find the **spine** — a single concrete question with
a delayed answer, that every act advances.

Not a topic ("the electrical grid"). Not a list ("the five stages of
transmission"). A question with a clock on it:

> *"You flip a switch and the light comes on. What had to happen, 400 km away,
> in the fifth of a second before that?"*

Test your spine three ways:
1. **Can you state it in one sentence a 12-year-old repeats correctly?**
2. **Does it have an answer you are deliberately withholding?** If the title
   gives it away, it is a topic, not a spine.
3. **Does every act move toward it?** An act that does not is a deleted act,
   however interesting.

The reference film (`films/electricity-to-your-home/film.js`) opens at the END
of the journey and travels backwards up the wire. Reversing the obvious order
is often what turns a topic into a spine.

## Act structure

6–12 minutes = **6–8 acts of 45–90 seconds**. Each act is a small complete
thing with its own small hook, and each ends handing a question to the next.

| act | job |
| --- | --- |
| 1 | **Cold open.** The counterintuitive claim + the open loop. No preamble, no "in this video we'll". |
| 2 | **Ground it.** Where the thing physically starts. Establish scale. |
| 3 | **Correct a belief.** State what most people think, then demolish it. |
| 4 | **The central trick.** The one mechanism the whole system rests on. This is your best act — give it the most room. |
| 5–6 | **The consequences.** How the trick plays out at scale, in stages. |
| 7 | **Payoff.** Close the act-1 loop. Land the emotional line. Get out. |

Two rules that matter more than the table:

- **Never let 90 seconds pass without a new open loop.** Act cards help
  structurally, but the loop is what carries attention: "…and that raises a
  problem the grid solves in a way that sounds illegal."
- **The last 20 seconds decide the next video.** End on the spine's answer
  restated as a human line, not a summary. Never end with "and that's how it
  works."

## The belief-correction beat (act 3)

The single highest-retention move in explainer content is telling the viewer
that something they already believe is wrong, then being generous about why
it's a reasonable thing to have believed.

```
Most people picture electricity as water in a pipe: made at the plant,
shipped to your house.  →  The electrons barely move. They jitter back and
forth 50 times a second and go essentially nowhere. What travels is the push.
```

Find one for every film. If you cannot find one, the topic may not carry
long form.

## Writing the narration itself

The manifest holds one `narration` string per shot. Within an act these are
synthesized as ONE take, so write them as **one flowing paragraph split across
shots**, not as standalone sentences.

- **Hand off between shots.** End a line on a thought the next line finishes.
  Standalone one-fact-per-shot lines are exactly what makes an export sound
  disconnected.
- **~2.3 words/second.** A 60-second act is ~140 words. Do the arithmetic
  before you write, not after.
- **Spoken prose**: contractions, second person, short sentences. Never paste
  an explainer's step body copy — it is written for reading.
- **Numbers get spelled the way they are said**: "four hundred thousand volts",
  not "400,000 V". The TTS reads what you wrote.
- **One idea per sentence.** If a sentence has two clauses joined by "and
  because", it will be misheard.
- **Silence is a tool.** A short line on a long shot is a beat. Use it before
  the biggest fact in the film, never after.

### Per-act voice direction

`voiceSettings` per act is the film's dynamic range, and skipping it is the
most common reason long-form TTS sounds like TTS for nine straight minutes.

| act type | stability | style |
| --- | --- | --- |
| cold open / payoff (tense) | 0.38–0.42 | 0.2–0.3 |
| explanation (steady) | 0.5 | 0.0–0.1 |
| the central trick (weighty) | 0.45 | 0.15–0.2 |

Lower stability = more expressive and more variable. Do not go below ~0.35;
the voice starts drifting.

## Choosing shots

A shot is `{explainer, step}` plus a camera move. Shots are **decoupled from
steps on purpose**:

- **Several shots may sit on one step** while the camera moves and the voice
  develops. This is how you hold a 90-second act without cutting away.
- **Return to a step you already used.** Coming back to the wide journey shot
  in act 7 after seeing every part of it is a payoff, not a repeat.
- **Cut across explainers freely.** A turbine in one explainer and a
  transformer in another are one continuous thought if the narration says so.
- **Match the move to the sentence.** Push in when narrowing to a detail; pull
  back on a scale reveal or a summarising line; orbit when the sentence is
  describing a shape.

Camera ranges are narrow and clamped — see `films/README.md`. A move the
viewer consciously notices is too big.

## Pre-flight checklist

Before handing off to `film-production`:

- [ ] The spine states in one sentence, with a withheld answer
- [ ] Every act advances the spine; none is there because it was interesting
- [ ] Act 1 has no preamble — the first sentence is already the hook
- [ ] There is a belief-correction beat
- [ ] No 90-second stretch without a new open loop
- [ ] Act 7 closes the act-1 loop explicitly
- [ ] Word counts match act durations at ~2.3 w/s
- [ ] Lines hand off within each act; none is a standalone fact
- [ ] `voiceSettings` varies across acts
- [ ] Read the whole thing ALOUD once. Every place you stumbled is a rewrite.

## Handing off

`film-production` renders it. `sound-design` owns the sfx and music bed — write
the `sfxLibrary` prompts as you write the script, while you still remember what
each moment is supposed to *feel* like.
