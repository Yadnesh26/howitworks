// Generate narration audio for an explainer's video export.
//
//   node scripts/make-narration.mjs <explainer-id> [--format long|short] [--voice <id>]
//     [--speed 0.9] [--keep-dashes] [--no-trim-pauses] [--max-pause 0.3] [--target-pause 0.15]
//
// SEAMLESS SINGLE-TAKE (ElevenLabs): all of a format's narration lines are
// concatenated into ONE script and synthesized in a SINGLE call to the
// /with-timestamps endpoint. That returns the audio plus character-level
// timing, so the whole voiceover is one continuous performance — no per-clip
// intonation resets, no stitched-together gaps. We then read each shot's real
// [start,end] from the alignment and write:
//   renders/<id>/audio/<format>-full.mp3       the one continuous take
//   renders/<id>/audio/<format>-timings.json   { "<shotIndex>": {start,end}, ... }
// export-video.mjs treats that timings file as the master clock (audio-master
// pacing). If it's absent it falls back to the old per-shot files below.
//
// FALLBACK (no ELEVENLABS_API_KEY, or the timestamps call fails): Microsoft
// Edge neural TTS, one file per shot (renders/<id>/audio/<format>-shot-NN.mp3)
// — the older per-shot path, still fully supported by the exporter.
//
// PAUSE TRIMMING (single-take path only, default ON): ElevenLabs' own silence
// at periods/commas is a delivery characteristic of the model, not something
// the text or the `speed` knob fully controls. Since the alignment gives
// exact word timing, any gap over --max-pause gets cut down to --target-pause
// directly in the audio (ffmpeg atrim+concat), and every later word/shot
// timestamp shifts back to match — captions and shot pacing stay in sync
// with the shortened take. Disable with --no-trim-pauses.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

// .env is never auto-loaded into process.env for a plain `node script.mjs`
// invocation (that's a Vite-dev-server-only behavior) — without this, a key
// sitting in .env is invisible here and the script silently falls back to
// the free engine. Guarded: CI / fresh checkouts may have no .env at all.
if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!id) {
  console.error('usage: node scripts/make-narration.mjs <explainer-id> [--format long|short] [--voice <id>] [--speed 0.9] [--keep-dashes]');
  process.exit(1);
}
const format = opt('format', 'long');

const videoJsPath = resolve(`src/explainers/${id}/video.js`);
if (!existsSync(videoJsPath)) {
  console.error(`${videoJsPath} not found — write the editorial layer first.`);
  process.exit(1);
}
const editorial = (await import(pathToFileURL(videoJsPath))).default;
const shots = editorial?.[format]?.shots ?? [];

const outDir = resolve('renders', id, 'audio');
mkdirSync(outDir, { recursive: true });

const key = process.env.ELEVENLABS_API_KEY;
// Precedence: --voice flag > VOICE_ID in .env (the channel voice) > "Adam".
// Without the .env fallback the channel voice had to be re-typed on every call
// and any run that forgot it silently reverted to the stock default.
const voice = opt('voice', process.env.VOICE_ID || 'pNInz6obpgDQGcFmaJgB');
const MODEL = 'eleven_multilingual_v2';
// speed: ElevenLabs synth rate (0.7–1.2, 1.0 = normal). We default to 0.9 —
// narration ~10% slower than natural — because the un-slowed takes felt rushed
// but a full 20% (0.8) dragged. This is genuine slower prosody, not time-stretch:
// the alignment ElevenLabs returns is already at this pace, so the timings.json
// the exporter clocks off stays correct with zero changes downstream. Override
// per-run with --speed.
const speed = Math.max(0.7, Math.min(1.2, Number(opt('speed', '0.9'))));
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed };

// Pause normalization (default ON; --keep-dashes to disable). ElevenLabs renders
// em/en-dashes and ellipses as long, FIXED pauses that the `speed` setting can't
// compress — so a dash-heavy script sounds draggy no matter the speed, and the
// speed knob becomes nearly inert (measured 2% length spread from 0.7→1.0 on a
// script with 4 em-dashes, vs 27% on clean prose). Downgrading those beats to
// commas restores both a snappier read and the speed knob's authority. Only
// spaced —/– and ellipses are touched; hyphens in "single-cylinder" are U+002D
// and never match.
const keepDashes = args.includes('--keep-dashes');

// Pause TRIMMING (default ON; --no-trim-pauses to disable): normalizePauses
// above fixes PUNCTUATION (dashes/ellipses become comma-length beats), but it
// can't touch how long ElevenLabs actually holds silence at a period or comma
// — that's the model's own delivery, not something in the text. Since we have
// exact word timing from the alignment, we trim it directly in the AUDIO
// after synthesis: any gap between two words longer than --max-pause gets cut
// down to --target-pause, and every later word/shot timestamp shifts back to
// match, so captions and shot pacing stay in sync with the shortened audio.
const trimPausesEnabled = !args.includes('--no-trim-pauses');
const MAX_PAUSE = Number(opt('max-pause', '0.3'));
const TARGET_PAUSE = Number(opt('target-pause', '0.15'));

