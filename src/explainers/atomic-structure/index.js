import { defineExplainer } from '../../framework/index.js';
import { isExportRender } from '../../framework/stage.js';
import { TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildAtom } from './model.js';

// Camera bearings, not raw vectors — an atom is round from every direction, so
// azimuth, elevation and distance are the only shot variety there is. Azimuth
// marches ~45 deg per step (one continuous hero arc), and the distance does the
// storytelling: 4.2 for the whole atom, 1.2 for the dive into the nucleus, then
// out past 6 as the rings dissolve into a cloud that is genuinely bigger.
const CENTER = [0, 2.05, 0];

function shot(azDeg, elDeg, dist, push = 0.17) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  const position = [CENTER[0] + dist * d[0], CENTER[1] + dist * d[1], CENTER[2] + dist * d[2]];
  // Aim left of the atom so the atom sits right of frame centre — the text
  // panel owns the left ~38%. Camera-right in world is (dz, 0, -dx).
  // Video export hides that panel entirely (.steps display:none in
  // export-video.mjs), so the offset that clears it on the live site is just
  // dead space on the left of an exported frame — isExportRender() is the
  // same flag stage.js/player.js already use to tell the two apart, so drop
  // the offset to zero there and aim dead centre instead.
  const rx = d[2];
  const rz = -d[0];
  const rl = Math.hypot(rx, rz) || 1;
  const k = isExportRender() ? 0 : (push * dist) / rl;
  return { position, target: [CENTER[0] - k * rx, CENTER[1], CENTER[2] - k * rz] };
}

// Default timeline: one scalar sweeping 0->1 per lap. Every motion in the model
// is a whole number of cycles of that scalar (5 turns for the inner electron
// pair, 3 for each outer ring, 4 nuclear breaths, 3 jiggles), so the wrap lands
// on an identical pose.
function run(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ phase: s.t }),
    });
  };
}

// Every onEnter pins the COMPLETE state — anything left unpinned inherits
// whatever the previous step's loop happened to be doing when you scrolled.
const state = (over) => ({
  phase: 0,
  spinTurns: 1,
  nucleusOn: 1,
  ringsOn: 1,
  bind: 0,
  repel: 0,
  protonGlow: 0,
  neutronGlow: 0,
  cloud1s: 0,
  cloudL: 0,
  cloud2s: 0,
  lobes: 0,
  shrink: 0,
  ...over,
});

