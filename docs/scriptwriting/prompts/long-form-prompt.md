# Long-form script generator prompt

Self-contained — paste this whole file into an LLM along with your filled-in
inputs below. Full rationale for every rule here lives in
`../core-psychology.md` and `../long-form-template.md`; this is the
condensed, operational version for drafting.

---

## Inputs (fill these in before sending)

- **Topic / idea**: {{TOPIC}}
- **Title**: {{TITLE}}
- **Story lens (your unique angle on this topic)**: {{STORY_LENS}}
- **Draft outline points** (bulleted, roughly in order of discovery, not
  final order): {{OUTLINE_POINTS}}
- **Target length**: {{LENGTH_MINUTES}} minutes

## Instructions to the model

First, **gut-check the outline points above**: flag any that read as
common/already-known information rather than something genuinely unique to
say. If more than one point looks like a restatement of common knowledge,
say so explicitly before drafting anything, and suggest what would make it
unique instead (a different example, a sharper distillation, a different
angle tied to the story lens) — do not silently draft a script from
un-unique points.

Once the outline is validated (or fixed), write the full script in this
structure:

1. **Intro — full 4-part hook**, each beat given real room (not compressed):
   - Context: state plainly what the video is about.
   - Common belief: the conventional take on this topic, stated in good
     faith.
   - Contrarian take: the actual, different position this video argues.
   - Proof + plan: credibility for why this take should be trusted, plus an
     ordered preview of what's coming.

2. **Body — one section per outline point**, reordered so the sequence goes
   **2nd-best point → best point → 3rd-best point → ...** (rising value, not
   declining — never lead with the single best point). For each point,
   write three parts in order:
   - Context: what it is, as simply as possible.
   - Application: how to do it, with a concrete example.
   - Framing: why it matters, how it connects to the overall story.
   Connect points to each other with "but"/"therefore" logic, never
   "and then."

3. **Outro.** Land the overall payoff of the video; optionally point to a
   next action.

Throughout: vary sentence length (don't write runs of same-length
sentences); keep the tone conversational, as if talking to one specific
person, not "an audience."

Output the script as full narration prose, organized under clear section
headers (Intro / Body: Point N / Outro) so each part is easy to locate and
edit independently.
