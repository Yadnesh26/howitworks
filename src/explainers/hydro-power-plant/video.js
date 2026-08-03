// steps: 0 anatomy · 1 reservoir · 2 penstock · 3 turbine · 4 generator
//        5 step-up & grid · 6 tailrace · 7 plant runs
export default {
  hook: 'The water that lights up a whole city\nnever touches a single wire.',

  short: {
    dolly: 2.3,
    shots: [
      { step: 0, seconds: 3, dolly: 2.5,
        narration: 'The water that lights up a whole city never touches a single wire.' },
      { step: 0, seconds: 4, dolly: 2.5,
        narration: "It isn't burning anything, isn't splitting an atom — it's just gravity, doing the work." },
      { step: 0, seconds: 4, dolly: 2.5,
        narration: 'So how does a waterfall turn into power for a million homes?' },
      { step: 1, seconds: 5,
        narration: 'It starts in the reservoir, held back behind a dam — pure height, stored and waiting to fall.' },
      { step: 1, seconds: 5,
        narration: "Double that height and you double the power. That's the whole physics of a hydro plant." },
      { step: 2, seconds: 5,
        narration: 'Let it go, and it drops through the penstock, trading height for speed on the way down.' },
      { step: 3, seconds: 5,
        narration: 'At the bottom, it slams into a turbine and spins a shaft with tons of force.' },
      { step: 4, seconds: 5,
        narration: 'That spin drags magnets past copper coils, and motion turns straight into current.' },
      { step: 5, seconds: 6,
        narration: "A transformer boosts it for the trip, and it's gone — off to power your wall socket." },
      { step: 6, seconds: 6,
        narration: 'But the water that did all that work? Still there — flowing on downstream, ready to fall again tomorrow.' },
      { step: 7, seconds: 4,
        narration: 'No flame. No fuel. Just gravity, doing the work.' },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 8, narration: 'This is a hydroelectric power plant. It’s one of the oldest and cleanest ways we make electricity, and the whole thing runs on a simple idea: let water fall, and catch the energy on the way down.' },
      { step: 1, seconds: 9, narration: 'It begins with the reservoir, a huge lake of water held high behind a dam. Sitting up there, the water carries potential energy, just waiting. The higher it sits and the more there is, the more power the plant can make.' },
      { step: 2, seconds: 9, narration: 'When power is needed, gates open and water pours into the penstock, a massive steel pipe running down the dam. As it falls, that stored height converts into pressure and tremendous speed.' },
      { step: 3, seconds: 9, narration: 'At the bottom, the jet of water strikes the blades of a turbine and spins it. This is the heart of the plant, where the raw motion of the water becomes spinning mechanical power.' },
      { step: 4, seconds: 9, narration: 'The turbine shaft drives a generator. Inside, powerful electromagnets spin past coils of wire, and that moving magnetic field pushes electrons through the wire. Motion in, electricity out.' },
      { step: 5, seconds: 9, narration: 'That electricity leaves at a modest voltage, no good for long trips. So a step-up transformer boosts it to hundreds of thousands of volts, letting it travel across the country with barely any loss.' },
      { step: 6, seconds: 8, narration: 'And the water? Its job done, it flows out the tailrace back into the river below, continuing downstream as if nothing happened. Nothing is burned, nothing used up.' },
      { step: 7, seconds: 9, narration: 'Reservoir, penstock, turbine, generator, grid. A continuous chain that turns the simple fall of water into power for millions, as long as the river keeps flowing.' },
    ],
  },
};
