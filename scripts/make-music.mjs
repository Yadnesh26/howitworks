// Generate a music bed with the ElevenLabs music API.
//
//   node scripts/make-music.mjs <film-id>                  # from film.musicPrompt
//   node scripts/make-music.mjs --name grid-bed --prompt "..." [--seconds 120]
//   node scripts/make-music.mjs <film-id> --force          # regenerate
//
// The bed is not decoration. render-film.mjs leaves 1.6s between acts and 4.5s
// at the tail; without music those are dead silence and read as a mistake
// rather than a beat. The mixer loops whatever length you generate and
// sidechains it under the voice, so a 2-minute pad covers a 9-minute film
// without obvious repetition — as long as it is a PAD and not a song.
//
// Output: assets/music/<name>.mp3 — referenced by `music:` in the manifest.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));

const args = process.argv.slice(2);
const filmId = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const force = args.includes('--force');

let name = opt('name', null);
let prompt = opt('prompt', null);
let seconds = Number(opt('seconds', '120'));

if (filmId && !prompt) {
  const filmPath = resolve(`films/${filmId}/film.js`);
  if (!existsSync(filmPath)) {
    console.error(`${filmPath} not found`);
    process.exit(1);
  }
  const film = (await import(pathToFileURL(filmPath))).default;
  name = name ?? film.music;
  prompt = film.musicPrompt;
  seconds = Number(opt('seconds', String(film.musicSeconds ?? 120)));
  if (!name) {
    console.error(`films/${filmId}/film.js has no \`music\` key — nothing to name the bed`);
    process.exit(1);
  }
  if (!prompt) {
    console.error(`films/${filmId}/film.js has no \`musicPrompt\` — add one, or pass --prompt`);
    process.exit(1);
  }
}
if (!name || !prompt) {
  console.error('usage: node scripts/make-music.mjs <film-id> | --name <n> --prompt "<desc>" [--seconds 120]');
  process.exit(1);
}

const outDir = resolve('assets/music');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${name}.mp3`);
if (existsSync(out) && !force) {
  console.log(`${out} exists — pass --force to regenerate`);
  process.exit(0);
}

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('ELEVENLABS_API_KEY not set in .env');
  process.exit(1);
}

// WRITING THE PROMPT. You want a BED, not a track. Every one of these words is
// load-bearing: "no drums" (a beat fights the narration's rhythm), "no melody"
// (a tune competes for the listener's attention with the voice), "sustained"
// and "unresolved" (a pad that never lands is one you can loop and talk over).
// A prompt that reads like a song description will return a song, and a song
// under a documentary voiceover sounds like a stock-footage advert.
console.log(`music: "${name}" — ${(seconds / 60).toFixed(1)} min`);
console.log(`  prompt: ${prompt}`);
const res = await fetch('https://api.elevenlabs.io/v1/music', {
  method: 'POST',
  headers: { 'xi-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({
    prompt,
    music_length_ms: Math.max(10000, Math.min(300000, Math.round(seconds * 1000))),
  }),
});
if (!res.ok) {
  console.error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync(out, buf);
console.log(`-> ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
console.log('listen before rendering: if you can hum it, it will fight the narration.');
