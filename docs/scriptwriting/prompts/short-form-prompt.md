# Short-form script generator prompt

Self-contained — paste this whole file into an LLM along with your filled-in
inputs below. Full rationale for every rule here lives in
`../core-psychology.md` and `../short-form-template.md`; this is the
condensed, operational version for drafting.

---

## Inputs (fill these in before sending)

- **Topic / idea**: {{TOPIC}}
- **Title**: {{TITLE}}
- **Story lens (your unique angle on this topic)**: {{STORY_LENS}}
- **Key point(s) / payoff**: {{KEY_POINTS}}
- **Target length**: {{LENGTH_SECONDS}} seconds

## Instructions to the model

Write a short-form video script (vertical, loops on replay) for the inputs
above. Follow this structure exactly:

1. **Hook (1–2 lines).** Compress these 4 beats into 1–2 sentences — they
   can double up in one line:
   - Context: state the plot directly.
   - Common belief: the conventional take on this topic.
   - Contrarian take: your actual (different) position.
   - Proof + plan: quick credibility + what's coming.
   Rules: the very first line must be punchy and name the plot directly —
   never an opaque teaser like "wait till you see this." Suggest one visual
   that should be on screen during the hook to reinforce it (describe it,
   don't just write dialogue).

2. **Loop / payoff.** Deliver on the hook's promise. If there's more than one
   beat here, order them so the 2nd-best beat comes before the best beat
   (rising value, not declining) — never lead with the single best beat.

3. **Last line.** Write it to loop back into line 1 when the video replays —
   it should work as both an ending and a setup for the hook. Make it
   quotable on its own.

Throughout: connect every beat with "but" or "therefore" logic, never
"and then" (no flat detail-piling). Vary sentence length — don't write a run
of same-length sentences.

Output the script as plain narration lines, one beat per line, plus a short
bracketed visual note wherever a specific on-screen visual matters.
