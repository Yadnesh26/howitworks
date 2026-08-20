// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 complete · 1 inside the box · 2 compressor · 3 condenser
//        4 capillary tube · 5 evaporator · 6 the cycle runs
export default {
  hook: 'Your fridge doesn’t make cold.\nCold isn’t a thing you can make.',

  // fridge is tall & narrow — fits 9:16 naturally, so only a gentle pull-back
  dolly: 1.1,

  // 9:16, narrated + captions. First shot shows the whole fridge, then zoom in.
  short: {
    shots: [
      {
        step: 0,
        seconds: 5,
        dolly: 1.15,
        caption: 'This box makes zero cold',
        narration:
          'Your refrigerator doesn’t make cold. There’s no such thing as cold — it’s just the absence of heat. So what’s really going on in here?',
      },
      {
        step: 1,
        seconds: 6,
        caption: 'One sealed loop of refrigerant does everything',
        narration:
          'Ghost the shell, and it’s one sealed loop of copper tube, carrying a refrigerant that boils at minus twenty-six degrees. It’s a heat pump — it grabs heat from your food and throws it into the room.',
      },
      {
        step: 2,
        seconds: 6,
        caption: 'The hum? A pump making the gas hotter than your kitchen',
        narration:
          'That hum is the compressor, squeezing the gas until it’s hotter than your kitchen — because heat only flows from hot to cold. To dump heat into the room, it has to beat the room first.',
      },
      {
        step: 4,
        seconds: 6,
        caption: 'Squeezed through a hair-thin tube, it flashes cold',
        narration:
          'Then it’s forced through a tube thinner than a hair. The pressure collapses, and a liquid that suddenly loses pressure boils — dropping to around minus twenty-five degrees in an instant.',
      },
      {
        step: 5,
        seconds: 6,
        caption: 'Now it drinks the heat straight out of your food',
        narration:
          'Now it’s far colder than your food, so it soaks up the heat and boils back into a gas. Your food never touches anything cold — it just keeps having its heat stolen, a trickle at a time.',
      },
      {
        step: 6,
        seconds: 5,
        dolly: 1.15,
        caption: 'Compress · condense · choke · evaporate — for 20 years',
        narration:
          'Compress, condense, choke, evaporate. The same few grams of refrigerant, lapping the loop, humming a few times an hour, for twenty years.',
      },
    ],
  },

  // 16:9, full story, narrated
  long: {
    shots: [
      {
        step: 0,
        seconds: 10,
        narration:
          'The most reliable machine in your home hums a few times an hour and keeps food cold for twenty years. And here’s its secret: it doesn’t make cold at all. Cold isn’t something you can make — it’s just the absence of heat. A refrigerator is a heat pump. It grabs heat from inside the box and throws it into your kitchen.',
      },
      {
        step: 1,
        seconds: 10,
        narration:
          'Take off the doors and ghost the shell. One sealed loop of copper tube threads through the whole machine, charged with a refrigerant that boils at minus twenty-six degrees. Four stations sit on that loop, and the refrigerant laps the circuit, carrying heat with it — always from the inside, outward.',
      },
      {
        step: 2,
        seconds: 10,
        narration:
          'It starts at the compressor — that hum you hear when the fridge switches on. A piston pump sealed inside a black dome squeezes cool low-pressure vapour into hot, high-pressure vapour, hotter than your kitchen. That matters, because heat only flows from hot to cold. To dump heat into the room, the refrigerant first has to be made hotter than the room.',
      },
      {
        step: 3,
        seconds: 9,
        narration:
          'The hot vapour rises up the back, into the black grid of coils you’ve felt behind every fridge. Warmer than the kitchen air, it sheds its heat and condenses into a warm, high-pressure liquid. No fan needed — that’s why the back of a fridge is always warm.',
      },
      {
        step: 4,
        seconds: 10,
        narration:
          'Now the trick. That warm liquid is forced through several metres of tube barely wider than a hair. Fighting through costs it almost all its pressure — and a liquid that suddenly loses pressure boils, and boiling drinks in heat. Part of it flashes to vapour instantly, chilling the whole stream to around minus twenty-five degrees.',
      },
      {
        step: 5,
        seconds: 10,
        narration:
          'The icy mixture weaves up through the evaporator, hidden behind the freezer wall. Far colder than the food, it soaks up heat and boils fully back into a gas, while a small fan washes the chilled air down through the shelves. Then the gas rides back to the compressor, and the lap begins again.',
      },
      {
        step: 6,
        seconds: 9,
        narration:
          'Compress, condense, choke, evaporate — the same few grams of refrigerant lapping the loop, pumping heat from your food to your kitchen a trickle at a time. A thermostat just switches it on when the box drifts warm. That gentle hum, a few times an hour, for twenty years, is all a refrigerator ever does.',
      },
    ],
  },

  // Posting copy, consumed by scripts/make-postkit.mjs. The YouTube title is a
  // different job from the hook: the hook is heard AFTER the click, the title
  // has to earn it — so it leads with the contradiction, not the topic.
  platforms: {
    youtube: {
      title: "Your Fridge Doesn't Make Cold. Here's What It Actually Does",
      description: `There is no such thing as cold. Cold is just the absence of heat — so a refrigerator cannot make it. What it actually does is pump heat OUT of the box and dump it into your kitchen.

Follow one charge of refrigerant around the sealed loop: squeezed hotter than your kitchen by the compressor, shedding that heat through the black coils on the back, forced through a tube barely wider than a hair until it flashes to −25 °C, and finally drinking the heat straight out of your food.

Fully procedural 3D — every part in this animation is built from code, no scanned models.

00:00 Cold isn't a thing you can make
00:10 One sealed loop
00:20 The compressor
00:30 The condenser
00:39 The capillary tube
00:49 The evaporator
00:59 Four beats, twenty years`,
      tags: [
        'how it works',
        'refrigerator',
        'how a refrigerator works',
        'refrigeration cycle',
        'heat pump',
        'compressor',
        'condenser',
        'evaporator',
        'capillary tube',
        'thermodynamics',
        'engineering explained',
        '3d animation',
        'science',
        'appliance',
      ],
    },
    shorts: {
      title: "Your fridge doesn't make cold — it steals heat",
      hashtags: [
        '#whatdstuff',
        '#refrigerator',
        '#engineering',
        '#science',
        '#heatpump',
        '#3danimation',
        '#satisfying',
        '#shorts',
      ],
    },
  },
};
