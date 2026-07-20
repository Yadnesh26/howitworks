// FIREARM. Educational mechanism only (how the action cycles).
// The user explicitly opted IN to a short-form cut (2026-07-17) despite the
// age-restriction / demonetization risk on short platforms, and will handle
// platform specifics on their end. Both formats exported.
//
// Written as ONE flowing voiceover per format (single-take TTS + audio-master
// pacing). Captions are OFF by default now — the `hook`/`caption` fields stay
// for an optional `--captions` cut but don't burn into the default deliverable.
//
// steps: 0 the pistol · 1 inside · 2 trigger · 3 primer→powder · 4 down the
//        barrel · 5 cycling the action · 6 bullet in flight · 7 speed race · 8 run
export default {
  hook: 'Pull the trigger once —\nit fires AND reloads itself.',

  // 9:16 — ~70s. The speed-race (step 7) is the isolated mind-blowing beat.
  short: {
    shots: [
      {
        // 1. pattern interrupt
        step: 0,
        dolly: 2.0,
        caption: 'One pull. It reloads itself.',
        narration:
          'Pull this trigger just once, and the gun fires — and then reloads itself, before you could even blink.',
      },
      {
        // 2. curiosity hook + 3. question
        step: 0,
        dolly: 2.0,
        caption: 'Ten events in a few milliseconds',
        narration:
          'That single squeeze sets off ten separate mechanical events, and the whole chain finishes in a few thousandths of a second. So how?',
      },
      {
        // 4. reveal
        step: 1,
        dolly: 1.9,
        caption: 'Turn the steel to glass',
        narration:
          'Turn the steel to glass. Inside there’s a spring-loaded striker, a barrel with one cartridge waiting, and a stack more down in the grip.',
      },
      {
        // 5. step-by-step (fire)
        step: 3,
        dolly: 1.55,
        caption: 'Striker → primer → powder',
        narration:
          'The trigger frees the striker, it slams into the primer, and that spark lights the powder — a contained fire that spikes to thirty-five thousand PSI in about a millisecond.',
      },
      {
        // 5b. the clever self-reload
        step: 5,
        dolly: 1.7,
        caption: 'The same blast reloads it',
        narration:
          'And that same blast does double duty: it drives the bullet out the front, and kicks the slide back to eject the empty, re-cock the striker, and load a fresh round — in under a tenth of a second.',
      },
      {
        // 6. mind-blowing moment — isolated speed race
        step: 7,
        dolly: 1.5,
        caption: 'Faster than sound itself',
        narration:
          'And the bullet? It leaves faster than sound itself. Watch it race a cheetah, a Formula One car, and a jet airliner — and outrun every one of them, and the sound in the air too.',
      },
      {
        // 7. real-world connection + 8. callback ending
        step: 8,
        dolly: 2.0,
        caption: 'Over before you hear it',
        narration:
          'That sharp crack you hear is the bullet’s own sonic boom, arriving before the bang. Ten events, one squeeze — over before the sound even reaches your ear.',
      },
    ],
  },

  // 16:9 — ~2.5min (complex module, ten events). One flowing take.
  long: {
    shots: [
      {
        // 1 + 2 pattern interrupt + curiosity hook
        step: 0,
        narration:
          'This is a semi-automatic pistol, and that word hides something remarkable: pull the trigger once, it fires a single round — then uses that shot’s own energy to reload itself for the next.',
      },
      {
        // 3 question + into the reveal
        step: 1,
        narration:
          'One squeeze sets off ten mechanical events, finished before you can blink. So turn the steel to glass. Behind the breech, a spring-loaded striker; ahead of it, a barrel holding one cartridge; and in the grip, a stack more waiting.',
      },
      {
        // 4 reveal → step: trigger
        step: 2,
        narration:
          'It starts with the trigger — though pulling it doesn’t fire the gun directly. A thin bar draws the striker back, then tips a tiny sear out of its notch. The instant it lets go, the trigger’s job is done.',
      },
      {
        // 5 step: ignition
        step: 3,
        narration:
          'The freed striker snaps forward and drives its pin into the primer, a shock-sensitive cap in the base of the case. It flashes through a tiny hole and lights the powder — a contained fire that spikes to thirty-five thousand PSI in milliseconds.',
      },
      {
        // 5b step: down the barrel + spin
        step: 4,
        narration:
          'That pressure has one way out: forward, against the bullet. Grooves cut in the barrel force it to spin, and it leaves the muzzle turning fifteen hundred times a second — faster than an F1 engine at redline. That spin is what keeps it flying straight.',
      },
      {
        // 5c step: self-reloading action
        step: 5,
        narration:
          'But the same gas also shoves the slide backward. The barrel unlocks and drops, the slide drags the spent case out and flips it clear, then a recoil spring snaps everything forward, stripping a fresh round from the magazine. Reloaded in under a tenth of a second.',
      },
      {
        // 7 real-world: flight + sonic boom
        step: 6,
        narration:
          'Now the bullet is on its own — momentum, gravity, and air. And because it left faster than sound, it drags a miniature sonic boom behind it: a crack that outruns the gun’s own bang.',
      },
      {
        // 6 mind-blowing moment — the speed race
        step: 7,
        narration:
          'Faster than sound is hard to picture, so watch it race. A cheetah, a Formula One car, an airliner — and sound itself. The bullet is already ahead of all of them, at about three hundred seventy-five metres per second.',
      },
      {
        // 8 callback ending
        step: 8,
        narration:
          'Trigger, striker, primer, powder, rifling, recoil, ejection, reload — ten events chained together, over before the sound reaches your ear. All off a single squeeze, once per pull, every time.',
      },
    ],
  },
};
