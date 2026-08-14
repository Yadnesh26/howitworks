# SEO plan

Goal: rank #1 for each machine's own query ("how a jet engine works") **and**
for its 3D/interactive variants ("jet engine 3d animation", "jet engine
cutaway"). Audited 2026-08-14 against the live site and this repo.

Presentation version (same content, readable):
<https://claude.ai/code/artifact/33ff273d-e873-42fc-8a47-1ca17f6abb87>

Read [audience-capture-plan.md](audience-capture-plan.md) alongside this — its
P1/P2 prerequisites are the same work, framed for distribution rather than
search. This file supersedes nothing there; it expands P2 into a full plan.

---

## 1. Diagnosis — measured, not estimated

| Finding | Value |
| --- | --- |
| Indexable URLs for the whole library | **1** |
| Pages in Google's index (`site:whatdstuff.com`) | **0** |
| HTML served to a crawler | **670 bytes** — title, viewport, empty `<div>` |
| Step copy invisible to search | **26,253 words** across 48 explainers |
| `/jet-engine`, `/robots.txt`, `/sitemap.xml` | **404** |
| Plate images reachable by search | **0** of 48 |
| Eager JS before first paint | **946 KB** (`dist/assets/index-*.js`) |

Three stacked failures. Only the first matters until it is fixed:

1. **The site is one page.** `src/main.js` routes on `location.hash`. A
   fragment never reaches the server and is never indexed as a separate page,
   so all 48 explainers are one document to search.
2. **That page is empty.** No description, `<h1>`, body copy, OG tags,
   canonical or favicon. Google renders JS, but on a deferred rationed pass —
   and a 946 KB Three.js bundle is exactly what gets deprioritised there.
   Crawlers that don't render at all (most AI answer engines, social
   unfurlers) see a blank rectangle.
3. **Nothing points at it.** No robots.txt, no sitemap, no Search Console, ~0
   inbound links.

**The asset that makes this cheap:** all 48 `meta.js` files already carry
`title`/`summary`/`spec`/`keywords`; step copy averages 547 words/explainer
(median 506, min 199 `table-fan`, max 1370 `rocket-engine`); 40 of 48 have
narration in `video.js` (~500 more words each); 48 plates are rendered. This is
plumbing work with the content layer already paid for.

---

## 2. Two races, not one

| | Race A — mechanism query | Race B — 3D/interactive query |
| --- | --- | --- |
| Example | "how a jet engine works" | "jet engine 3d animation" |
| Incumbents | ExplainThatStuff, HowStuffWorks, Pilot Institute, Boldmethod, PopSci, Wikipedia — 1,500–3,000 word pages on 20-year-old domains | Sketchfab, TurboSquid, CGTrader, Envato — all selling **files**, not explanations. Only real rival: Animagraffs |
| Gated by | Domain authority + content depth | Indexing only |
| First wins | Long tail, month 3 | Google Images, week 4–6 |
| Realistic #1 | 12–24 months on head terms | 2–5 months |

**Win Race B first and let it fund Race A.** The 3D cluster converts to links
and shares far better than a text explainer ("look at this thing" travels);
those links are the authority Race A is gated on. Note the one query to *not*
chase: "jet engine 3d **model**" is asset intent — the marketplaces deserve it.

---

## 3. Foundation (F) — unblocks everything

Strictly ordered. There is no parallel path around F1.

**Status (2026-08-14): F1–F4 implemented and locally verified, not yet
committed or deployed.** `src/main.js`, `src/home.js`, `src/framework/player.js`,
`scripts/prerender.mjs` (new), `package.json`, `index.html`,
`public/robots.txt` (new). Verified: `verify.mjs` still passes against the
legacy hash route (build/boot/loops/navigation/errors gates all pass — the one
failing gate, `clipping` on jet-engine step 3, is a pre-existing camera-framing
issue unrelated to this change); lazy chunk split intact (49 asset chunks,
main bundle unchanged at 946 KB); direct deep-link load, click-through SPA
nav, browser back button, and the `#/<id>` fallback all verified clean via a
headless Playwright smoke test. **F5 (Search Console + Bing + IndexNow
verification) is still outstanding** — it needs the site owner's accounts and
can't be done from the repo.

