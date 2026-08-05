import { setLeader } from './labels.js';

// Runtime label declutter — keeps callout pills readable regardless of how
// their leaders were authored. Two jobs, resolved every frame:
//
//   1. pills must not overlap EACH OTHER  (classic vertical declutter)
//   2. pills must not leave the FRAME     (or hide under the mobile sheet)
//
// (2) is what portrait exposed: leaders are authored against the desktop frame,
// so on a phone half the pills hung off the right edge as "Cylinde", "Crankca",
// "COMPRESSI". Fixing that per-callout would mean re-tuning dir/len for every
// label in every explainer against a viewport width nobody can predict, so it
// is resolved here instead — once, for the whole library.
//
// Nudges are screen-space deltas relative to the anchor, so no camera
// projection is needed: the base leader (dir,len) plus the delta fully defines
// the new endpoint. Bases are reset from the element each frame so nudges never
// compound. Cheap for the handful of labels a step shows.
const MARGIN = 5; // px of clear space required between pills
const EDGE = 6; // px of clear space required against the frame edge
const GAP = 4; // labels.js's own pill-to-leader offset — must match

// Where setLeader will put a pill's left edge for a given endpoint offset.
// Mirrors the transform in labels.js: the pill hangs off whichever side of the
// anchor the leader points, so the sign of ex decides which.
const pillLeft = (ax, ex, tw) => (ex >= 0 ? ax + ex + GAP : ax + ex - tw - GAP);

export function declutterCallouts(scene) {
  const items = [];
  scene.traverse((o) => {
    if (!o.isCSS2DObject || !o.visible || !o.element) return;
    const el = o.element;
    if (!el.classList.contains('callout') || el.style.display === 'none') return;
    const tx = el.querySelector('.callout-text');
    if (!tx || el.dataset.baseDir === undefined) return;
    const bdir = parseFloat(el.dataset.baseDir);
    const blen = parseFloat(el.dataset.baseLen);
    setLeader(el, bdir, blen); // reset to authored position before re-measuring
    items.push({ el, tx, bdir, blen });
  });
  // NB: no early-out for a single label any more. Overlap needs two pills, but
  // running off the edge only needs one — and a lone label was exactly the case
  // that used to sail off-frame untouched.
  if (!items.length) return;

  const host = items[0].el.parentElement;
  if (!host) return;
  // Measure the frame the SAME way as the pills. Comparing two rects taken
  // from getBoundingClientRect in the same pass stays valid even where those
  // rects come back document-space rather than viewport-space (see the CSS2D
  // note in verify.mjs) — only their difference is used.
  const frame = host.getBoundingClientRect();
  if (!frame.width || !frame.height) return;

  // On mobile the active panel is a full-width sheet pinned to the bottom, so
  // anything below its top edge is invisible — treat it as the floor. On
  // desktop the panel is a narrow left column and is NOT a vertical bound, so
  // this only engages when the panel actually spans the frame.
  let floorY = frame.bottom - EDGE;
  const panel = document.querySelector('.panel.active');
  if (panel) {
    const pr = panel.getBoundingClientRect();
    if (pr.width > frame.width * 0.9 && pr.top > frame.top) {
      floorY = Math.min(floorY, pr.top - MARGIN);
    }
  }

  for (const it of items) {
    const a = it.el.getBoundingClientRect(); // zero-size box AT the anchor
    it.ax = a.left;
    it.ay = a.top;
    it.box = it.tx.getBoundingClientRect();
    it.tw = it.box.width;
    it.th = it.box.height;
    const rad = (it.bdir * Math.PI) / 180;
    it.baseEx = Math.cos(rad) * it.blen;
    it.baseEy = -Math.sin(rad) * it.blen;
  }

  // --- 1. horizontal: flip to the other side of the anchor if the authored
  // side has no room, else clamp. Done BEFORE the overlap pass so that pass
  // sees the boxes where they will actually sit.
  for (const it of items) {
    // Work in PILL-LEFT space, not offset space. An anchor can project well
    // outside the frame (measured: x=467 on a 390px-wide phone frame when a
    // part is off to the side), and in that case no constraint on the offset
    // alone keeps the pill in view — the pill's own edges are what must be
    // bounded. Solve for where the pill goes, then convert back.
    const minL = frame.left + EDGE;
    const maxL = Math.max(minL, frame.right - EDGE - it.tw);

    const authoredLeft = pillLeft(it.ax, it.baseEx, it.tw);
    let left = authoredLeft;
    if (left < minL || left > maxL) {
      const mirrored = pillLeft(it.ax, -it.baseEx, it.tw);
      left =
        mirrored >= minL && mirrored <= maxL
          ? mirrored // the other side of the anchor fits cleanly — real flip
          : Math.min(Math.max(left, minL), maxL); // neither does — clamp
    }

    // Convert the chosen left edge back into a leader endpoint, using the
    // branch for the side the pill actually landed on.
    const onLeft = left + it.tw / 2 < it.ax;
    let ex = onLeft ? left + it.tw + GAP - it.ax : left - it.ax - GAP;
    // setLeader picks its branch from sign(ex), and ex === 0 reads as "right".
    // A vertical leader (dir 90) has baseEx ~1e-15, so mirroring it stayed
    // effectively zero and the pill could never hang left — it just kept
    // overflowing. Force the sign to match the side actually solved for.
    if (onLeft && ex >= 0) ex = -1e-4;
    if (!onLeft && ex < 0) ex = 0;

    it.ex = ex;
    it.ey = it.baseEy;
    // Track movement as a change in PILL POSITION, not in the offset. The
    // branch-forcing epsilon above is ~1e-4 in offset space but relocates the
    // pill by its own width, so an offset-based "did it move?" test reads it as
    // no-op and skips the write — which is exactly how a clamped label went on
    // rendering at its overflowing authored spot.
    it.changed = Math.abs(left - authoredLeft) > 0.5;
    it.box = { left, right: left + it.tw, top: it.ay + it.ey - it.th / 2 };
    it.box.bottom = it.box.top + it.th;
  }

  // --- 2. vertical: push each pill below any already-placed pill it overlaps
  items.sort((a, b) => a.box.top - b.box.top);
  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    cur.ny = 0;
    for (let j = 0; j < i; j++) {
      const prev = items[j];
      const horiz =
        cur.box.left < prev.box.right + MARGIN && cur.box.right > prev.box.left - MARGIN;
      if (!horiz) continue;
      const overlap = prev.box.bottom + prev.ny + MARGIN - (cur.box.top + cur.ny);
      if (overlap > 0) cur.ny += overlap;
    }
  }

  // --- 3. vertical clamp: keep pills in frame and out from under the sheet.
  // Last, so it also catches pills the overlap pass just pushed down there.
  for (const it of items) {
    const top = it.box.top + it.ny;
    const clamped = Math.min(Math.max(top, frame.top + EDGE), Math.max(frame.top + EDGE, floorY - it.th));
    it.ny += clamped - top;
  }

  for (const it of items) {
    const ex = it.ex;
    const ey = it.ey + it.ny;
    // skip the rewrite when nothing moved, so untouched labels keep the exact
    // authored geometry rather than a float-rounded version of it
    if (!it.changed && Math.abs(it.ny) < 0.5) continue;
    const len = Math.hypot(ex, ey);
    const dir = (Math.atan2(-ey, ex) * 180) / Math.PI;
    setLeader(it.el, dir, len);
  }
}
