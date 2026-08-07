// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 hero · 1 horizon · 2 shadow-vs-hole · 3 photon sphere · 4 ISCO
//        5 why it glows · 6 Doppler beaming · 7 time dilation · 8 finale
//
// STORY LENS: not "how black holes work" (saturated beyond saving) but "the
// famous picture is not what you think it is." The dark circle is 2.6x wider
// than the hole, and the ring lying across the top is the disk's FAR side
// bent into view. That is a genuinely counterintuitive claim about an image
// almost everyone has already seen, which is the whole opening.
//
// SCRIPTING: one flowing voiceover per format. make-narration.mjs synthesizes
// each in a single ElevenLabs take and the exporter paces the picture to the
// audio, so each shot's line is only a cut point and hands off into the next.
// Captions are the verbatim voice rail, so the hook has to live in shot 1's
// first spoken sentence, which it does.
//
// The loop: planted in shot 2 ("none of that picture is the hole") and closed
// word-for-word in the button ("You never see the hole. Only what escaped."),
// which also re-arms the hook when the short replays.
//
// No em/en dashes in any narration line — ElevenLabs renders them as dead air
// the speed knob cannot compress. Numbers are spelled the way they should be
// spoken ("two point six", "zero point seven").
//
// DOLLY: this is the widest subject in the library — the disk spans the frame
// even in landscape, and the hero step is deliberately framed CLOSE (4.3 units)
// so it overflows. Portrait crops the sides hard, so every 9:16 shot carries a
// generous pull-back; without it the short would show only the shadow and lose
// the disk entirely.
export default {
  // Legacy-only card (burns only if words.json is missing). In sync with
  // shot 1's opening line.
  hook: 'That black circle\nisn\'t the black hole.',

  // Consumed by scripts/make-postkit.mjs. Authored here with the script rather
  // than improvised at posting time, so the packaging promise and the hook say
  // the same thing — the video is judged against whatever the title set up.
  platforms: {
    youtube: {
      title: 'The Dark Circle Is Not the Black Hole',
      description: [
        'Everyone has seen the picture. Almost nobody has been told what it actually shows.',
        '',
        'The dark circle is not the event horizon. It is 2.6 times wider, because rays that would have missed the hole still get bent hard enough to fall in, so a whole region of sky behind it goes dark. The ring lying across the top is the disk\'s far side, lensed up and over.',
        '',
        'Everything in this video is computed rather than animated: each pixel traces a light ray backwards through curved spacetime, so the shadow, the photon ring, the lensed arcs and the Doppler asymmetry all fall out of the same equation.',
        '',
        'Chapters:',
        '0:00 None of that picture is the hole',
        '0:15 The event horizon is a distance, not a surface',
        '0:30 Why the darkness is 2.6x too big',
        '0:45 Where light can go into orbit',
        '1:05 The last stable orbit, at half light speed',
        '1:25 Why the gas glows (it is not burning)',
        '1:45 One side is brighter, and it is not hotter',
        '2:05 Falling in takes forever to watch',
      ].join('\n'),
      tags: [
        'black hole',
        'event horizon',
        'accretion disk',
        'gravitational lensing',
        'photon sphere',
        'general relativity',
        'astrophysics',
        'space',
        'physics explained',
        'interstellar gargantua',
      ],
    },
    shorts: {
      title: "That black circle isn't the black hole",
      hashtags: ['#blackhole', '#space', '#physics', '#astronomy', '#science'],
    },
  },

  // 9:16 — ~86s at ~2.3 words/sec (197 words), matching the shipped length of
  // the induction-cooktop short. Spine: hook -> stakes+loop -> question ->
  // BUT/THEREFORE mechanism -> re-hook -> isolated stat -> so-what -> button.
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true sentence, word one, over the hero
        step: 0,
        dolly: 2.0,
        labels: [],
        narration:
          "That black circle isn't the black hole. The hole is less than half that wide.",
      },
      {
        // Zone 2+3 — stakes, the planted loop, then the spoken question
        step: 0,
        dolly: 2.0,
        labels: [],
        narration:
          "A black hole gives off nothing, so none of that picture is the hole. Every bit of it is light that couldn't travel straight. What are you actually looking at?",
      },
      {
        // Zone 4a — the mechanism, stated as curvature rather than as a pull
        step: 3,
        dolly: 1.8,
        labels: ['Photon sphere · 1.5 Rs'],
        narration:
          "Gravity this strong doesn't pull light off course. It bends the course itself. Aim a ray to miss, and it still swings around.",
      },
      {
        // Zone 4b — the beat that makes the shadow inevitable
        step: 3,
        dolly: 1.8,
        labels: ['Loops — then escapes'],
        narration:
          'Aim closer and it loops the hole completely, then leaves in a direction it was never pointed.',
      },
      {
        // Zone 4c — THEREFORE: the dark circle, and the number behind it
        step: 2,
        dolly: 1.6,
        labels: ['The hole · 1 Rs', 'What you see · 5.2 Rs'],
        narration:
          'So rays that should have missed fall in instead. A patch of sky behind it goes dark, two point six times wider than the hole.',
      },
      {
        // Zone 4d — BUT connective + re-hook: the glow is not the hole either
        step: 5,
        dolly: 1.4,
        labels: ['Accretion disk'],
        narration:
          "But the glow isn't the hole either. It's gas, torn into a disk, orbiting so fast that friction alone heats it to millions of degrees.",
      },
      {
        // Zone 5 — the stat, isolated on its own beat
        step: 5,
        dolly: 1.4,
        labels: [],
        narration:
          "Here's the number that gets me. Falling in turns up to forty percent of matter straight into light. Fusion, the thing running the Sun, manages zero point seven.",
      },
      {
        // Zone 6 — so-what: the myth everybody actually carries around
        step: 8,
        dolly: 1.1,
        labels: [],
        narration:
          "But it still doesn't suck anything in. Swap the Sun for a black hole of the same mass, and Earth keeps its orbit, on time, in the dark.",
      },
      {
        // Zone 7 — button: 8 words, closes the loop, re-arms the hook on replay
        step: 8,
        dolly: 1.1,
        labels: [],
        narration: 'You never see the hole. Only what escaped.',
      },
    ],
  },

  // 16:9 — ~150s (347 words). Same spine with room to actually develop the
  // horizon, the photon sphere, the last stable orbit and time dilation, all
  // of which the short has to skip or compress to a clause.
  long: {
    shots: [
      {
        // 1 — hook + the premise the whole video rests on
        step: 0,
        narration:
          "You have almost certainly seen a picture like this one. Almost none of it is the black hole. A black hole gives off no light at all, so what you are looking at is light from somewhere else, bent on the way to you.",
      },
      {
        // 2 — the horizon: a distance, not a thing
        step: 1,
        labels: ['Event horizon · 1 Rs', 'Escape speed = c'],
        narration:
          "Start with the hole itself. There's no surface at the event horizon. It's the distance where the escape speed reaches the speed of light, so anything closer is already committed.",
      },
      {
        // 3 — BUT: the darkness is not the horizon
        step: 2,
        labels: ['The hole · 1 Rs', 'What you see · 5.2 Rs'],
        narration:
          "But the dark circle isn't that horizon. It's two point six times wider. Rays that would have missed get bent hard enough to fall in anyway, so a whole region of sky behind it goes dark.",
      },
      {
        // 4 — the photon sphere, and where the bright rim comes from
        step: 3,
        labels: ['Photon sphere · 1.5 Rs', 'Loops — then escapes'],
        narration:
          'There is even a distance where light can orbit. A ray can loop the hole and leave pointing somewhere new. The bright rim around the shadow is made of light that did exactly that.',
      },
      {
        // 5 — the last stable orbit
        step: 4,
        labels: ['Last stable orbit · 3 Rs'],
        narration:
          "Outside that, gas piles into a disk, but it can't circle forever. At three horizon radii you hit the last stable orbit, moving at exactly half the speed of light. Inside that line nothing orbits. It falls.",
      },
      {
        // 6 — why it glows
        step: 5,
        labels: ['Accretion disk', 'Inner gas laps the outer'],
        narration:
          "The glow isn't burning. Gas closer in orbits faster, so neighbouring rings grind past each other, and friction alone drags the inner disk to millions of degrees.",
      },
      {
        // 7 — the stat, isolated
        step: 5,
        labels: [],
        narration:
          "Here's the number that gets me. Falling in turns up to forty percent of matter straight into light. Fusion, the thing running the Sun, manages zero point seven.",
      },
      {
        // 8 — beaming, plus the fact that explains why ours looks unlike the film
        step: 6,
        labels: ['Coming at you', 'Going away'],
        narration:
          "One side of the ring is brighter, and it isn't hotter. That gas is coming at you at a fair fraction of light speed. Interstellar left this out on purpose. The real lopsidedness looked like a mistake.",
      },
      {
        // 9 — time dilation
        step: 7,
        labels: ['Clock running slow', 'Signals stretch and fade'],
        narration:
          'Time bends too. Send a probe down and you never see it arrive. Its signals stretch redder and arrive further apart, until it fades out still hanging above the edge.',
      },
      {
        // 10 — so-what: one number, and the myth
        step: 8,
        narration:
          "All of it comes from one number. Set the mass, and the horizon, the shadow and the last stable orbit all follow. But it doesn't suck anything in. Swap the Sun for a black hole of the same mass, and Earth keeps its orbit, on time, in the dark.",
      },
      {
        // 11 — button: closes the loop
        step: 8,
        narration: 'You never see the hole. Only what escaped.',
      },
    ],
  },
};