### F1 · Real URLs + prerendered HTML — ✅ IMPLEMENTED 2026-08-14 (not yet deployed)

History API routing, then a genuine static HTML file per route emitted at
build time.

- **Router — accept BOTH forms.** `src/main.js` resolves the id from
  `location.pathname` when there is one and falls back to `location.hash`
  otherwise; intercept same-origin clicks and `pushState`. This is the single
  most important risk decision in the plan: a router that still answers
  `/#/jet-engine` means the seven Playwright scripts keep working **unchanged**,
  so the SEO fix cannot break the render pipeline. Hash URLs are not separate
  URLs to Google, so serving both costs nothing as long as nothing links to the
  hash form and the canonical always points at the path.
- **Links** — `src/home.js` has 6 `href="#/…"` sites + 2 `location.hash`
  assignments. These must move to paths (they are what search follows).
- **Tooling** — 7 scripts navigate by hash: `verify.mjs` (×3 call sites),
  `review-shots.mjs`, `export-video.mjs`, `render-film.mjs`,
  `make-thumbnails.mjs`, `make-plates.mjs`. With the dual router above they
  need no change to keep working; migrate them to paths in a **separate
  follow-up commit**, so a tooling regression is never tangled up with the
  routing change.
- **Prerender** — post-build Node pass over the registry writing
  `dist/<id>/index.html` with the real `<h1>`, summary, every step heading and
  body as text, breadcrumbs and plate; canvas boots over it. Playwright is
  already a devDependency if rendering beats templating.
- **Host** — Vercel serves those files directly; each URL returns a true 200
  instead of today's 404. No rewrite rules needed.

**Impact:** 1 → ~60 indexable pages, ~26,000 existing words exposed to
crawlers. Every other item is a multiplier on this one.

### F2 · Unique title + meta description per page — ✅ IMPLEMENTED 2026-08-14

Generated from `meta.js` in the prerender step so they can't drift.

- Title: `How a Jet Engine Works — Interactive 3D | whatDstuff`. Titles already
  read "How a … Works" (the exact query form); "Interactive 3D" is the Race B
  keyword *and* the click differentiator against nine text articles.
- Description: `summary` trimmed to ~155 chars, `spec` appended where it fits.
  Already unique and already in the house voice.

**Impact:** title remains the strongest on-page relevance signal; description
drives CTR, which converts position 6 into position 3 over time.

### F3 · robots.txt + sitemap.xml + image sitemap — ✅ IMPLEMENTED 2026-08-14

Emit from the registry in the same build step so they're never stale. Don't
block `/assets/` (Google needs the JS/CSS to render). `lastmod` from git commit
date, not build time. **Separate image sitemap for the 48 plates** — cheapest
lever in Race B, currently zero.

**Impact:** compresses discovery from months to days; makes coverage
debuggable. No direct ranking effect.

### F4 · Canonicals + one hostname — ✅ IMPLEMENTED 2026-08-14

Apex already 308s to `www` — keep it as the only truth. Self-referencing
`<link rel="canonical">` everywhere; pick a trailing-slash policy and enforce
it; **strip UTM params from the canonical** or the campaign links from
`make-postkit.mjs` will fragment each page's signals across duplicates.

**Impact:** preventive. Invisible when right, quietly expensive when wrong —
and with a UTM convention already in the postkit it will go wrong by default.

### F5 · Search Console + Bing Webmaster + IndexNow — HIGH · 1 h

Verify the day F1 ships; submit the sitemap. Bing feeds **ChatGPT's web
results** and is far easier to enter than Google's index.

**Impact:** no ranking effect, but without it you can't distinguish a content
problem from an indexing problem for six months. Also the fastest first crawl.

### F6 · OG tags, Twitter cards, favicon — MEDIUM · 2–3 h

Per-page `og:*` using the explainer's own plate (1200×630),
`twitter:card=summary_large_image`. Already P1 in the audience plan.

**Impact:** zero ranking weight, large indirect weight — every link posted to
Reddit/X/Discord currently renders as a grey rectangle, suppressing exactly the
clicks that produce the links Race A needs. A link-acquisition fix in a
metadata costume.

---

## 4. Page depth (C) — the gap between indexed and #1

