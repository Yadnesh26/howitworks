---
name: sound-design
description: Design and generate the audio layer for a howitworks film or video — ElevenLabs sound-effect cues, the music bed, ducking, and the mix. Use when adding sfx to a film or short, when an export sounds thin/flat/amateur, when writing an sfxLibrary, or when asked to make a video sound more produced. Covers scripts/make-sfx.mjs and the mix chain in render-film.mjs.
---

# Sound design

Sound is the cheapest fidelity in this whole pipeline. A transformer hum under
the transmission act costs one API call and does more for perceived production
value than an hour of shader work. It is also the thing most likely to make an
otherwise good film feel amateur if skipped.

## The three layers

| layer | source | role |
| --- | --- | --- |
| **voice** | ElevenLabs TTS, one take per act | carries the content |
| **sfx** | ElevenLabs sound-generation, `assets/sfx/` | sells the physicality |
| **music** | you supply, `assets/music/` | carries the emotion and covers the gaps |

`render-film.mjs` mixes all three, sidechains the music under the voice, and
normalizes the result to −14 LUFS. Nothing here needs an audio editor.

## SFX

Declare cues once in the film manifest's `sfxLibrary`, reference them by name
from shots. A cue used in four shots is generated once.

```js
sfxLibrary: {
  'breaker-slam': { prompt: 'a huge high voltage circuit breaker slamming closed, single heavy metallic clunk, dry', seconds: 2, influence: 0.75 },
}
```

```bash
node scripts/make-sfx.mjs <film-id>            # generate what is missing
node scripts/make-sfx.mjs <film-id> --list     # preview what would generate
node scripts/make-sfx.mjs <film-id> --force    # regenerate everything
node scripts/make-sfx.mjs --name click --prompt "a light switch clicking, dry"
```

### Writing prompts that work

- **Be concrete and mechanical.** "a single relay contact closing" beats
  "electrical sound".
- **Always say "dry, no reverb"** for point cues. Reverb baked into a cue
  cannot be removed, and a wet cue fights the narration for space.
- **Say "no music"** on ambiences — the model will otherwise drift into a bed
  and fight your actual bed.
- **`influence`** is how literally the model follows the text. Use **0.6–0.75**
  for a specific mechanical sound, **0.35–0.5** for an ambience where variety
  is good.
- **`seconds`**: point cues 1.5–2s, ambiences 8–12s. Max 22.

### Placement

```js
sfx: [{ file: 'breaker-slam', at: 0.9 }]   // 0.9s after the shot's first word
```

`at` is relative to the shot's `contentStart` (when the narration line begins),
not the shot's first frame — so a cue stays aligned to the *words* even if the
camera move retimes.

Rules that matter:
- **Cue the moment, not the shot.** Land the clunk on the word that names it.
- **Do not cue every shot.** Three or four well-placed cues per act. Constant
  sfx becomes texture and stops registering.
- **One sub-bass hit per act, maximum.** They are punctuation. Overused, they
  read as a cheap trailer.
- **Ambiences are long and quiet**; point cues are short and present.

## Music

Generate the bed with the ElevenLabs music API, or drop your own at
`assets/music/<name>.mp3`. The renderer loops whatever length it finds, so a
2-minute pad covers a 9-minute film.

```bash
node scripts/make-music.mjs <film-id>           # from film.musicPrompt
node scripts/make-music.mjs <film-id> --force   # regenerate
```

```js
music: 'grid-bed',
musicGain: 0.16,   // pre-duck level; 0.12–0.20 is the useful window
musicSeconds: 120,
musicPrompt: 'slow ambient documentary underscore, sparse sustained synth pads, low pulse, no drums, no melody, neutral and unresolved',
```

### Prompting a bed, not a track

Every word in that prompt is load-bearing:

- **"no drums"** — a beat fights the narration's rhythm and the two never
  agree.
- **"no melody"** — a tune competes with the voice for the same attention.
- **"sustained", "unresolved"** — a pad that never lands is one you can loop
  and talk over. Anything that resolves creates a false ending every 2 minutes.
- **"sparse"** — density is what makes a bed feel like it is in the way.

A prompt that reads like a song description returns a song, and a song under a
documentary voiceover sounds like a stock-footage advert. **If you can hum it,
it will fight the narration.**

**The bed is doing structural work, not decoration.** `render-film.mjs` leaves
1.6s between acts and 4.5s at the tail; without music those are dead silence
and read as a mistake rather than a beat.

### Ducking

The mix sidechains the music to the voice bus
(`sidechaincompress=threshold=0.03:ratio=8:attack=20:release=600`), so the bed
drops under narration and swells back in the gaps. That swell in the act gaps is
most of what makes a long-form mix sound *produced* rather than "a music track
laid under a voice track".

If the bed still feels intrusive, lower `musicGain` before touching the
compressor — the ducking is tuned and the gain is the intended knob.

## The mix chain

```
voice takes ──┬─────────────────────────► amix ──► loudnorm(-14 LUFS) ──► aac
              └─► sidechain key ──┐
music ──► volume(musicGain) ──► sidechaincompress ──► ducked bed ──┘
sfx cues ──────────────────────────────────────────► amix
```

`loudnorm` to −14 LUFS is not optional. An un-normalized export lands well
under platform loudness and sounds thin next to the normalized feed around it,
which reads as amateur before a word is understood.

## Listen before you render

```bash
ffplay assets/sfx/breaker-slam.mp3
```

A wrong-feeling cue is worse than no cue. Generation is cheap — regenerate with
a sharper prompt rather than shipping something approximately right. Budget one
listening pass over every new cue before the first full render; catching it
there is free, catching it in a finished 9-minute export costs the render.

## Checking the finished mix

Extract the audio and listen to at least the act boundaries and the two loudest
moments:

```bash
ffmpeg -i renders/film-<id>/film-final.mp4 -vn -ar 44100 /tmp/check.mp3
```

- Voice always intelligible over the bed — if you strain, `musicGain` is high
- Act gaps have music, not silence
- No sfx cue steps on a word
- The end card's window is not silent
