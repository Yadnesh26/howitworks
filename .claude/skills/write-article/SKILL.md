---
name: write-article
description: Write the SEO article content (article.js) that renders beneath an explainer's 3D scene on its prerendered page. Use when asked to add article content, write the direct-answer/parts/numbers/FAQ/failure-mode sections for an explainer, or expand an explainer's page depth for search. Covers the research-first workflow, the article.js schema, and the voice/accuracy bar from SOUL.md.
---

# Write an explainer's article content

## What this is

`scripts/prerender.mjs` turns each explainer into a real static page —
today that page is just the step-by-step narrative (~250–900 words). This
skill adds five more sections beneath the steps, rendered from an optional
`src/explainers/<id>/article.js`: a direct-answer snippet, a parts list, a
numbers table, common questions, and failure modes. Target: 1,200–1,800
words total per page. See `docs/seo-plan.md` §C1 for why this exists.

`article.js` is a plain data module — same shape as `video.js`, no imports,
just an exported object — read directly by `prerender.mjs`. Every top-level
field is optional; the page renders only the sections present, so a
half-finished file still improves the page rather than blocking on
completeness.

## The non-negotiable rule

**Every number and claim must be genuinely researched, never templated or
guessed.** SOUL.md: *"The mechanism is sacred... researched, fact-checked,
never simplified into being wrong. We'd rather cut a step than fake one."*
That applies exactly as hard here as it does to the 3D model — omit a
section entirely rather than fill it with plausible-sounding filler.

## Workflow

### 1. Gather what already exists — before any new research

Read, in this order, all free and already fact-checked:
- `meta.js` — `spec` and `summary` fields
- every step's `body` in `index.js` — the existing narrative
- `video.js` if present (`ls src/explainers/<id>/` to check) — narration
  written for the exported video. **Confirmed genuinely additive, not a
  restatement of step body** — mine it for numbers and hooks the step
  copy doesn't have. But it's written to be *spoken* (short clauses,
  contractions); never paste it in — rewrite anything used as prose that
  fits the page.

### 2. Identify the gaps

Check what's missing against the five sections below. In practice, across
this library: `numbers` is the most commonly empty (about half of all
explainers have zero digit-bearing figures in their step body — don't
assume `spec`'s one line is enough for a full table), and `failureModes` is
missing almost everywhere (only a handful of explainers have any
misconception/failure content anywhere yet).

### 3. Research the gaps

WebSearch + WebFetch canonical sources, batched in one message. Hunt
specifically for:
- **Real figures** — an actual RPM/temperature/pressure/tolerance/percentage
  with a source, not "very fast" or "extremely hot."
- **Genuine failure modes or misconceptions** — a real thing that actually
  goes wrong, or a real misconception people actually hold (e.g.
  black-hole's video.js already has a ready myth-busting beat: black holes
  don't "suck" — swap the Sun for one of equal mass and Earth's orbit is
  unchanged). Don't manufacture a failure mode to fill the section.

### 4. Author `article.js`

```js
// src/explainers/<id>/article.js
export default {
  directAnswer: {
    question: 'How does a jet engine actually work?',  // phrased as a real search query
    answer: '…',                                          // 1-2 sentences, ~40 words, stands alone — this is the featured-snippet target
  },
  parts: [                                                // omit entirely if "parts" doesn't map (e.g. an algorithm, a concept)
    { name: 'Fan', body: '…' },
  ],
  numbers: [                                              // renders as a real <table> — the hardest section to fill honestly
    { label: 'Core rotation speed', value: '10,000+ RPM', note: 'sustained continuously, not a peak figure' },
  ],
  faq: [                                                  // plain prose — NOT FAQPage schema (Google killed FAQ rich results May 2026)
    { q: 'Why do jet engines take so long to spool up?', a: '…' },
  ],
  failureModes: [                                         // same {q, a} shape as faq, own section heading ("What goes wrong")
    { q: 'What happens if a fan blade fails mid-flight?', a: '…' },
  ],
};
```

Voice, per SOUL.md's "How we sound": concrete nouns, present tense, second
person where it helps. Numbers are characters, not decoration — pick the
one number that makes a fact vivid rather than listing everything you
found. Cause → effect, never definition-first. Calm — "here is its secret,"
never "amazing" or "revolutionary."

`faq`/`failureModes` answers should read like something a knowledgeable
person would actually say out loud, not a boilerplate Q&A pair.

### 5. Verify

```sh
npm run build   # vite build && node scripts/prerender.mjs
```

Then confirm, don't assume:
- `dist/<id>/index.html` contains the new sections as real text (fetch it
  directly — no JS execution — the same way the page's crawlability was
  verified for F1).
- Total word count lands in 1,200–1,800 (rough eyeball is fine; this isn't
  a hard gate).
- `dist/assets/<id>-*.js` is still emitted — `article.js` is never imported
  by anything client-side, so the lazy chunk split shouldn't be able to
  regress from this work, but a quick check costs nothing and this is
  exactly the kind of regression that's silent until checked (CLAUDE.md
  rule 2).

No reviewer-agent cycle is required for article content the way
`add-explainer` requires one for a 3D model — the accuracy bar is enforced
by doing real research in step 3, not by a second pass. Re-read your own
`article.js` once against SOUL.md's voice before calling it done.