After F1 a jet-engine page carries 283 words; pages beating it carry
1,500–3,000. Target **1,200–1,800 words** of genuinely useful text — most of it
already written.

### C1 · A real article beneath the 3D — ✅ PILOT SHIPPED 2026-08-15 (5/48)

Below the scroll experience, not replacing it. Same voice, no filler. **This
section originally assumed the `keywords` field could be auto-split into a
parts list and `video.js` narration could be mechanically reworked into page
prose — a research pass before building disproved both** (`keywords` mixes
single words with unmarked multi-word phrases, brand names and acronyms, and
abstract terms for non-physical explainers; `video.js` is written to be
*spoken*, not read). What actually shipped:

- **New per-explainer file, `src/explainers/<id>/article.js`** — a plain
  data module (no imports, same shape as `video.js`), safe for
  `scripts/prerender.mjs` to import directly the way it already imports
  `meta.js`. Five optional fields, each rendered only if present so a
  half-finished file still improves the page: `directAnswer` (the 40-word
  snippet target), `parts`, `numbers` (a real `<table>`), `faq`, and
  `failureModes` (`faq`/`failureModes` share one `{q, a}` shape, different
  section heading). Schema, rendering, and the full authoring workflow are
  documented in `.claude/skills/write-article/SKILL.md`.
- **`video.js` stays a research source, never a rendered field** — mined for
  facts during authoring, rewritten in article voice, never pasted in as
  spoken-word prose under the steps.
- **Numbers and failure modes are frequently NOT already in the site's own
  copy** — about half the library has near-zero digit-bearing figures in
  step body text (jet-engine: zero, despite its own spec line). Budget C1 as
  genuine per-explainer research (WebSearch + WebFetch, same discipline as
  `add-explainer`'s mechanism research), not a templating pass.
- **Pilot batch (done): jet-engine, x-ray-machine, car-suspension,
  washing-machine, induction-cooktop** — deliberately split between the
  numeric-sparse case (jet-engine) and numeric-rich cases, to prove the
  pipeline against both before committing to the other 43. All 5 verified:
  build clean, lazy chunk split intact, 1,331–2,108 words/page, hydration
  swap clean (0 leftover static DOM in the live client-side page).
- **This content is crawler-visible only, by deliberate choice** — it
  renders in the prerendered HTML for search engines and non-JS crawlers,
  but is NOT rendered into the live client-side player. Explicitly decided
  against extending the visible product UI for this content; revisit only if
  asked.
- **Common questions render as plain prose headings**, not FAQPage schema
  (dead since May 2026 — see S4).

**Impact:** the difference between ranking somewhere and ranking first. Each
completed page goes from ~1 viable query to 15–40.

**Remaining 43 — deferred, not scheduled.** Two-tier split recommended: full
5-section treatment for high-search-demand explainers (fridge, AC,
transistor were called out in the original draft as good next candidates);
a lighter `directAnswer` + `numbers`-only pass for conceptual explainers
where `parts`/`failureModes` don't map cleanly (binary-search, gps-style
topics). Revisit the priority line after Search Console has real query data
on which pages are actually contesting rankings, rather than guessing now.

### C2 · Internal linking + category hubs — HIGH · 1 day

Breadcrumbs everywhere (`Machines → Vehicles → Jet Engine`) with
`BreadcrumbList`; a related-mechanisms block generated from shared
`categories` + `keywords`; the 8 category pages given 300–500 words of original
framing so they can rank themselves; descriptive contextual anchors in the
article text.

**Impact:** spreads authority from whichever page earns links across the whole
library. The roadmap's "compounding library" north star only pays off if the
pages are actually wired together.

### C3 · Component / concept pages — HIGH · 2–3 days

Every `keywords` field names parts that are themselves searched (compressor,
commutator, solenoid, magnetron, piezo). Explain the part; link out to every
explainer containing one. Start with 10–15 that appear in 3+ explainers.

**Impact:** a second layer of entry points at a fraction of an explainer's
cost; makes the library legible as a connected encyclopedia.

### C4 · Dates, byline, sources — MEDIUM · 1 day

Published/updated dates, a real studio byline, an about page describing the
research process, sources where a mechanism is contested. `add-explainer`
already fact-checks against references — nothing on the page says so.

