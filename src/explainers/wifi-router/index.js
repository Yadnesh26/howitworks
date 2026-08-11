import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildRouter } from './model.js';

// Reveal story: the sealed router first, then the lid ghosts to expose the
// board, then we follow one packet out through the radio section and the power
// amp into the coax, then a radome ghosts to show the six centimetres of
// copper that actually does the radiating. From there the physics: the two
// bands, the queue in the air, the three streams — and the wired half that
// gives the thing its name, before it seals up and runs.
//
// Seamless loops: setPhase is a single 0-1 phase every flow rides via
// getPointAt (wraps mod 1), every ring train advances exactly two whole
// wavefronts per lap with an envelope that is zero at both ends, the LEDs
// breathe on whole sine cycles, and the airtime slots begin and end in the
// silent backoff gap — so frame 0 and frame 1 are the same frame.

// Pin ALL scene state on entering a step (pre-flight #4): reveal, radome,
// both wave trains, pattern, clients, airtime, streams, beam and labels — so
// scrolling either way lands on exactly the same frame.
const view =
  ({
    reveal = 1,
    radome = 0,
    waves = 0,
    waves5 = 0,
    pattern = false,
    clients = false,
    air = false,
    streams = false,
    beam = 0,
    labels = false,
  }) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setRadomeOpen(radome);
    handles.setWaves(waves);
    handles.setWaves5(waves5);
    handles.setPattern(pattern);
    handles.setClients(clients);
    handles.setAir(air);
    handles.setStreams(streams);
    handles.setBeam(beam);
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
    return buildRouter({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'It is whispering',
      body: 'A black slab, five sockets and three sticks of plastic — and it never stops talking. But not loudly: a router transmits at about a tenth of a watt, a fraction of the bulb inside your fridge. What is remarkable is the other direction. It can hear a reply of one picowatt: a hundred billion times fainter than what it just sent. Almost all of the range you get is that ear, not the voice.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [2.9, 2.3, 4.2], target: [-0.45, 0.95, 0.1] },
      dofAperture: 0.00003,
      onEnter: view({ reveal: 0, waves: 0.85, labels: 'exterior' }),
      timeline: phaseLoop(6400),
    },
    {
      id: 'inside',
      heading: 'Two machines sharing a lid',
      body: 'Lift the lid and one board is doing two unrelated jobs. Toward the back sits a gigabit switch chip: that corner is a very small network exchange, shovelling frames between the wired ports. Everything else is a radio. A processor under a finned heat sink runs the whole machine, a couple of memory chips hold what it is thinking, and each band gets its own soldered metal box.',
      camera: { position: [2.1, 2.85, 2.25], target: [-0.42, 0.3, -0.18] },
      // shallow enough to keep the rear socket row legible — the copy names it
      dofAperture: 0.00005,
      focus: ['SoC under its heat sink', '2.4 GHz radio, shielded', '5 GHz board'],
      onEnter: view({ reveal: 1, labels: 'board' }),
      timeline: phaseLoop(5200),
    },
    {
      id: 'chain',
      heading: 'Why the radio lives in a tin box',
      body: 'Those little soldered cans are not styling. The receiver next to them has to pick out signals of a picowatt, and the digital side of the board is spitting switching noise a trillion times stronger — so the radio gets its own metal room, with holes stamped in the lid for heat but none big enough for the wavelengths it cares about. What leaves the room is tiny, so a power amplifier lifts it to about a tenth of a watt, and a hair-thin coaxial cable carries it to the antenna without letting a scrap of it leak on the way.',
      camera: { position: [1.6, 1.7, 2.4], target: [-1.0, 0.35, 0.25] },
      dofAperture: 0.0002,
      focus: ['Power amplifier — 100 mW', 'Coax to the antenna'],
      onEnter: view({ reveal: 1, labels: 'chain' }),
      timeline: phaseLoop(3600),
    },
    {
      id: 'antenna',
      heading: 'Six centimetres of copper',
      body: 'The plastic stick is a raincoat. Inside it is a strip of circuit board with a thin line of copper up the middle, and the length of that line is the entire trick: at 2.4 gigahertz a radio wave is about 12 centimetres long, so the metal is cut to half of that — two arms of roughly three centimetres either side of the feed point. Current sloshes up one arm and down the other, 2.4 billion times a second, and the field it drags along cannot keep up and peels off into the room.',
      hint: 'One radome is ghosted so you can see the element.',
      camera: { position: [2.03, 1.36, 0.28], target: [0.86, 1.0, -0.75] },
      dofAperture: 0.00022,
      focus: ['6 cm of copper — half a wavelength', 'Feed point'],
      onEnter: view({ reveal: 1, radome: 1, waves: 0.22, labels: 'antenna' }),
      timeline: phaseLoop(3200),
    },
    {
      id: 'bands',
      heading: 'A doughnut, not a ball',
      body: 'A dipole does not radiate evenly in every direction. It throws its signal out sideways, all the way round the horizon, and almost nothing along its own axis — the pattern is a doughnut with the antenna through the hole. Point an antenna straight up and you have aimed its one dead spot at the floor above. That is also why there are two elements on the strip: a long pair for 2.4 gigahertz and a pair half as long for 5, whose waves are only six centimetres from crest to crest. Shorter waves carry more data and bend around a doorway far worse — six to ten decibels of your house eats them.',
      hint: 'Violet is 5 GHz; periwinkle is 2.4.',
      camera: { position: [2.9, 1.9, 2.6], target: [0.3, 1.05, -0.5] },
      dofAperture: 0.00006,
      focus: ['2.4 GHz — 12 cm waves', '5 GHz — 6 cm waves'],
      onEnter: view({ reveal: 0, radome: 1, waves: 0.8, waves5: 0.85, pattern: true, labels: 'bands' }),
      timeline: phaseLoop(4200),
    },
    {
      id: 'air',
      heading: 'Everyone shares one wire',
      body: 'Here is the part nobody tells you: on a given channel, exactly one device may transmit at a time — the router included. Wi-Fi is half duplex, and the air is a single shared wire. So every device listens first, waits a fixed gap, then waits a further random moment so that two of them do not start together, and only then speaks; the receiver answers with an acknowledgement, and the floor is free again. A café network is not weak. It is a queue, and what you feel as lag is your turn coming round.',
      hint: 'Watch: only one link is ever lit.',
      camera: { position: [2.6, 3.4, 4.4], target: [-0.3, 0.7, 0.2] },
      dofAperture: 0.00003,
      focus: ['One talker at a time', 'Waiting its turn'],
      onEnter: view({ reveal: 0, clients: true, air: true, labels: 'air' }),
      timeline: phaseLoop(7200),
    },
    {
      id: 'mimo',
      heading: 'Three antennas, one frequency',
      body: 'Since the queue is the bottleneck, everything modern is about finishing your turn faster. Three antennas send three different data streams on the very same frequency at the very same moment; they arrive smeared together, but each has bounced off the room differently, and the receiver — which also has several antennas — can untangle them. Then the router does something sharper still: it shifts the timing between its antennas by fractions of a wavelength so the waves reinforce in one direction and cancel elsewhere. The doughnut leans. Nothing moved.',
      camera: { position: [3.3, 2.1, 3.0], target: [0.1, 0.75, 0.25] },
      dofAperture: 0.00006,
      focus: ['Three streams, one frequency', 'Beam leans toward the device'],
      onEnter: view({ reveal: 0, clients: true, streams: true, beam: 1, labels: 'mimo' }),
      timeline: phaseLoop(3600),
    },
    {
      id: 'wired',
      heading: 'The half that gives it its name',
      body: 'Round the back is the machine the name actually refers to. One socket faces the internet; the other four face your house, and behind all five sit little transformers that pass the signal while keeping their voltages apart. The processor holds a table: every conversation your devices open gets a line in it, so when a reply arrives addressed to your single public address, the router knows which laptop in which room asked for it. Take that table away and the whole house would need its own address on the internet.',
      camera: { position: [-1.1, 1.3, -3.4], target: [0.1, 0.45, -0.7] },
      dofAperture: 0.00022,
      focus: ['WAN — the internet side', 'Isolation magnetics'],
      onEnter: view({ reveal: 1, labels: 'wired' }),
      timeline: phaseLoop(4000),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'A frame arrives on copper, crosses the switch, gets a line in the table, is handed to the radio, amplified to a tenth of a watt, pushed up a coaxial cable and shaken off six centimetres of metal as a wave — then the room answers in a whisper and the whole thing runs backwards. Several hundred times a second, all day, from a box you have never once thought about.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-3.0, 2.2, 4.0], target: [-0.55, 0.9, -0.15] },
      freeOrbit: true,
      onEnter: view({ reveal: 0, waves: 0.9, waves5: 0.5 }),
      timeline: phaseLoop(3400),
    },
  ],
});
