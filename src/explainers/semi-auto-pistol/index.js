import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildPistol } from './model.js';

// One lap of `cyc` (0-100) is one complete shot: trigger pull, ignition,
// bullet down the bore, recoil cycle, reload. Every step loops the whole
// mechanism — the camera provides the focus.
function shotLoop(duration = 3200) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        handles.setCycle(s.t * 100);
        // Clear the speed-lane tokens/labels every frame on non-race steps.
        // onEnter can't be relied on for step 0 (the player early-returns when
        // re-activating the already-active hero step), so the race — whose
        // labels sit far off to the side and project off-frame — is pinned off
        // here instead. The speed step uses raceLoop, which drives setRace.
        handles.setRace(0);
      },
    });
  };
}

// The speed-comparison step: one shot cycle AND one lane race on the same
// local clock, so the gun keeps firing while six reference speeds race down
// the parallel track for an identical slice of time.
function raceLoop(duration = 3600) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        handles.setCycle(s.t * 100);
        handles.setRace(s.t);
      },
    });
  };
}

// Pin the full layer/label state on entering a step, so scrolling either way
// lands on a consistent scene. reveal 0 = solid finished pistol, 1 = x-ray.
const view = (reveal, labels, psi = false) => ({ handles }) => {
  handles.setReveal(reveal);
  handles.setLabels(labels);
  handles.setRace(0); // clear race tokens+labels off EVERY non-speed step (the
  // speed step drives its own setRace; without this the race labels leak onto
  // the reveal=1 steps and project off-frame)
  handles.showPsi(psi); // live chamber-PSI readout only on the firing steps
};

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildPistol({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'The pistol',
      body: 'This is a modern semi-automatic pistol as you would actually hold it: a steel slide riding on a polymer frame, a grip that houses the magazine, a trigger, and sights. Nothing here looks like it is about to do very much — yet one squeeze sets off a chain of ten mechanical events that finishes before you can blink. Let us open it up.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [2.5, 1.85, 3.0], target: [0.35, 0.68, 0] },
      dofAperture: 0.00003, // wide hero — keep it near-sharp
      onEnter: view(0, 'exterior'),
      timeline: shotLoop(6400),
    },
    {
      id: 'inside',
      heading: 'Inside the pistol',
      body: 'Now the shell turns to glass. Behind the breech sits a spring-loaded striker; ahead of it, the barrel and its chamber holding a single cartridge. A recoil spring runs under the barrel, a trigger bar links the trigger to the striker, and the grip is a stack of cartridges pushed up by a spring. Two machines share this frame: an ignition system, and a self-reloading action.',
      hint: 'Drag to orbit · scroll for the mechanism.',
      camera: { position: [2.2, 1.9, 2.7], target: [0.32, 0.9, 0] },
      dofAperture: 0.00003, // whole-mechanism overview — keep it legibly sharp
      // (mild bokeh here turns the bright chrome springs into clipping discs)
      onEnter: view(1, 'internal'),
      timeline: shotLoop(6400),
    },
    {
      id: 'trigger',
      heading: '1 · Pulling the trigger',
      body: "Squeezing the trigger doesn't fire the gun directly — it drives a trigger bar that first draws the spring-loaded striker back those last couple of millimetres, then tips a small sear out of its notch. The instant the sear lets go, the trigger's job is finished. Everything from here happens on its own.",
      camera: { position: [-0.7, 0.92, 1.15], target: [-0.05, 0.66, 0] },
      dofAperture: 0.00016, // macro on the trigger — filmic fall-off
      onEnter: view(1, false),
      timeline: shotLoop(3600),
    },
    {
      id: 'ignition',
      heading: '2 · Primer to powder',
      body: "Freed from the sear, the striker snaps forward under its own spring and drives its firing pin into the primer — a dab of shock-sensitive compound in the base of the case. The primer flashes through a tiny hole and ignites the powder charge behind the bullet. It isn't so much an explosion as an extremely fast, contained fire: pressure inside the sealed case spikes to roughly 35,000 psi (240 MPa) in a couple of milliseconds.",
      camera: { position: [0.42, 1.22, 0.65], target: [0.24, 0.94, 0] },
      dofAperture: 0.00016, // macro on the chamber ignition
      onEnter: view(1, false, true),
      timeline: shotLoop(3200),
    },
    {
      id: 'barrel',
      heading: '3 · Down the barrel',
      body: 'That pressure has one way out: forward, against the base of the bullet. Rifling grooves cut into the bore bite into its jacket and force it to spin as it accelerates. About a millisecond and 4 inches later, it leaves the muzzle already spinning at somewhere around 1,500 turns a second — several times faster than a Formula 1 engine screaming at redline. That spin is a gyroscope: it is what keeps the bullet flying straight, nose-first, for the rest of its flight.',
      camera: { position: [0.62, 0.5, 1.0], target: [0.6, 1.0, 0.02] },
      dofAperture: 0.0001,
      onEnter: view(1, false),
      timeline: shotLoop(2800),
    },
    {
      id: 'cycling',
      heading: '4 · Cycling the action',
      body: "The same gas pressure that launches the bullet also shoves the slide and barrel backward together. After a few millimetres the barrel tips down and stops, unlocking from the slide; the slide keeps travelling alone, its extractor dragging the spent case out of the chamber until a fixed ejector post flips it clear through the ejection port. A recoil spring then snaps the slide forward again, stripping a fresh cartridge off the magazine on the way through — the pistol reloads itself in well under a tenth of a second.",
      camera: { position: [0.3, 1.42, 0.95], target: [0.12, 0.98, 0.1] },
      dofAperture: 0.0001,
      onEnter: view(1, false),
      timeline: shotLoop(3400),
    },
    {
      id: 'flight',
      heading: '5 · Bullet in flight',
      body: 'Once it clears the muzzle, the bullet is on its own: no more propellant gas, just momentum, gravity, and air drag fighting it every metre of the way. Because it left the barrel faster than sound, it drags its own miniature sonic boom behind it — a sharp crack that outruns the gun\'s bang and reaches a listener downrange first. Drag bleeds off its speed continuously, and gravity pulls it into a curving arc it can never climb back out of.',
      camera: { position: [3.0, 1.95, 2.9], target: [2.4, 0.72, 0] },
      dofAperture: 0.00003, // wide downrange — sharp
      onEnter: view(1, false),
      timeline: shotLoop(3400),
    },
    {
      id: 'speed',
      heading: '6 · How fast is that, really?',
      body: "“Faster than sound” is abstract until you race it. Here are six things moving at their real speeds, for the same slice of time: a sprinting cheetah at 29 m/s, a Formula 1 car at 97 m/s, a cruising airliner at 260 m/s. Sound itself covers 343 m/s — and this pistol's bullet is already ahead of it at about 375 m/s. Hand the same powder charge a slimmer, faster rifle cartridge and it can more than double that again.",
      hint: 'Every lane covers the real distance for the real speed — no artistic license.',
      camera: { position: [9.8, 2.4, 3.6], target: [4.8, 0.3, 1.55] },
      dofAperture: 0.00001, // deep race track — keep every lane sharp
      onEnter: ({ handles }) => {
        handles.setReveal(1);
        handles.setLabels(false);
      },
      timeline: raceLoop(3600),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Shell closed, the finished pistol again: trigger, sear, striker, primer, powder, rifling, recoil, extraction, ejection, reload — ten mechanical events, chained together, finished before the sound of the shot reaches your ear. All of it off a single squeeze of the finger, once per pull, every time.',
      hint: 'Drag to orbit.',
      camera: { position: [2.5, 1.85, 3.1], target: [0.35, 0.7, 0] },
      dofAperture: 0.00003, // wide finale — sharp
      freeOrbit: true,
      onEnter: view(0, false),
      timeline: shotLoop(2600),
    },
  ],
});