**Impact:** feeds quality signals for informational content and measurably
raises AI-citation rates, which favour dated, attributed pages.

---

## 5. Structured data (S) — what still works in 2026

### S1 · TechArticle + BreadcrumbList — HIGH · 4 h
JSON-LD from the prerender step. `TechArticle` (headline, description, image,
dates, author, publisher, `about`) + `BreadcrumbList` mirroring the visible
trail. **Impact:** breadcrumbs change how the URL displays and lift CTR;
article markup is how the page gets classified, and classification is what
makes it eligible for everything else.

### S2 · Organization + WebSite — HIGH · 2 h
Home page only. `Organization` with the existing YouTube/Instagram/Facebook
profiles as `sameAs`; `WebSite` + `SearchAction` (the library already has
client-side search in `home.js`). **Impact:** builds the brand entity so
"whatdstuff" resolves as a known publisher, and links the site to the channel
where the audience already is.

### S3 · VideoObject where a video is embedded — MEDIUM · 3 h
Name, description, thumbnail, upload date, duration, `SeekToAction`.
**Caveat most guidance misses:** Google now only surfaces videos in video
results when the video is the page's **main content**. On an explainer page the
canvas is the main content, so an embed supports the page without earning video
results itself. Separate watch pages would be a deliberate product choice, not
a side effect.

### S4 · FAQPage, HowTo, llms.txt — **DO NOT BUILD** (saves ~1 day)

- **HowTo** — rich results removed 2023, docs deleted. Valid schema, no surface.
- **FAQPage** — rich results stopped appearing **7 May 2026**.
- **llms.txt** — Google's docs state Search ignores it; no measured citation
  lift for the ~10% of sites shipping one. This cycle's keywords meta tag.

Still write the FAQ **content** — question-shaped headings answered directly
are exactly what gets extracted. The markup is dead, not the format.

---

## 6. The 3D cluster (D) — where #1 is genuinely available

~8 modifier shapes × 48 machines ≈ 380 target queries, most with no serious
incumbent: `3d animation`, `cutaway`, `cross section`, `interactive`,
`diagram`, `simulator`, `how … works animation`, `exploded view`.

### D1 · Google Images — CRITICAL · 1 day
The fastest win available. Image rankings depend far less on domain authority
than web results.
- Filenames: `jet-engine-cutaway-3d-cross-section.jpg`, not `jet-engine.jpg`.
- Alt text generated from `title` + `spec`, describing the visible mechanism.
- A real caption near each image (Google weights adjacent copy heavily).
- **`review-shots.mjs` already emits a deterministic frame per step** —
  publishing those as captioned figures multiplies image entry points ~7–8× per
  explainer overnight.
- Image sitemap + licence metadata for the licensable badge.

**Impact:** highest return per hour in this document. ~350+ indexable images
from tooling that already runs, on a surface a new domain can win in weeks.
This is the first traffic the site will see.

### D2 · Own the modifier language on-page — HIGH · folded into C1
The page never uses the words people search with. "Interactive 3D" in the title
(F2); a section headed "Jet engine cutaway — what the cross-section shows".
Not keyword stuffing: the page genuinely *is* an interactive 3D cutaway and
currently fails to say so.

### D3 · Embeddable widget — HIGH · 2–3 days
`/embed/<id>`, `noindex`, with a visible followed "whatDstuff" credit link.
The highest-leverage authority play available, because the product is
inherently embeddable in a way an article never is.
**Impact:** converts the product's real advantage into the currency Race A runs
on. One physics teacher's resource page beats a month of writing.

### D4 · A "3D library" index page — MEDIUM · 1 day
Targets the collective query and gives outreach/embeds a single URL to point
at, which then distributes authority across all 48 via C2.

---

## 7. Video (M) — the second search engine

### M1 · Retitle for search, keep the hook for the feed — HIGH · 2–3 h
A short's title fights for a swipe; a search result fights for a query. The
long cut should be "How a Jet Engine Works — 3D Animation" even when the short
keeps the hook. Descriptions carry the article's first paragraph + a UTM-tagged
link to the **specific explainer**, never the home page. Copy lives in
`video.js` → `platforms`; `make-postkit.mjs` already assembles it.

