// Editorial layer for video export (scripts/export-video.mjs).
// This file is where views are won: hooks and captions matter more than the
// render. Rules of thumb — hook states the counterintuitive fact in <12 words;
// captions are one line, mobile-readable, no jargon; narration is spoken
// prose (contractions, short sentences), NOT the step body copy.
//
// steps: 0 face · 1 inside the case · 2 mainspring · 3 gear train
//        4 escapement · 5 balance wheel · 6 back to the hands · 7 whole watch
export default {
  // hook is shot 1's spoken line verbatim — the verbatim caption rail IS the
  // on-screen hook now, there's no separate title card for it (see
  // video-scripting/export-content skills). \n only for the legacy no-words.json
  // fallback path's card line breaks.
  hook: 'There’s no battery in this watch.\nNo electricity, anywhere inside it.',

  // override — export-video.mjs's hardcoded default ('Share it. whatDstuff')
  // is corrupted placeholder text; see the flag raised alongside this export.
  endCard: 'Share it.\nFollow for more.',

  // 9:16, narrated + verbatim caption rail (--captions burns title/end card too).
  // No per-shot `caption` fields — the rail is generated from the actual
  // narration via ElevenLabs word timing, not hand-written summaries.
  short: {
    shots: [
      {
        // hook (0-3s)
        step: 0,
        seconds: 4,
        narration: 'There’s no battery in this watch. No electricity, anywhere inside it.',
      },
      {
        // straight to the question — no extra restating, one beat
        step: 0,
        seconds: 3,
        narration: 'So what’s actually keeping it ticking?',
      },
      {
        // reveal — the "130 parts, one spring" fact lands HERE, while we're
        // actually looking at the machine, instead of stalling on the closed
        // face first
        step: 1,
        seconds: 6,
        narration: 'Lift the dial off, and here’s the machine — a hundred and thirty parts, all powered by one coiled spring.',
      },
      {
        // mechanism beat 1: mainspring
        step: 2,
        seconds: 6,
        labels: ['Mainspring barrel'],
        narration:
          'Wind the crown, and you’re coiling a ribbon of spring steel tight inside this barrel — that’s the whole fuel tank, good for two days.',
      },
      {
        // mechanism beat 2: escapement (BUT)
        step: 4,
        seconds: 6,
        labels: ['Escape wheel', 'Pallet fork'],
        narration: 'But left alone, that spring would unwind in seconds. Two ruby jewels lock the escape wheel, releasing just one tooth at a time.',
      },
      {
        // mechanism beat 3: balance (THEREFORE) — reveals the heartbeat
        step: 5,
        seconds: 6,
        labels: ['Balance wheel'],
        narration:
          'Therefore every tick is one tooth escaping — governed by a wheel that swings eight times a second, like a pendulum immune to gravity.',
      },
      {
        // the stat, isolated on its own beat
        step: 5,
        seconds: 4,
        narration: 'That’s four hundred thousand beats, every single day.',
      },
      {
        // so-what
        step: 7,
        seconds: 5,
        narration: 'So wind it once, and that conversation between spring and wheel just keeps going.',
      },
      {
        // button — closes the hook's own loop (no battery / no electricity)
        step: 7,
        seconds: 4,
        narration: 'No battery. No electricity. Just a steel heartbeat.',
      },
    ],
  },

  // 16:9, full story, narrated
  long: {
    shots: [
      {
        step: 0,
        seconds: 9,
        narration:
          'This is one of the smallest machines you will ever own. Three hands, twelve marks, one knob — and no battery anywhere. Watch the seconds hand. It doesn’t jump like a quartz watch. It sweeps. That sweep is a mechanical heartbeat, and we’re about to find it.',
      },
      {
        step: 1,
        seconds: 10,
        narration:
          'Lift off the dial, and here’s the machine. It’s a chain: a wound spring pushes a train of gears, the last gear is held back by a tiny fork, and the fork answers to that swinging wheel. Power at one end, timekeeping at the other.',
      },
      {
        step: 2,
        seconds: 9,
        narration:
          'The fuel tank. Winding the crown coils a flat ribbon of spring steel tighter and tighter inside this barrel. A few turns store enough energy to run the watch for two days.',
      },
      {
        step: 3,
        seconds: 8,
        narration:
          'The gear train trades force for speed. Each wheel spins the next one faster, until the fourth wheel turns exactly once per minute. That’s why the seconds hand rides on it.',
      },
      {
        step: 4,
        seconds: 10,
        narration:
          'Now the clever part. Left alone, the spring would unwind in seconds. This fork’s two ruby jewels lock the escape wheel completely — and release exactly one tooth per beat. Tick. That sound a watch makes? It’s this.',
      },
      {
        step: 5,
        seconds: 10,
        narration:
          'And this is the heartbeat itself. The balance wheel swings on a hair-thin spiral spring, eight beats every second — a pendulum that works in any position. It decides the speed. Everything else in the watch just obeys.',
      },
      {
        step: 6,
        seconds: 9,
        narration:
          'Put the dial back, and the whole chain hides behind three pointers. A small side train slows the same rotation down sixty times for the minute hand, and seven hundred twenty times for the hour hand.',
      },
      {
        step: 7,
        seconds: 9,
        narration:
          'Spring, barrel, train, fork, balance — a conversation between a spring and a swinging wheel, repeated half a million times a day, on a machine small enough to forget you’re wearing it.',
      },
    ],
  },
};
