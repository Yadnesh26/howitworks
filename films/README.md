# Films — long-form documentaries

A **film** is an 6–12 minute narrated documentary that spans *several*
explainers. It is a different product from the per-explainer video that
`export-video.mjs` renders, and it has its own manifest, renderer and skills.

| | per-explainer video (`video.js`) | film (`film.js`) |
| --- | --- | --- |
| length | ~70s short / ~2min long | 6–12 min |
| scope | one explainer | any number |
| structure | shots ≈ steps | acts → shots, shots ≠ steps |
| camera | one pose per shot | pose + move (push / orbit / rise) |
| audio | one take | one take per act + sfx + ducked music |
| renderer | `scripts/export-video.mjs` | `scripts/render-film.mjs` |

Use a film when the story is a **journey** that no single explainer contains.
If one explainer covers it, `export-content` is the cheaper, better tool.

## Layout

```
films/<film-id>/film.js       the manifest (the only required file)
assets/sfx/<name>.mp3         generated cues, shared with the shorts pipeline
assets/music/<name>.mp3       music beds (you supply these)
renders/film-<film-id>/       output
```

## Commands

```bash
node scripts/make-sfx.mjs <film-id>                  # generate declared cues
node scripts/make-music.mjs <film-id>                # generate the bed
node scripts/make-film-narration.mjs <film-id>       # one take per act
node scripts/render-film.mjs <film-id> --fps 24      # render + mix
```

Iterate with `--acts 0,1 --fps 8` — a full film at 24 fps is ~13,000 frames and
you do not want that turnaround on a script change.

## Manifest shape

```js
export default {
  id: 'electricity-to-your-home',
  title: 'THE 0.02 SECONDS',              // opening title card
  subtitle: 'How electricity reaches your home',
  endCard: 'line one\nline two',          // closing card
  voice: '<elevenlabs voice id>',         // optional; else VOICE_ID from .env
  music: 'grid-bed',                      // assets/music/grid-bed.mp3
  musicGain: 0.16,                        // pre-duck level
  musicSeconds: 120,                      // generated length; the mixer loops it
  musicPrompt: 'slow ambient pad, no drums, no melody, unresolved',
  callouts: false,                        // in-scene part labels, film default

  sfxLibrary: {
    'relay-clunk': { prompt: '...', seconds: 2, influence: 0.6 },
  },

  acts: [
    {
      id: 'the-switch',
      title: 'The Switch',                // burned as an act card
      voiceSettings: { stability: 0.38, style: 0.25 },  // per-act direction
      shots: [
        {
          explainer: 'power-transmission', // folder name under src/explainers/
          step: 5,                         // 0-indexed
          seconds: 11,                     // FLOOR only — narration sets the real length
          dolly: 0.95,                     // static distance multiplier
          push: 0.9,                       // distance reached by end of shot
          orbit: 14,                       // degrees of azimuth over the shot
          rise: 0,                         // vertical drift, world units
          callouts: true,                  // overrides the film default
          sfx: [{ file: 'relay-clunk', at: 0.8 }],
          narration: 'Spoken prose, not step body copy.',
        },
      ],
    },
  ],
};
```

### Camera ranges — narrow on purpose

The step's own camera pose was already framed by whoever built the explainer.
A move is seasoning on top of it, **not a re-frame**.

| field | safe range | notes |
| --- | --- | --- |
| `dolly` | 0.9 – 1.2 | clamped to 0.8–1.35 |
| `push` | 0.88 – 1.15 | clamped to 0.85–1.22 |
| `orbit` | ±10 – ±22 | clamped to ±25; beyond it reads as a spin |

`dolly` and `push` **compound** — end distance is `dolly × push`. The renderer
warns when that product leaves 0.78–1.4. Measured on this film's first cut:
`push: 0.72` ended with the subject half out of frame, and `dolly: 1.15` with
`push: 1.35` shrank the model to an island in an empty frame. A move the viewer
consciously *notices* is already too big.

### Callouts

The in-scene CSS2D part labels are scene content, not chrome. On a **wide**
establishing shot they annotate the journey and are worth keeping. On a **tight**
shot they crop against the frame edge and read as leftover app UI. Default them
off at film level and switch them on per wide shot.

## How the timeline is built

Narration is the clock wherever it exists. Each act is one continuous
ElevenLabs take, so intonation carries across lines that belong together, and
the act boundary is where the performance is *supposed* to reset.

```
LEAD_IN 1.2s │ act 1 shots… │ ACT_GAP 1.6s │ act 2 shots… │ … │ TAIL_PAD 4.5s
                                  ↑ act card                        ↑ end card
```

Consecutive shots on the same explainer share one page load (a "reel") — the
renderer only reloads when the explainer changes, so the mechanism's loop is
not restarted from cold on every cut.

## Gotchas

- **`seconds` is a floor, not a duration.** Once narration exists, the audio
  drives pacing. Write the script; do not tune seconds.
- **Narration must be spoken prose.** Never paste an explainer's step body copy
  — it is written for reading, not listening.
- **Step indices are 0-based** and shift if someone edits the explainer. The
  renderer fails loudly on an out-of-range step; it cannot detect a step that
  merely *moved*. Re-check a film after touching an explainer it uses.
- **Music is not optional-but-nice.** Without a bed the act gaps are dead
  silence, which reads as a mistake. Supply `assets/music/<name>.mp3` or drop
  the `music` key and accept the silence deliberately.
