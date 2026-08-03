// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover per format (see video-scripting
// skill) — make-narration.mjs synthesizes each format in a single ElevenLabs
// take, so every shot's line hands off into the next rather than reading as a
// stack of standalone facts. Built on the retention spine: pattern-interrupt
// hook -> stakes+loop plant -> spoken question -> BUT/THEREFORE mechanism ->
// isolated stat -> so-what -> callback button.
//
// The loop: planted in shot 2 ("nothing burns or wears out... it's a
// shuttle"), reinforced in shot 5 ("nothing was ever consumed"), closed in
// the final button ("the ions never wear out — where you park them is up to
// you"). Per this explainer's brief: shot 1 deliberately opens on the
// SCHEMATIC (layered electrodes + ions in motion), never the closed cell —
// closed-exterior covers underperform on this channel, even though the
// interactive explainer itself correctly opens on the solid product.
export default {
  hook: 'Charging to 100% every night\nis quietly killing it.',

  // Override: the pipeline's DEFAULT end card (scripts/export-video.mjs,
  // `editorial?.endCard ?? 'Share it with a curious mind\nwhatDstuff'`) has a
  // pre-existing bug — its second line renders as garbled literal text
  // "whatDstuff" (confirmed in this explainer's own frame-check pass; every
  // other shipped explainer's video.js leaves this unoverridden, so they are
  // very likely shipping the same broken card). Overriding here fixes THIS
  // explainer; the shared default is still broken for the rest of the
  // library and worth a real fix reported separately.
  endCard: 'Share it with a curious mind.',

  // 9:16 — ~90s (complex module: shuttle, intercalation, electron path,
  // discharge, SEI, cathode stress, plating, dendrite/short, payoff stat).
  short: {
    shots: [
      {
        // Zone 1 — hook: boldest true claim, word one. Cover = mechanism, not
        // the closed can (explicit brief requirement for this explainer).
        step: 2,
        dolly: 1.8,
        caption: 'Charging to 100% is quietly killing it.',
        narration: 'Charging your phone to 100 percent every night is quietly killing the battery inside it.',
      },
      {
        // Zone 2 — stakes + plant the loop
        step: 2,
        dolly: 1.8,
        caption: "It's not a fuel tank. It's a shuttle.",
        narration:
          "Here's the twist: nothing in here burns or wears out. It's not a fuel tank — it's a shuttle, the same ions moving back and forth.",
      },
      {
        // Zone 3 — the spoken question, reveal begins
        step: 1,
        dolly: 1.4,
        caption: "So what's actually in there?",
        narration:
          "So what's actually going on in there? Peel the can open — just two thin foils, one holding the lithium, one plain graphite.",
      },
      {
        // Zone 4a — mechanism: charging
        step: 2,
        dolly: 1.8,
        caption: 'Ions cross the gap; electrons take the wire.',
        narration:
          'Plug in a charger and ions leave one foil, cross a paper-thin gap, and wedge into the graphite. Electrons take the wire instead — that flow IS the charging current.',
      },
      {
        // Zone 4b — mirror: discharge, reinforce the loop
        step: 3,
        dolly: 1.8,
        caption: 'Discharge just runs it backward.',
        narration:
          'Now unplug it, and the whole thing runs backward — same ions, same electrons, now powering your screen. Nothing gets burned. Nothing gets used up.',
      },
      {
        // Zone 4c — BUT: the real cost, part 1 (SEI / staying full)
        step: 4,
        dolly: 1.8,
        caption: 'Parked at full, a film quietly builds.',
        narration:
          'But every crossing leaves a little residue. Parked near full charge, a film quietly thickens, eating away capacity.',
      },
      {
        // Zone 4d — the real cost, part 2 (fast/cold -> plating/dendrite)
        step: 5,
        dolly: 1.8,
        caption: 'Fast + cold charging plates metal instead.',
        narration:
          "Or charge it fast while it's cold, and metal plates out instead of slotting in clean — the exact crack that can short a cell.",
      },
      {
        // Zone 5 — the stat, isolated with a re-hook
        step: 6,
        dolly: 1.9,
        caption: '20-80% ≈ 3x the cycle life.',
        narration:
          "Here's the number that changes how I charge my phone: staying between 20 and 80 percent can take it from 500 cycles to fifteen hundred or more — roughly three times the life.",
      },
      {
        // Zone 6+7 — so-what, then the callback button (closes the loop)
        step: 7,
        dolly: 1.4,
        caption: 'The ions never wear out.',
        narration:
          "So the fix is free: skip the 100%, skip the overnight trickle, don't fast-charge it hot. The ions never wear out — where you park them is up to you.",
      },
    ],
  },

  // 16:9 — ~2:30. The full mechanism, one shot per step, room to breathe.
  long: {
    shots: [
      {
        // 1+2 pattern interrupt + curiosity hook
        step: 0,
        narration:
          "This is a battery. Despite what you've probably been told, nothing inside it gets burned or used up — it's not a fuel tank, it's a shuttle, moving the same ions back and forth.",
      },
      {
        // 3 question + reveal
        step: 1,
        narration:
          "So what's actually inside the can? Peel it open and it's one long sandwich, wound tight: an aluminum foil coated in layered lithium oxide — the cathode — a copper foil coated in graphite — the anode — and a porous separator between them, soaked in liquid electrolyte.",
      },
      {
        // 4 mechanism: charging
        step: 2,
        narration:
          "Plug in a charger, and lithium ions get pulled out of the cathode's layered lattice, cross the electrolyte, and wedge themselves between the graphite's layers — intercalation. Electrons can't make that crossing, so they take the wire instead, out through the external circuit and back in at the anode. That flow through the wire is the actual charging current.",
      },
      {
        // 5 mirror: discharge
        step: 3,
        narration:
          'Unplug it and the whole thing runs backward: ions drift back to the cathode, electrons flow the same direction through the circuit — only now that circuit is your phone, and those electrons are the power. Nothing was ever consumed, either way.',
      },
      {
        // 6 BUT: ageing part 1 — SEI + cathode stress
        step: 4,
        narration:
          'But every trip leaves residue. On the anode, a film called the SEI layer keeps thickening, quietly eating capacity. On the cathode, staying above roughly 4.1 volts — about 80 percent charged — puts real stress on the lattice and speeds up electrolyte breakdown. Neither is dramatic once. Parked at 100 percent every day, it adds up.',
      },
      {
        // 7 mind-blowing/danger moment: plating + dendrites
        step: 5,
        narration:
          "Charge too fast, or charge it cold, and ions arrive faster than they can slot in cleanly. Some plate out as metallic lithium instead — a reaction that never reverses. Enough of it grows into microscopic dendrites, and a dendrite that reaches the cathode side can punch through the separator and short the cell. That's the mechanism behind the battery-fire stories.",
      },
      {
        // 8 the stat, isolated
        step: 6,
        narration:
          'Here\'s the number that matters: cycle a cell between about 20 and 80 percent, and it barely visits the high-stress top of its voltage range. Do that instead of charging to 100, and you can take a battery from around 500 cycles to 1500 or more — roughly three times the working life, out of the same cell.',
      },
      {
        // 9 so-what + callback button
        step: 7,
        narration:
          "So the fix is nearly free: stop charging to 100 and leaving it there, and don't fast-charge it hot. The lithium ions never wear out. The lattice they're parked in does — and where you park it is up to you.",
      },
    ],
  },

  platforms: {
    youtube: {
      title: 'Charging to 100% Every Night Is Costing You 1,000 Battery Cycles',
      description:
        "Your phone's lithium-ion battery isn't a fuel tank — it's a reversible shuttle, moving the same lithium ions between two layered electrodes every time you charge and discharge. Nothing inside gets burned or used up... except the range you charge it in.\n\nCharging to 100% and leaving it there, or fast-charging while it's hot, drives real chemical damage: the SEI film thickening on the anode, structural stress on the cathode above roughly 4.1V, and lithium plating that can grow into cell-shorting dendrites. Staying roughly between 20% and 80% state of charge can take the same physical cell from around 500 full cycles to 1500 or more — roughly three times the working life.\n\nA fully procedural 3D breakdown of what's actually happening inside an 18650 lithium-ion cell, and the exact charging habits that age it fastest.",
      tags: [
        'lithium ion battery',
        'battery life',
        'phone battery',
        'battery degradation',
        'how batteries work',
        '18650 battery',
        'battery charging tips',
        'battery science',
        'electronics explained',
        '3d animation',
      ],
    },
    shorts: {
      title: "You're Losing 1,000 Battery Cycles",
      hashtags: ['#batterylife', '#lithiumion', '#phonebattery', '#howitworks', '#techtips', '#science'],
    },
  },
};
