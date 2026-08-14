# Audience & capture plan

The centralized thing is **not a website**. It is one email list, one analytics
view, and one link convention — shared by every project (whatDstuff, journeys,
anything later). Projects are separate products with separate front doors; the
*audience system* behind them is single.

A projects hub is explicitly out of scope. It serves the author, not the
visitor: someone who arrived for "how a refrigerator works" wants another
mechanism, not a menu of unrelated work. Personal portfolio, if ever, lives on
a personal domain and stays disconnected from the product brands.

---

## 1. The system (set up once)

| Piece | Choice | Why |
| --- | --- | --- |
| Email | Buttondown or Kit | List lives with the provider, never in a repo. Exportable. One list, tagged by source — not one list per project. |
| Analytics | Plausible or Umami | Cookieless, so **no consent banner** — a consent popup over a 3D hero is a conversion killer. Self-host Umami if cost matters. |
| Links | UTM convention (below) | The only way to know which video sent which visitor. |

**One list, tags not lists.** `tag:whatdstuff`, `tag:journeys`,
`source:youtube`, `source:shorts`. A subscriber who came for a gearbox and one
who came for the observable universe are the same person to the provider, and
segmentable when they aren't.

### UTM convention

```
https://<domain>/<slug>?utm_source=<platform>&utm_medium=<format>&utm_campaign=<explainer-id>
```

- `utm_source` — `youtube` · `instagram` · `x` · `reddit` · `linkedin`
- `utm_medium` — `short` · `longform` · `bio` · `comment`
- `utm_campaign` — the explainer/journey id, so per-topic pull is visible

Generate these in `make-postkit.mjs` alongside the copy, so the tagged link is
already in `POST.md` at posting time and never hand-assembled.

---

## 2. Prerequisites — the site currently leaks

These block capture; do them before any capture UI.

**P1 · Link previews.** `index.html` carries a `<title>` and nothing else. Every
link posted to X / LinkedIn / Reddit / WhatsApp renders as a blank rectangle.
Add `og:title`, `og:description`, `og:image`, `twitter:card`, favicon.
`make-thumbnails.mjs` already renders suitable images — wire one per explainer.

**P2 · Real URLs. ✅ Implemented 2026-08-14, not yet deployed.** Hash routing
(`#/jet-engine`) meant URL fragments never reached the server and were not
indexed as separate pages — all explainers were one page to search. Now on
History API routing (hash form kept as a silent fallback for old links + the
Playwright tooling), with a static HTML shell prerendered per
explainer/category at build time (title, meta description, canonical, OG
tags, step copy as real text). `sitemap.xml` + `robots.txt` also added. See
`scripts/prerender.mjs` and `docs/seo-plan.md` § F1–F4.

This is the only channel that compounds without posting, and it is the one
entirely missing today.

**P3 · Analytics installed**, so P1/P2 and everything below are measurable.

---

## 3. Capture surfaces

Ordered by conversion quality. Capture at peak goodwill, never on arrival.

**S1 · End of an explainer (primary).** After the final step's payoff, in the
panel column — inline, not a modal, not an exit-intent popup, not a
site-wide banner. The visitor has just finished something satisfying; that is
the moment.

> New explainer every week. Get it before it's public.
> `[ email ]` `[ Get it ]`

**S2 · Video description + pinned comment.** The CTA is already
"play with it yourself" — keep it, but the link must be UTM-tagged and point at
the specific explainer, never the home page. Sending a refrigerator viewer to a
library index loses most of them.

**S3 · Home page, secondary.** One line under the hero. Low intent, low
conversion — present but never prominent.

**S4 · Share affordance.** A share button on each explainer with the OG card
working (P1). Cheap, and turns one visitor into a distribution event.

### Rules

- No modal, no popup, no interstitial, no exit-intent. They convert on
  content-farm sites and read as cheap on a premium-visual product.
- No pre-content gating, ever. The explainer is the product; it stays free.
- One field (email). No name, no "how did you hear about us".
- Confirm inline without navigating away.

---

## 4. What the list is for

A list you never mail is a dead asset. Minimum viable cadence: **one send per
new explainer**, containing the thing itself — a direct link, one paragraph on
the surprising bit, the video embedded. No "newsletter" framing, no roundups,
no filler weeks. If there is no new explainer, there is no send.

Secondary use, and the reason this matters commercially: the list is where
B2B commission enquiries surface. Include a single quiet line in the footer —
*"We build these for companies too."* — linking to a one-page brief. Costs
nothing per send; a single reply pays for the year.

---

## 5. Metrics

Track four numbers, weekly, nothing else:

1. **Uniques** — per source, per explainer
2. **Completion rate** — % of visitors reaching the last step (the real quality
   signal; a low number means the explainer, not the funnel, is the problem)
3. **Subscribe rate** — subs ÷ completions (S1's own conversion, isolated from
   traffic quality)
4. **Subscribers** — total, and net of unsubscribes

Deliberately not tracked early: time on page, bounce, scroll depth. Noise at
this volume.

---

## 6. Sequence

| Order | Work | Blocking |
| --- | --- | --- |
| 1 | Deploy to a real domain | everything |
| 2 | P1 — OG tags + favicon | all sharing |
| 3 | P3 — analytics + UTMs in postkit | all measurement |
| 4 | P2 — real URLs + prerender + sitemap ✅ | search, permanently |
| 5 | Email provider account, one list, tags | S1 |
| 6 | S1 — end-of-explainer capture | — |
| 7 | S2 — retag every existing video description | — |
| 8 | S4 — share button | — |

Steps 1–3 are hours. Step 4 is the real engineering. Steps 5–8 are small once
4 lands.

**Then stop building and post.** ~30 finished explainers and a render pipeline
already exist; the constraint is distribution, not inventory. Explainer #31 is
worth less than shipping the eight items above and posting the existing library
on a schedule.