const normalizePauses = (t) =>
  keepDashes
    ? t
    : t
        .replace(/\s*[—–]\s*/g, ', ') // spaced em/en-dash -> comma beat
        .replace(/\s*(?:…|\.\.\.)\s*/g, ', ') // ellipsis -> comma beat
        .replace(/,\s*,/g, ',') // collapse any doubled commas the swap created
        .replace(/\s{2,}/g, ' ')
        .trim();

// Which shots actually carry narration, in original-index order — the exporter
// keys timings by the ORIGINAL shot index, so a narration-less shot doesn't
// shift the mapping.
const narrated = shots
  .map((s, i) => ({ i, text: normalizePauses((s.narration ?? '').trim()) }))
  .filter((s) => s.text);

if (!narrated.length) {
  console.log('no narration lines in video.js');
  process.exit(0);
}

// --- clean stale audio so an aborted mode-switch can't leave both layouts ----
for (const f of ['full.mp3', 'timings.json', 'words.json'].map((n) => join(outDir, `${format}-${n}`))) {
  rmSync(f, { force: true });
}

// Reconstruct word-level timing from the character-level alignment ElevenLabs
// returns: walk the chars, accumulate non-space runs into words, and stamp each
// word with the start time of its first char and the end time of its last. This
// is what lets the exporter burn captions that MATCH the spoken voice (the
// captions-overlay "rail") instead of summary one-liners.
function wordsFromAlignment(chars, starts, ends) {
  const words = [];
  let cur = '';
  let s = 0;
  let e = 0;
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    if (/\s/.test(ch)) {
      if (cur) words.push({ t: cur, s: Number(s.toFixed(3)), e: Number(e.toFixed(3)) });
      cur = '';
      continue;
    }
    if (!cur) s = starts[k];
    cur += ch;
    e = ends[k];
  }
  if (cur) words.push({ t: cur, s: Number(s.toFixed(3)), e: Number(e.toFixed(3)) });
  return words;
}

// Shorten over-long silence directly in the AUDIO, then shift every
// downstream timestamp to match. Cuts are placed a MIN_EDGE buffer inside
// each gap (never right at the word boundary) so we're never at risk of
// slicing into actual speech — worst case a cut is skipped, never a clipped
// word. `timings` values are shot {start,end} pairs (same seconds-since-take
// axis as `words`), so one shiftTime covers both.
function trimPauses(audioBuffer, words, timings, { maxPause, targetPause }) {
  const MIN_EDGE = 0.04;
  const cuts = []; // { start, end } in ORIGINAL-audio seconds, to be removed
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].s - words[i].e;
    if (gap <= maxPause) continue;
    const removeAmount = gap - targetPause;
    const cutStart = words[i].e + MIN_EDGE;
    const cutEnd = Math.min(cutStart + removeAmount, words[i + 1].s - MIN_EDGE);
    if (cutEnd > cutStart) cuts.push({ start: cutStart, end: cutEnd });
  }
  if (!cuts.length) return { audio: audioBuffer, words, timings, cutCount: 0 };

  const totalDuration = Math.max(...words.map((w) => w.e)) + 1; // pad past the last word for any trailing audio
  const keep = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.start > cursor) keep.push([cursor, c.start]);
    cursor = c.end;
  }
  keep.push([cursor, totalDuration]);

  const tmpIn = join(outDir, `.trim-in-${Date.now()}.mp3`);
  const tmpOut = join(outDir, `.trim-out-${Date.now()}.mp3`);
  writeFileSync(tmpIn, audioBuffer);
  const filterParts = keep.map(
    ([s, e], k) => `[0:a]atrim=start=${s.toFixed(3)}:end=${e.toFixed(3)},asetpts=PTS-STARTPTS[a${k}]`,
  );
  const concatIn = keep.map((_, k) => `[a${k}]`).join('');
  const filterComplex = `${filterParts.join(';')};${concatIn}concat=n=${keep.length}:v=0:a=1[out]`;
  const r = spawnSync(ffmpeg, [
    '-y', '-i', tmpIn,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    tmpOut,
  ]);
  if (r.status !== 0) {
    rmSync(tmpIn, { force: true });
    rmSync(tmpOut, { force: true });
    throw new Error(`pause-trim ffmpeg failed:\n${r.stderr?.toString().slice(-1500)}`);
  }
  const trimmedAudio = readFileSync(tmpOut);
  rmSync(tmpIn, { force: true });
  rmSync(tmpOut, { force: true });

  const shiftTime = (t) => {
    let removed = 0;
    for (const c of cuts) {
      if (c.end <= t) removed += c.end - c.start;
      else if (c.start < t) removed += t - c.start; // shouldn't happen (MIN_EDGE keeps cuts clear of word bounds)
      else break;
    }
    return Number((t - removed).toFixed(3));
  };
  const shiftedWords = words.map((w) => ({ t: w.t, s: shiftTime(w.s), e: shiftTime(w.e) }));
  const shiftedTimings = {};
  for (const [k, v] of Object.entries(timings)) {
    shiftedTimings[k] = { start: shiftTime(v.start), end: shiftTime(v.end) };
  }
  return { audio: trimmedAudio, words: shiftedWords, timings: shiftedTimings, cutCount: cuts.length };
}

