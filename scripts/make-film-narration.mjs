// Generate narration for a long-form FILM — one continuous take PER ACT.
//
//   node scripts/make-film-narration.mjs <film-id> [--voice <id>] [--speed 0.92]
//                                        [--acts 0,1] [--keep-dashes]
//
// WHY PER ACT (and not one take for the whole film, like make-narration.mjs).
// A 9-minute script is well past what the /with-timestamps endpoint handles in
// one call, and a single failure would cost the whole film. Acts are also
// exactly where you WANT the performance to reset — a new act is a new open
// loop, and the 1.6s gap render-film.mjs leaves between them is a breath, not a
// seam. Within an act it is still ONE take, so intonation carries across the
// lines that actually belong together.
//
// Per-act `voiceSettings` in the manifest are the film's dynamic range: keep
// stability high for explanation acts, drop it (and raise style) for the tense
// ones. A film narrated at one flat setting for nine minutes is the single most
// common reason long-form TTS sounds like TTS.
//
// Writes renders/film-<id>/audio/
//   act-NN.mp3           the act's continuous take
//   act-NN-timings.json  { "<shotInAct>": {start,end} } — render-film's clock
//   act-NN-words.json    word-level alignment — the verbatim caption rail
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// .env is not auto-loaded for a plain `node script.mjs` run (that is a Vite
// dev-server behavior) — without this a key sitting in .env is invisible here.
if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));

const args = process.argv.slice(2);
const filmId = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!filmId) {
  console.error('usage: node scripts/make-film-narration.mjs <film-id> [--voice <id>] [--speed 0.92] [--acts 0,1]');
  process.exit(1);
}

const filmPath = resolve(`films/${filmId}/film.js`);
if (!existsSync(filmPath)) {
  console.error(`${filmPath} not found — write the film manifest first.`);
  process.exit(1);
}
const film = (await import(pathToFileURL(filmPath))).default;
const acts = film.acts ?? [];
const actFilter = opt('acts', null)?.split(',').map(Number) ?? null;

const outDir = resolve('renders', `film-${filmId}`, 'audio');
mkdirSync(outDir, { recursive: true });

const key = process.env.ELEVENLABS_API_KEY;
// Precedence: --voice > the film manifest's voice > VOICE_ID in .env > Adam.
const voice = opt('voice', film.voice || process.env.VOICE_ID || 'pNInz6obpgDQGcFmaJgB');
const MODEL = 'eleven_multilingual_v2';
// 0.92 — slightly quicker than the shorts default (0.9). Long form has room to
// breathe structurally (act gaps, held shots), so the LINE itself can move at
// closer to natural pace without feeling rushed.
const speed = Math.max(0.7, Math.min(1.2, Number(opt('speed', '0.92'))));

// Pause normalization (default ON). ElevenLabs renders em/en-dashes and
// ellipses as long FIXED pauses that `speed` cannot compress, so a dash-heavy
// script drags no matter the setting and the speed knob goes nearly inert.
// Only spaced —/– and ellipses are touched; the U+002D in "single-cylinder"
// never matches.
const keepDashes = args.includes('--keep-dashes');
const normalizePauses = (t) =>
  keepDashes
    ? t
    : t
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/\s*(?:…|\.\.\.)\s*/g, ', ')
        .replace(/,\s*,/g, ',')
        .replace(/\s{2,}/g, ' ')
        .trim();

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

async function elevenlabsTake(text, settings) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: settings }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const a = json.alignment ?? json.normalized_alignment;
  if (!a?.character_start_times_seconds?.length) throw new Error('no alignment in response');
  return {
    audio: Buffer.from(json.audio_base64, 'base64'),
    chars: a.characters ?? Array.from(text),
    starts: a.character_start_times_seconds,
    ends: a.character_end_times_seconds,
  };
}

if (!key) {
  console.error('ELEVENLABS_API_KEY not set in .env — long-form narration needs it.');
  console.error('(Edge TTS has no word alignment, so the caption rail and audio-master pacing');
  console.error(' would both be unavailable. Fix the key rather than shipping a film without them.)');
  process.exit(1);
}

let totalChars = 0;
let totalSeconds = 0;

for (const [ai, act] of acts.entries()) {
  if (actFilter && !actFilter.includes(ai)) continue;
  const n = String(ai).padStart(2, '0');

  // Which shots in THIS act carry narration, in act-local index order — the
  // renderer keys timings by shot-in-act, so a silent shot must not shift them.
  const narrated = (act.shots ?? [])
    .map((s, i) => ({ i, text: normalizePauses((s.narration ?? '').trim()) }))
    .filter((s) => s.text);

  if (!narrated.length) {
    console.log(`act ${ai + 1} "${act.title ?? ''}" — no narration, skipped`);
    continue;
  }

  // clear stale output so an aborted run cannot leave a half-updated act
  for (const f of [`act-${n}.mp3`, `act-${n}-timings.json`, `act-${n}-words.json`]) {
    rmSync(join(outDir, f), { force: true });
  }

  // one continuous script for the act; track each line's inclusive char span
  const SEP = ' ';
  let full = '';
  const spans = [];
  narrated.forEach(({ i, text }, k) => {
    const startChar = full.length;
    full += text;
    spans.push({ i, startChar, endChar: full.length - 1 });
    if (k < narrated.length - 1) full += SEP;
  });

  // Per-act voice direction — the film's dynamic range. Defaults are the
  // steady "explanation" setting; an act marked tense should override.
  const settings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true,
    speed,
    ...(act.voiceSettings ?? {}),
  };

  console.log(`act ${ai + 1} "${act.title ?? ''}" — ${full.length} chars, ${narrated.length} lines, stability ${settings.stability}, style ${settings.style}`);
  const { audio, chars, starts, ends } = await elevenlabsTake(full, settings);

  const clamp = (arr, idx) => arr[Math.max(0, Math.min(arr.length - 1, idx))];
  const timings = {};
  for (const { i, startChar, endChar } of spans) {
    timings[i] = {
      start: Number(clamp(starts, startChar).toFixed(3)),
      end: Number(clamp(ends, endChar).toFixed(3)),
    };
  }
  const words = wordsFromAlignment(chars, starts, ends);
  writeFileSync(join(outDir, `act-${n}.mp3`), audio);
  writeFileSync(join(outDir, `act-${n}-timings.json`), JSON.stringify(timings, null, 2));
  writeFileSync(join(outDir, `act-${n}-words.json`), JSON.stringify(words));

  const dur = Math.max(...Object.values(timings).map((t) => t.end));
  totalChars += full.length;
  totalSeconds += dur;
  console.log(`  -> act-${n}.mp3 (${dur.toFixed(1)}s) + timings (${spans.length}) + words (${words.length})`);
}

console.log(`\n${totalChars} chars synthesized, ~${(totalSeconds / 60).toFixed(1)} min of narration -> ${outDir}`);
console.log('note: render-film.mjs adds ~1.6s between acts and a ~4.5s tail, so the film runs longer than this.');
