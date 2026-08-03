// steps: 0 anatomy · 1 compressor · 2 condenser · 3 capillary tube
//        4 evaporator · 5 the cycle runs
export default {
  hook: 'An air conditioner never\nactually makes cold.',

  short: {
    dolly: 1.6,
    shots: [
      { step: 0, seconds: 4, dolly: 1.7,
        narration: 'An air conditioner has never made a single degree of cold.' },
      { step: 0, seconds: 5,
        narration: 'It only catches heat that’s already in your room and shoves it outside — that’s exactly what makes the room feel cooler.' },
      { step: 0, seconds: 5,
        narration: 'So how do you grab heat from somewhere cool, and dump it into air that’s already hotter?' },
      { step: 1, seconds: 8, labels: ['Compressor'],
        narration: 'The trick is a fluid built to boil and condense on command. First, the compressor squeezes it into a gas so hot it beats the summer air outside.' },
      { step: 2, seconds: 7, labels: ['Condenser coil'],
        narration: 'Therefore that scorching gas can finally dump its heat — the condenser coil bleeds it into the outside breeze, and it collapses into a warm liquid.' },
      { step: 3, seconds: 8, labels: ['Filter drier', 'Capillary tube'],
        narration: 'But a liquid doesn’t turn cold on its own. Forced through a tube thinner than a pencil lead, part of it flashes back into gas — and that flash chills the whole stream.' },
      { step: 4, seconds: 7, labels: ['Evaporator coil', 'Cross-flow blower'],
        narration: 'Therefore, by the time it reaches the indoor coil, it’s colder than your room — so heat pours into it instead, and the air blowing across comes out cold.' },
      { step: 5, seconds: 7,
        narration: 'A single home AC moves enough heat out of your house each day to melt a literal ton of ice — that’s really where ‘one ton of cooling’ comes from.' },
      { step: 5, seconds: 5,
        narration: 'Run it all day, and you’re not making cold. You’re paying to haul heat outside, nonstop.' },
      { step: 5, seconds: 4,
        narration: 'It never makes cold. It only moves heat.' },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 10,
        narration: 'Here’s the twist: an air conditioner never actually creates cold. There’s no such thing as cold to make, only heat to remove. It’s really a heat pump — it catches the heat already inside your room and hauls it outside, and that’s exactly what makes the room feel cooler. One special fluid does the hauling, cycling round and round between two coils.' },
      { step: 1, seconds: 9,
        narration: 'The loop starts at the compressor. Squeezing a gas heats it up — the same reason a bike pump gets warm in your hand — and this squeeze is deliberate. By the time the refrigerant leaves the compressor, it’s hotter than the air outside.' },
      { step: 2, seconds: 9,
        narration: 'Therefore, that scorching gas can finally give up its heat. It flows into the outdoor condenser coil while a fan drags air across the fins, and because the gas is hotter than that air, heat flows out of it into the breeze. As it cools, the gas condenses into a warm liquid.' },
      { step: 3, seconds: 9,
        narration: 'But a warm liquid doesn’t turn cold by itself. It’s forced through the capillary tube, a coil of copper barely thicker than a hair, and squeezed through that fast, part of it flashes straight back into gas. That flash boil drags heat out of everything around it, chilling the whole stream far below room temperature.' },
      { step: 4, seconds: 10,
        narration: 'Therefore, by the time it reaches the indoor evaporator coil, it’s colder than the room. A blower pushes your warm air across the fins, heat flows into the cold refrigerant instead of out, and the air on the other side comes out noticeably cooler. Absorbing that heat boils the refrigerant back into a gas.' },
      { step: 5, seconds: 12,
        narration: 'That gas heads straight back to the compressor, and the whole loop starts over. A typical home unit moves enough heat out of a house every single day to melt a literal ton of ice — that’s genuinely where the phrase ‘a ton of cooling’ comes from. Run it all day and you’re not paying for cold. You’re paying to haul heat outside, nonstop. No cold is ever made. Heat just leaves.' },
    ],
  },
};