async function elevenlabsSingleTake(fullText) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text: fullText, model_id: MODEL, voice_settings: VOICE_SETTINGS }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const audio = Buffer.from(json.audio_base64, 'base64');
  const a = json.alignment ?? json.normalized_alignment;
  if (!a?.character_start_times_seconds?.length) throw new Error('no alignment in response');
  return {
    audio,
    chars: a.characters ?? Array.from(fullText),
    starts: a.character_start_times_seconds,
    ends: a.character_end_times_seconds,
  };
}

async function edgeTtsPerShot() {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const edge = new MsEdgeTTS();
  await edge.setMetadata(
    args.includes('--voice') ? voice : 'en-US-ChristopherNeural',
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  );
  for (const { i, text } of narrated) {
    // rate matches ElevenLabs `speed` semantics (0.8 = 80% pace). No timings
    // file here — the exporter measures each per-shot clip's real duration and
    // extends the shot to fit, so slower clips stay in sync automatically.
    const { audioStream } = await edge.toStream(text, { rate: speed });
    const chunks = [];
    for await (const c of audioStream) chunks.push(c);
    const out = join(outDir, `${format}-shot-${String(i).padStart(2, '0')}.mp3`);
    writeFileSync(out, Buffer.concat(chunks));
    console.log(`shot ${i}: ${out}`);
  }
  console.log(`${narrated.length} per-shot segments (Edge fallback) -> ${outDir}`);
}

// Try the seamless single-take path first; fall back to per-shot on any error
// (missing key, endpoint failure) so an export never blocks on audio.
if (key) {
  try {
    // one continuous script; track each shot's inclusive char span in it
    const SEP = ' ';
    let full = '';
    const spans = [];
    narrated.forEach(({ i, text }, k) => {
      const startChar = full.length;
      full += text;
      spans.push({ i, startChar, endChar: full.length - 1 });
      if (k < narrated.length - 1) full += SEP;
    });

    console.log(`engine: ElevenLabs single-take (${full.length} chars, one call, speed ${speed})`);
    const { audio, chars, starts, ends } = await elevenlabsSingleTake(full);

    // clear any stale per-shot files from an older run so the exporter doesn't
    // mix layouts
    for (const { i } of narrated) {
      rmSync(join(outDir, `${format}-shot-${String(i).padStart(2, '0')}.mp3`), { force: true });
    }

    const clamp = (arr, idx) => arr[Math.max(0, Math.min(arr.length - 1, idx))];
    const timings = {};
    for (const { i, startChar, endChar } of spans) {
      timings[i] = {
        start: Number(clamp(starts, startChar).toFixed(3)),
        end: Number(clamp(ends, endChar).toFixed(3)),
      };
    }
    // word-level timing for voice-matched captions (the exporter's rail source)
    let words = wordsFromAlignment(chars, starts, ends);
    let finalAudio = audio;
    let finalTimings = timings;
    let trimNote = '';
    if (trimPausesEnabled) {
      const trimmed = trimPauses(audio, words, timings, { maxPause: MAX_PAUSE, targetPause: TARGET_PAUSE });
      finalAudio = trimmed.audio;
      words = trimmed.words;
      finalTimings = trimmed.timings;
      if (trimmed.cutCount) {
        trimNote = ` (trimmed ${trimmed.cutCount} pause${trimmed.cutCount === 1 ? '' : 's'} > ${MAX_PAUSE}s to ${TARGET_PAUSE}s)`;
      }
    }
    writeFileSync(join(outDir, `${format}-full.mp3`), finalAudio);
    writeFileSync(join(outDir, `${format}-timings.json`), JSON.stringify(finalTimings, null, 2));
    writeFileSync(join(outDir, `${format}-words.json`), JSON.stringify(words));
    const total = Math.max(...Object.values(finalTimings).map((t) => t.end));
    console.log(`single take: ${format}-full.mp3 (${total.toFixed(1)}s)${trimNote} + ${format}-timings.json (${spans.length} shots) + ${format}-words.json (${words.length} words)`);
  } catch (err) {
    console.error(`single-take failed (${err.message}) — falling back to Edge per-shot`);
    await edgeTtsPerShot();
  }
} else {
  console.log('engine: Edge neural TTS (no ELEVENLABS_API_KEY) — per-shot fallback');
  await edgeTtsPerShot();
}