### M2 · Embed + publish the transcript — MEDIUM · 1 day
The `video.js` narration is already written prose; as an on-page transcript it
adds ~500 relevant words and gives S3's markup something real to describe.
Google explicitly ignores transcript data declared in markup but absent from
the page.

### M3 · Upload captions on every published video — MEDIUM · ~1 h/video
YouTube indexes caption text separately from the title/description and uses it
for both YouTube search matching and (occasionally) surfacing timestamped
clips in Google results. Captions default off in this project's export
pipeline (see `captions-overlay` skill), so this means deliberately generating
and uploading an `.srt` for the public cut — cheap because the
voice-matched-verbatim script already exists in `video.js` narration and
`words.json`, so it's formatting, not writing.

**Impact:** small standalone lift, but near-zero marginal cost since the text
is already written. Do it as part of the M1 retitling pass, not separately.

---

## 8. Performance (P) — a 3D site's structural handicap

CWV rarely wins a ranking; it can lose one.

- **P1 · Prerendered text as the LCP element — HIGH, free with F1.** Today the
  largest paint waits on Three.js parse + scene build + first frame. After F1
  the heading and article paint from HTML immediately. Also removes the risk of
  Google's renderer timing out before content exists — the failure mode that
  quietly keeps JS sites out of the index.
- **P2 · Defer canvas construction — MEDIUM, 1 day.** Build the scene on
  scroll/interaction, never under data-saver or `prefers-reduced-motion` (show
  the plate). A continuously running render loop competes with the main thread
  on every tap — which is what INP measures.
- **P3 · Image + font discipline — MEDIUM, half day.** Plates as AVIF/WebP with
  explicit dimensions and `loading="lazy"`; preload only the one above-the-fold
  face (the build ships Archivo + Space Grotesk + JetBrains Mono across latin,
  latin-ext, cyrillic, greek and vietnamese subsets); year-long Cache-Control on
  hashed assets.

---

## 9. Authority (A) — the honest constraint

No technical shortcut exists. This is what separates position 8 from position 1
on competitive terms.

- **A1 · Reddit / HN participation — CRITICAL, ongoing.** Reddit is now the
  most-cited domain across AI answer engines. r/EngineeringPorn,
  r/educationalgifs, r/mechanical_gifs, r/InternetIsBeautiful exist for exactly
  this artifact. Participate, don't drop links. **F6 must ship first** or every
  post renders as a grey rectangle. Highest-variance item in the plan.
- **A2 · Education outreach — HIGH, ongoing.** Teachers link to good visual
  resources permanently, from domains search trusts disproportionately. Combined
  with D3, the most durable link source available. A handful of `.edu` links
  moves Race A more than fifty blog mentions.
- **A3 · Publishing cadence — MEDIUM, ongoing.** A site publishing weekly gets
  crawled far more often than one publishing in bursts. Ship the *existing*
  library on a schedule; keep `lastmod` honest.

**Do not:** buy links, use guest-post networks, blast directories, or spin AI
articles for "topical authority". The defensible position here is that the
mechanism is real and the craft is visible; cheap links are the one thing that
could cost the domain more than its current silence.

---

## 10. AI answers (G)

No separate technical stack — everything that earns citations is already above:
crawlable HTML (F1), question-shaped headings answered in the first two
sentences (C1), original numbers (C1), visible dates and attribution (C4),
being discussed on Reddit (A1).

Two things specific to this surface: verify in **Bing Webmaster Tools** (F5),
since Bing feeds ChatGPT's web results; and **don't block `GPTBot`,
`ClaudeBot`, `PerplexityBot`, `Google-Extended`** — for a project whose model is
attention and commissions, being quoted with attribution is distribution.

---

## 11. Everything ranked