export default defineExplainer({
  ...meta,

  // No `dof`: the probability clouds are additive points that write no depth,
  // so BokehPass would read them as infinitely far away and blur every one.
  stageOptions: { space: true },

  buildScene({ scene, stage }) {
    return buildAtom({ scene, stage });
  },

  steps: [
    {
      id: 'hero',
      heading: '1 · A carbon atom, running',
      body: 'Every solid thing you have ever touched is built out of these. This one is carbon: twelve particles clenched together in the middle, six more sweeping around them. It is not a ball of anything. It is a tiny, absurdly dense knot with a great deal of nothing around it — and the nothing is what gives matter its size.',
      hint: 'Drag to orbit. Nothing here is decorative — the particle counts, the packing and the shape of the cloud later on are all the real ones.',
      camera: shot(20, 12, 3.9),
      onEnter: ({ handles }) => {
        handles.set(state({}));
        handles.setLabels(false);
      },
      timeline: run(9000),
    },
    {
      id: 'nucleus',
      heading: '2 · The knot in the middle',
      body: 'Fly into the centre and the atom stops being empty. Twelve particles are pressed together here, each about a millionth of a billionth of a metre across, every one touching its neighbours. Nothing in ordinary life is packed like this — a teaspoon of it would weigh around a billion tonnes. Holding it together is a force with almost no reach: past the particle next door, it simply stops.',
      camera: shot(66, 20, 1.2),
      focus: ['Proton · +1', 'Neutron · no charge', 'Strong force binds them'],
      onEnter: ({ handles }) => {
        handles.set(state({ ringsOn: 0, bind: 1, protonGlow: 0.3, neutronGlow: 0.3 }));
        handles.setLabels('nucleus');
      },
      timeline: run(7000),
    },
    {
      id: 'protons',
      heading: '3 · Six protons is the entire definition of carbon',
      body: 'The red ones carry positive charge, and there are exactly six. That count is not a property of carbon — it is carbon. Five and this would be boron, seven and it would be nitrogen; nothing else about the atom gets a vote. Which leaves an obvious problem: six like charges crammed this close should tear the thing apart. Watch them try. At this range the strong force is over a hundred times stronger, and it hauls them straight back.',
      camera: shot(112, 6, 1.25),
      focus: ['6 protons', 'Like charges repel'],
      onEnter: ({ handles }) => {
        handles.set(state({ ringsOn: 0, bind: 1, repel: 1, protonGlow: 1 }));
        handles.setLabels('protons');
      },
      timeline: run(6000),
    },
    {
      id: 'neutrons',
      heading: '4 · Neutrons bring mass and no argument',
      body: 'The grey ones are near-copies of the protons — a hair heavier, built from the same kind of stuff — except they carry no charge whatsoever. That makes them ideal packing material: they add to the strong pull that binds the nucleus while contributing nothing to the electrical push trying to burst it. Change how many there are and it is still carbon, just a different weight of it. Six is the carbon-12 in your bones; eight is the carbon-14 that dates a bone once you are done with it.',
      camera: shot(158, 26, 1.2),
      focus: ['6 neutrons', 'Mass, no repulsion'],
      onEnter: ({ handles }) => {
        handles.set(state({ ringsOn: 0, bind: 1, neutronGlow: 1 }));
        handles.setLabels('neutrons');
      },
      timeline: run(7000),
    },
    {
      id: 'shells',
      heading: '5 · Six electrons, in two layers',
      body: 'Back out, and the rest of the atom is electrons — held by nothing but electrical attraction, six negatives answering six positives, so the whole thing comes out neutral. They cannot sit wherever they like. The first layer takes two and closes; the next has room for eight, and carbon only brings four. That half-empty outer layer is why carbon grabs four things at once, and why it, rather than any other element, ended up building you.',
      camera: shot(200, 14, 4.0),
      focus: ['First shell · 2', 'Second shell · 4 of 8', 'Electron · −1'],
      onEnter: ({ handles }) => {
        handles.set(state({}));
        handles.setLabels('shells');
      },
      timeline: run(8000),
    },
    {
      id: 'cloud',
      heading: '6 · The rings are a lie',
      body: 'An electron does not run a lap. It has no path at all — only a probability of turning up somewhere — and this fog is the honest picture. Notice where it is densest: exactly where the ring was drawn, which is why the ring stayed a useful lie for a century. Between one measurement and the next there is no point on a track where the electron is. The count never changes, though. Six, smeared.',
      hint: 'The cloud is sampled from the real thing: the same radial probability functions quantum mechanics predicts, scaled to fit the frame.',
      camera: shot(246, 22, 5.4),
      focus: ['Where it probably is', 'Still 6 electrons'],
      onEnter: ({ handles }) => {
        handles.set(state({ ringsOn: 1, cloud1s: 0, cloudL: 0 }));
        handles.setLabels('cloud');
      },
      timeline: ({ tl, handles }) => {
        // The lie dissolving into the truth and re-forming, once per lap. Zero
        // at both ends by construction, so the wrap is invisible.
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 11000,
          ease: 'linear',
          onUpdate: () => {
            const k = 0.5 - 0.5 * Math.cos(TAU * s.t);
            handles.set({ phase: s.t, ringsOn: 1 - k, cloud1s: k, cloudL: k });
          },
        });
      },
    },
    {
      id: 'orbitals',
      heading: '7 · The fog has a shape',
      body: 'Those probabilities are not shapeless. Each electron occupies an orbital — a standing-wave pattern as fixed as the shapes a drum skin is allowed to vibrate in. Two of carbon\'s outer electrons fill the round one. The other two take a dumbbell each and, by a rule about spin, spread out instead of pairing up, which leaves the third dumbbell empty. Those two half-filled lobes are the hands carbon reaches out with.',
      // The one held camera in the set, and the turntable is off with it. The
      // three lobes lie on the world axes; from 45 deg round and 38 deg up, the
      // two occupied ones open into a clear cross and the empty one stands
      // vertical. Spin it and both collapse end-on twice a lap.
      camera: shot(315, 38, 5.6),
      focus: ['2p orbital · occupied', '2s orbital · round', 'This 2p sits empty'],
      onEnter: ({ handles }) => {
        handles.set(state({ spinTurns: 0, ringsOn: 0, cloud1s: 0.5, cloudL: 1 }));
        handles.setLabels('orbitals');
      },
      timeline: ({ tl, handles }) => {
        // The round outer shell separating into the shapes it is actually made
        // of, and re-merging. Same seamless construction as step 6.
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 11000,
          ease: 'linear',
          onUpdate: () => {
            const k = 0.5 - 0.5 * Math.cos(TAU * s.t);
            handles.set({ phase: s.t, cloudL: 1 - k, lobes: k, cloud2s: k });
          },
        });
      },
    },
    {
      id: 'scale',
      heading: '8 · Almost all of it is nothing',
      body: 'Here is the part nobody can really picture. That nucleus has been drawn about a thousand times too big this whole time. Shrink it toward the truth and it vanishes: the real one is a twenty-five-thousandth of the atom\'s width, and even the speck left here is far too large. Put a marble on the centre spot of a stadium and the electrons reach the back row — and the marble is 99.97% of the mass.',
      camera: shot(338, 18, 5.0),
      focus: ['True nucleus, near enough', 'The rest is electron'],
      onEnter: ({ handles }) => {
        handles.set(state({ shrink: 1, cloudL: 0.35 }));
        handles.setLabels('scale');
      },
      timeline: run(9000),
    },
    {
      id: 'run',
      heading: '9 · Neutral, empty, and somehow solid',
      body: 'Six positive, six negative, nothing left over — which is why an atom does not fling you across the room. And yet your hand will not go through a table, though both are very nearly empty. Nothing touches. What stops you is the outer electrons of one shoving the outer electrons of the other, plus a quantum rule that forbids two of them from settling into the same state. Solidity is a negotiation between clouds.',
      hint: 'Drag to orbit — the whole atom, back the way it started.',
      camera: shot(384, 15, 4.4),
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.set(state({ spinTurns: 2, cloudL: 0.22 }));
        handles.setLabels(false);
      },
      timeline: run(6000),
    },
  ],
});
