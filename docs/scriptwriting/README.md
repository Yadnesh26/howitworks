# Script-writing reference

Not related to the explainer app itself — a reference system for writing
short-form and long-form video scripts, split so the two formats don't share
one bloated template but do share one canonical set of principles.

- [`core-psychology.md`](core-psychology.md) — canonical. Expectations vs.
  reality, click confirmation, packaging/story lens, the 4-part hook, and
  universal craft rules (the Dance, rhythm, tone, visual hook). Both
  templates below build on this; neither restates it.
- [`short-form-template.md`](short-form-template.md) — compressed hook →
  single loop/payoff → last-line-loops-to-first-line. For anything short and
  looping.
- [`long-form-template.md`](long-form-template.md) — packaging → outline →
  full 4-part intro → ordered multi-point body (value loop per point) →
  outro. For anything long-form.
- [`prompts/short-form-prompt.md`](prompts/short-form-prompt.md) and
  [`prompts/long-form-prompt.md`](prompts/long-form-prompt.md) — self-contained,
  AI-fillable versions of the two templates above (condensed rules +
  placeholders), for handing to an LLM to draft from directly.

Writing by hand → use the two `*-template.md` files. Drafting with an LLM →
fill in the placeholders in the matching `prompts/*-prompt.md` file and send
just that file.
