import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildMixer } from './model.js';

// Zoom-in / reveal story: the complete running appliance, then lift the jar to
// show the coupling, ghost the body to expose the universal motor, macro in on
// the commutator, follow the vortex inside the jar, work the speed selector,
// and finish on the whole machine at full song.
//
// Seamless loops: the armature `spin` advances a whole EVEN number of turns per
// lap (the commutator flips every half-turn, so an even count repeats the
// commutation pattern exactly); flow and vortex phases advance whole cycles.

// Pin the full layer state on entering a step so scrolling either way lands on
// a consistent scene.
const view =
  (jar, reveal, labels, { lid = true } = {}) =>
  ({ handles }) => {
    handles.setJar(jar);
    handles.setJarSpin(0);
    handles.setReveal(reveal);
    handles.setLid(lid);
    handles.setLabels(labels);
    handles.setFlow(0, false);
    handles.setVortex(0, false);
  };

// A running loop: armature spins `turns` (even) per lap; optional flow/vortex.
function runLoop({ turns, duration, jarSeated = true, flow = false, vortex = false, vphase = 3 }) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share a tween target across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        handles.setSpin(s.t * turns * Math.PI * 2, jarSeated);
        if (flow) handles.setFlow(s.t * turns, true); // one flow cycle per turn
        if (vortex) handles.setVortex(s.t * vphase, true);
      },
    });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildMixer({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'The kitchen workhorse',
      body: 'Every Indian kitchen has one, and it earns its keep: idli batter, coconut chutney, dry turmeric, wet masala — all pulverised by the same little machine. It is really just three parts stacked in a line: a motor in the body, a jar on top, and a four-point steel blade in the floor of that jar. Watch the blade already blurring behind the glass — the motor underneath is spinning it near twenty thousand times a minute.',
      hint: 'Drag to orbit · scroll to take it apart.',
      camera: { position: [2.5, 2.2, 3.0], target: [0, 1.35, 0] },
      dofAperture: 0.00002, // overview — keep whole machine sharp
      onEnter: view(0, 0, 'exterior'),
      timeline: runLoop({ turns: 12, duration: 4200 }),
    },
    {
      id: 'couple',
      heading: 'How power crosses the gap',
      body: 'Lift the jar off and you find the trick to why nothing leaks and everything still spins: the motor and the blade never touch. A cross-shaped drive coupler on the body top slots into a matching socket under the jar. Seat the jar and the two lock together; the motor turns the coupler, the coupler turns the blade — while a rubber seal keeps your chutney out of the machine.',
      hint: 'The jar just drops on — no wiring, no plumbing.',
      camera: { position: [2.3, 2.1, 2.8], target: [0, 1.75, 0] },
      dofAperture: 0.00008,
      onEnter: view(1, 0, 'couple'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => {
            handles.setJar(1);
            handles.setJarSpin(s.t * Math.PI * 2);
            handles.setSpin(s.t * 2 * Math.PI * 2, false);
          },
        });
      },
    },
    {
      id: 'motor',
      heading: 'A motor that screams',
      body: 'The body turns to glass. Inside is a universal motor — the same breed that howls in a vacuum cleaner or an angle grinder. A spinning armature sits between two field coils, and here is the clever part: those coils are wired in series with the armature, so the very same current flows through both. Reverse it — as household AC does fifty times a second — and both halves reverse together, so the push never flips. That is why it runs happily on AC or DC, and why, with almost no load, it revs to a screaming 20,000 RPM.',
      camera: { position: [1.9, 1.5, 2.3], target: [0, 0.78, 0] },
      dofAperture: 0.00012,
      onEnter: view(0, 1, 'motor'),
      timeline: runLoop({ turns: 6, duration: 3600, flow: true }),
    },
    {
      id: 'commutator',
      heading: 'Flipping the current, 600 times a second',
      body: 'Down at the base of the armature is the commutator: a ring of copper bars split by insulating gaps, with two carbon brushes pressing on opposite sides. As the armature spins, each brush slides from bar to bar, and every half turn the gap sweeps past and the current through that coil reverses. That constant, perfectly-timed flip is what keeps every coil pushing the same way round instead of fighting itself — hundreds of switches a second, done by nothing cleverer than a sliding contact.',
      hint: 'Watch a bar light up as it passes each brush, then flip colour.',
      camera: { position: [0.95, 0.72, 1.45], target: [0, 0.45, 0.08] },
      dofAperture: 0.0002, // macro — strongest DOF
      onEnter: view(0, 1, 'comm'),
      timeline: runLoop({ turns: 2, duration: 4200, flow: true }),
    },
    {
      id: 'vortex',
      heading: 'The blade makes a whirlpool',
      body: 'The four-point blade is not just a set of knives — it is a pump. Two arms tilt up and two tilt down, so as it spins it flings food outward and drives a vortex that drags everything from the top of the jar down into the cutting zone, again and again. Nothing sits still long enough to escape: the swirl keeps feeding the centre until batter is smooth and spice is dust.',
      hint: 'Follow one grain: out, up the wall, and back down the middle.',
      camera: { position: [0.7, 3.0, 1.5], target: [0, 1.95, 0] },
      dofAperture: 0.00015,
      onEnter: view(0, 0, 'vortex', { lid: false }),
      timeline: runLoop({ turns: 10, duration: 4000, vortex: true, vphase: 3 }),
    },
    {
      id: 'speed',
      heading: 'One knob, three speeds',
      body: 'Blend, mix, grind, and a pulse — the knob picks the job. It does not throttle the power like a dimmer; it taps the field coil at different points, switching how many turns of wire the current sees. More turns means a stronger magnetic field, which — counter-intuitively for a series motor — holds the speed down for heavy grinding. Tap off some turns and the field weakens, letting the armature race away for light, fast blending.',
      hint: 'P is the momentary pulse — spring-loaded, for short bursts.',
      camera: { position: [1.4, 1.05, 2.4], target: [0, 0.72, 0.15] },
      dofAperture: 0.00015,
      onEnter: ({ handles }) => {
        handles.setJar(0);
        handles.setJarSpin(0);
        handles.setReveal(1);
        handles.setLid(true);
        handles.setLabels('speed');
        handles.setVortex(0, false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => {
            handles.setSpin(s.t * 8 * Math.PI * 2, false);
            handles.setFlow(s.t * 8, true);
            const phase = (s.t * 3) % 3;
            handles.setSpeed(1 + phase);
          },
        });
      },
    },
    {
      id: 'run',
      heading: 'Grind it',
      body: 'Jar on, lid down, knob to grind: current pours through the field coils and the armature in series, the commutator flips it half-turn by half-turn, the coupler hands the spin to the blade, and the blade whips the whole jar into a vortex. Three simple parts in a line — motor, coupler, blade — turning electricity into a plume of fine powder in seconds.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.7, 2.0, 3.2], target: [0, 1.4, 0] },
      dofAperture: 0.00002, // finale — everything sharp
      freeOrbit: true,
      onEnter: view(0, 0, false),
      timeline: runLoop({ turns: 16, duration: 3600, vortex: true, vphase: 6 }),
    },
  ].map((step) => ({
    ...step,
    onEnter(ctx) {
      step.onEnter?.(ctx);
      if (ctx.stage?.bokehPass && step.camera) {
        const dx = step.camera.position[0] - step.camera.target[0];
        const dy = step.camera.position[1] - step.camera.target[1];
        const dz = step.camera.position[2] - step.camera.target[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        ctx.stage.bokehPass.uniforms.focus.value = dist;
        ctx.stage.bokehPass.uniforms.aperture.value = step.dofAperture ?? 0.00005;
        ctx.stage.bokehPass.uniforms.maxblur.value = 0.006;
      }
    },
  })),
});