| ID | Action | Impact | Effort | First effect | Depends on |
| --- | --- | --- | --- | --- | --- |
| F1 | Real URLs + prerender | **Critical** | 2–4 d | 2–6 wk | — |
| F2 | Unique titles + descriptions | **Critical** | 3–4 h | 2–6 wk | F1 |
| D1 | Google Images work | **Critical** | 1 d | 3–6 wk | F1, F3 |
| C1 | Article layer beneath the 3D | **Pilot done · 5/48** | 2–4 h/page | 6–12 wk | F1 |
| A1 | Reddit / HN participation | **Critical** | ongoing | immediate | F6 |
| F3 | robots.txt + sitemaps | High | 2 h | days | F1 |
| F4 | Canonicals + one hostname | High | 1 h | preventive | F1 |
| F5 | Search Console + Bing + IndexNow | High | 1 h | days | F1 |
| D2 | Modifier language on-page | High | in C1 | 6–10 wk | C1 |
| D3 | Embeddable widget | High | 2–3 d | 3–9 mo | F1 |
| C2 | Internal links + category hubs | High | 1 d | 4–8 wk | F1 |
| C3 | Component / concept pages | High | 2–3 d | 8–16 wk | C1, C2 |
| S1 | TechArticle + BreadcrumbList | High | 4 h | 2–6 wk | F1 |
| S2 | Organization + WebSite | High | 2 h | 4–12 wk | F1 |
| P1 | Prerendered text as LCP | High | free w/ F1 | immediate | F1 |
| M1 | Retitle videos for search | High | 2–3 h | 2–8 wk | — |
| A2 | Education outreach | High | ongoing | 3–12 mo | D3 |
| F6 | OG cards + favicon | Medium | 2–3 h | immediate | F1 |
| C4 | Dates, byline, sources | Medium | 1 d | 4–12 wk | C1 |
| S3 | VideoObject where embedded | Medium | 3 h | 4–8 wk | M2 |
| D4 | 3D library index page | Medium | 1 d | 6–12 wk | C2 |
| M2 | Video embed + transcript | Medium | 1 d | 4–10 wk | C1 |
| M3 | Upload captions on videos | Medium | ~1 h/video | 2–8 wk | — |
| P2 | Defer canvas construction | Medium | 1 d | immediate | F1 |
| P3 | Image + font discipline | Medium | half d | immediate | — |
| A3 | Publishing cadence | Medium | ongoing | ongoing | F3 |
| S4 | FAQPage / HowTo / llms.txt | **Zero** | skip | never | — |

---

## 12. First ninety days

| When | Work |
| --- | --- |
| Week 1 | F1, F2, F3, F4, F5. Re-point the 7 Playwright scripts and run `verify.mjs` across the library before merging. |
| Week 2 | F6, D1, P3, S1, S2. Submit the sitemap; manually request indexing on the 10 strongest explainers. |
| Weeks 3–6 | C1 on the top 12 explainers, C2, D2, M1. First image traffic should appear here. |
| Weeks 7–10 | C1 on the remaining 36, D3, D4, M2, C4. Begin A1 in earnest, one explainer at a time. |
| Weeks 11–13 | C3, A2, P2. Read the Search Console query report and let real queries — not guesses — direct the next quarter. |

**Checkpoints.** Day 30: 60+ pages indexed, first impressions, image results
appearing; don't expect clicks. Day 90: top-3 on several Race B queries,
page-one long tail in Race A, first earned links, hundreds–low thousands of
monthly visits. Month 6: Race B largely won; Race A competitive mid-tail.
Month 12–18: head terms contestable **if** section 9 actually happened — that's
the variable, not the content.

---

## 13. Failure modes

- **The pipeline breaks quietly.** 7 scripts navigate by hash; if F1 drops hash
  support, verify/export/film rendering all fail, possibly not immediately.
  Mitigated by the dual router in F1 — keep answering hash URLs and this risk
  goes to near zero. Run a full `verify.mjs` pass before merging regardless.
- **Prerendering breaks the lazy split.** CLAUDE.md rule 2: if the prerender
  step static-imports explainers to read their steps, `vite build` stops
  emitting per-explainer chunks and every visitor downloads all 48. Read step
  copy in a separate Node pass, never from the app bundle.
- **Thin pages get indexed and ignored.** F1 without C1 puts 199-word pages in
  the index; pages judged thin recover more slowly than pages never crawled.
  Prioritise C1 for the weakest explainers or hold them out of the sitemap.
- **Waiting for perfect.** The likeliest failure is none of this shipping
  because it competes with explainer #49. The audience plan already reached
  this conclusion: inventory isn't the constraint.
- **Judging it at day 30 by traffic.** Nothing moves before week 4. Judge by
  indexed pages and impressions, or it will look like failure exactly when it
  is working.
