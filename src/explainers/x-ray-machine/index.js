import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildXrayMachine } from './model.js';

// Reveal story: the sealed suite (tube head, collimator, step wedge, detector)
// -> ghost the head to find a glass tube floating in oil -> the filament that
// boils electrons -> the kilovolt drop that throws them -> the spinning anode
// that turns 99% of them into heat -> the lead and the shutters that keep one
// thin rectangle of the result -> the shadow the wedge casts -> the layers that
// turn that shadow into a file -> a sealed, running exposure to finish.
//
// Seamless loops: setPhase is one 0-1 phase. The anode turns 6 whole turns per
// lap, the electron stream and the photon stream are both frac(phase*k + i/n)
// so frame 0 == frame 1, and the filament breathes on whole sine cycles. Every
// discrete event (the shutters in step 6, the exposure in step 9) is a pair of
// smoothstep windows that starts and ends at exactly the same value.

// CAMERA RULE for this scene: every pose sits on the +Z side, so world +X is
// screen-right and the beam always reads left-to-right — tube head, wedge,
// detector, in that order. Each step then targets a point ~0.15 of a frame
// width to the LEFT of its subject, which pushes that subject into the right
// two-thirds and clear of the text panel.

// Pin ALL scene state on entering a step (pre-flight #4): reveal, panel cutaway,
// shutter aperture, beam, leakage, the image and the labels — so scrolling in
// either direction lands on an identical frame.
const view =
  ({
    reveal = 0,
    cut = 0,
    shutter = 1,
    beam = 1,
    leak = false,
    image = 0,
    labels = false,
  }) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setPanelCut(cut);
    handles.setShutter(shutter);
    handles.setBeam(beam);
    handles.setLeak(leak);
    handles.setImage(image);
    handles.setLabels(labels);
  };

function phaseLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setPhase(s.t) });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildXrayMachine({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'There is no camera in here',
      body: 'An X-ray machine takes no photograph. There is no lens anywhere in it and nothing in it responds to light. All it does is put a source of something that goes through solid objects at one end of a room, a detector at the other, and let you stand in between. Every X-ray image you have ever seen is a shadow — and this entire machine exists to make one small, hard, precisely-aimed place for that shadow to be cast from.',
      hint: 'Drag to orbit · scroll to look inside. The block in the beam is an aluminium step wedge — the test object radiographers check their machines with.',
      camera: { position: [-2.35, 2.8, 4.4], target: [-0.75, 1.25, 0] },
      dofAperture: 0.00003,
      onEnter: view({ reveal: 0, beam: 1, image: 0, labels: 'exterior' }),
      timeline: phaseLoop(6500),
    },
    {
      id: 'inside',
      heading: 'A glass tube in a bath of oil',
      body: 'Take the housing off and there is startlingly little inside: one sealed glass envelope, about the size of a jam jar, floating in mineral oil. The oil has two jobs — carry the heat away, and hold a hundred thousand volts off the steel around it. That steel is lined with lead, because this tube sprays X-rays in every direction and only one of them is wanted. And inside the glass is a vacuum, pumped down hard enough that an electron can cross the whole tube without meeting a single atom.',
      camera: { position: [-0.7, 1.85, 2.15], target: [-1.25, 1.3, 0] },
      dofAperture: 0.00008,
      focus: ['Glass envelope — vacuum inside', 'Insulating oil', 'Lead-lined housing'],
      onEnter: view({ reveal: 1, beam: 0.35, labels: 'head' }),
      timeline: phaseLoop(5200),
    },
    {
      id: 'cathode',
      heading: 'It starts by boiling a wire',
      body: 'At the top of the tube is the cathode, and it is nothing but a coil of tungsten wire roughly as thick as a human hair. Push a current through it and it sits at about 2,000 °C — white-hot, the way an old light bulb is — and at that temperature electrons stop being held by the metal and simply evaporate off it, hanging around the wire in a cloud. The little cup they sit in is charged negative, and since electrons are repelled by anything negative, the cup squeezes that cloud instead of letting it spread. How hard you heat the wire sets how many electrons you get: that is the milliamps on the control panel.',
      camera: { position: [-0.8, 1.43, 0.55], target: [-0.93, 1.44, 0] },
      dofAperture: 0.0004,
      focus: ['Tungsten filament · 2,000 °C', 'Focusing cup'],
      onEnter: view({ reveal: 1, beam: 1, labels: 'cathode' }),
      timeline: phaseLoop(3400),
    },
    {
      id: 'accelerate',
      heading: 'Then drop them off a 100,000-volt cliff',
      body: 'Nothing has actually moved yet. Then the generator puts up to 120,000 volts between that wire and the metal target below it, and the cloud is gone — electrons crossing the gap at over half the speed of light. There is no air in the way to slow them or scatter them, so they arrive together, on a footprint about the size of a grain of rice. The kilovolts do not change how many electrons make the trip, only how hard each one lands, and that is what decides whether the X-rays coming out are soft enough to stop in skin or hard enough to cross a chest.',
      hint: 'Amber dots are electrons — the current the tube is drawing.',
      camera: { position: [-0.72, 1.55, 0.7], target: [-1.0, 1.39, 0] },
      dofAperture: 0.00028,
      focus: ['Electrons boil off', 'Focal track'],
      onEnter: view({ reveal: 1, beam: 1, labels: 'cathode' }),
      timeline: phaseLoop(2800),
    },
    {
      id: 'anode',
      heading: 'Ninety-nine per cent of this is a heater',
      body: 'The electrons hit tungsten and stop dead. A few swerve past a nucleus instead of hitting one, and the sharper the swerve the more energy they shed as a single photon — braking radiation, which is most of the X-rays this machine makes. It is a dreadful way to make them. About one per cent of the energy leaves as X-rays; the other ninety-nine turns into heat, all of it landing on a patch you could cover with a full stop. Solid metal would melt in seconds. So the target is a disc, and the disc spins at three thousand revolutions a minute or more, dragging cold metal under the beam and smearing the damage around a whole ring instead of a point. The motor that turns it has no wires inside the vacuum: the copper rotor is sealed in the glass, and the stator coils outside drag it round through the wall.',
      hint: 'The 16° bevel is the trick behind sharpness — a broad, cooler footprint on the metal, foreshortened into a point when seen from the beam.',
      camera: { position: [-0.62, 1.28, 0.84], target: [-1.06, 1.2, 0] },
      dofAperture: 0.00022,
      focus: ['Tungsten-rhenium disc · 90 mm', 'Focal track', 'Stator — outside the glass'],
      onEnter: view({ reveal: 1, beam: 1, labels: 'anode' }),
      timeline: phaseLoop(3000),
    },
    {
      id: 'collimate',
      heading: 'Only one way out',
      body: 'X-rays leave that spot in every direction at once, which is why the housing is lined with lead — anything not aimed at the port is stopped within a couple of millimetres of metal. What is left escapes through a window of beryllium, a metal so light that X-rays barely notice it is there. Then the collimator crops what remains: two pairs of lead blades slide in and out to cut the cone down to a rectangle exactly the size of the thing being imaged and not one centimetre bigger. That is not tidiness — every photon that lands outside the picture is dose spent for nothing. The mirror sitting at forty-five degrees in the beam folds a lamp along the same path, which is the only way to see where an invisible beam is pointing.',
      camera: { position: [-0.3, 1.85, 1.55], target: [-0.95, 1.28, 0] },
      dofAperture: 0.00012,
      focus: ['Lead shutters', 'Lead soaks up all the rest', 'Light-field mirror'],
      onEnter: view({ reveal: 1, beam: 1, leak: true, shutter: 1, labels: 'beam' }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5600,
          ease: 'linear',
          onUpdate: () => {
            handles.setPhase(s.t);
            // closes down and reopens; both windows are complete by t=1, so the
            // aperture is back to exactly 1 at the wrap
            handles.setShutter(1 - 0.78 * (win(s.t, 0.16, 0.34) - win(s.t, 0.62, 0.82)));
          },
        });
      },
    },
    {
      id: 'shadow',
      heading: 'The picture is a shadow',
      body: 'Now the beam crosses the room and meets something. Each step of this aluminium wedge is thicker than the last, and each one takes a bigger bite out of the photons crossing it — you can watch them stop arriving. What makes X-ray images legible is that absorption is brutally sensitive to what a material is made of: it climbs roughly with the cube of atomic number. That is the whole reason bone shows up. Calcium is atom-for-atom far heavier than the hydrogen, carbon and oxygen in everything packed around it, so it swallows photons its neighbours let straight through. A rib is a thicker, denser step.',
      hint: 'Bright on the panel means absorbed — that patch is where photons never arrived.',
      camera: { position: [-1.25, 1.85, 2.55], target: [0.1, 1.28, 0] },
      dofAperture: 0.00007,
      focus: ['Aluminium step wedge', 'The shadow'],
      onEnter: view({ reveal: 0, beam: 1, image: 1, labels: 'shadow' }),
      timeline: phaseLoop(4200),
    },
    {
      id: 'detector',
      heading: 'How a shadow becomes a file',
      body: 'The panel it lands on has no film in it and never did. First comes a grid of lead strips standing on edge, each one aimed back at the tube: a photon that came straight through passes between them, and a photon that bounced off something on the way — arriving at the wrong angle, carrying no useful information, only fog — hits a strip and dies there. Behind that is a layer of caesium iodide, grown in fine needles so the light cannot wander sideways, which flashes visibly every time an X-ray is absorbed in it. And behind that, a sheet of silicon photodiodes with a transistor at every pixel, reading out how much light each one caught. X-ray to light to charge to number, in about a second.',
      camera: { position: [-0.3, 1.68, 1.55], target: [0.55, 1.3, 0.05] },
      dofAperture: 0.00035,
      focus: ['Anti-scatter grid', 'CsI scintillator → light', 'TFT photodiode array'],
      onEnter: view({ reveal: 0, cut: 1, beam: 1, image: 0.18, labels: 'detector' }),
      timeline: phaseLoop(3800),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Spin the anode up, heat the filament, open the blades, put a hundred thousand volts across the gap — and it is over in a few hundredths of a second. That is the strangest thing about this machine: it spends its whole life idling and cooling, and the exposure itself is shorter than a blink. A wire is boiled, electrons are thrown, a slab of tungsten gets briefly and violently hot, and one per cent of all that effort walks through you and leaves its shadow on the far wall.',
      hint: 'Drag to orbit while it fires.',
      camera: { position: [-2.05, 2.55, 4.7], target: [-0.7, 1.24, 0] },
      freeOrbit: true,
      onEnter: view({ reveal: 0, shutter: 0.9, beam: 0, image: 0 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4800,
          ease: 'linear',
          onUpdate: () => {
            handles.setPhase(s.t);
            // one exposure per lap: the beam fires, the image builds behind it,
            // and both windows finish before the wrap so the lap starts dark
            handles.setBeam(win(s.t, 0.28, 0.36) - win(s.t, 0.72, 0.8));
            handles.setImage(win(s.t, 0.34, 0.48) - win(s.t, 0.82, 0.93));
          },
        });
      },
    },
  ],
});
