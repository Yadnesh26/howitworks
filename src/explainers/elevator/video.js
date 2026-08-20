// Editorial layer for video export (scripts/export-video.mjs). Short-form
// only for now — see export-content's SKILL.md for the pipeline.
//
// SCRIPTING: one flowing voiceover, not a stack of standalone facts.
// make-narration.mjs synthesizes the whole thing in a single ElevenLabs take
// and the exporter paces the picture to the audio, so lines connect the way a
// real narrator connects them. 8-beat arc: pattern interrupt -> stakes ->
// spoken question -> reveal -> mechanism (BUT/THEREFORE) -> isolated stat ->
// so-what -> callback button.
//
// LOOP: "something... is falling beside you" (shot 1) closes in the button —
// "a weight that falls so you don't" — and "nobody lowered it, nothing's tied
// off" closes as "no winch, no knot."
export default {
  hook: 'Something almost exactly your weight\nis falling right now, beside you.',

  short: {
    shots: [
      {
        // Zone 1+2 — hook + stakes: the counterweight, before it's named
        step: 1,
        dolly: 1.5,
        labels: ['Elevator car', 'Counterweight'],
        narration:
          'Something almost exactly your weight is falling on the other side of that rope, right now. Nobody lowered it, and nothing underneath you is tied off. It’s just hanging there, doing most of the work.',
      },
      {
        // Zone 3 — the spoken question
        step: 1,
        dolly: 1.5,
        narration:
          'So if nothing’s winding you up, and nothing’s tied off below you, what’s actually holding you up?',
      },
      {
        // Zone 4a — reveal: name the sheave and the rope path
        step: 2,
        dolly: 1.3,
        labels: ['Traction sheave'],
        narration:
          'It’s this wheel. Five steel ropes run from the car, over its grooves, down to that falling weight, the counterweight. The wheel never winds the rope in. It just grips it.',
      },
      {
        // Zone 4b — the analogy that explains the grip
        step: 2,
        dolly: 1.3,
        narration:
          'Grips it the way a climber’s belay device grips a line: pure friction, in a groove, nothing wound or knotted anywhere.',
      },
      {
        // Zone 4c — THEREFORE: why the motor barely works
        step: 3,
        dolly: 1.35,
        labels: ['Counterweight frame', 'Steel filler slabs'],
        narration:
          'Because that counterweight is built to match you almost exactly, the motor barely works either direction. It’s only ever fighting the small difference between the two of you.',
      },
      {
        // Zone 5 — BUT + the isolated stat, re-hooked
        step: 5,
        dolly: 1.5,
        labels: ['Overspeed governor', 'Safety wedge'],
        narration:
          'But if that grip ever let go, here’s the part that gets me: the brake never checks the rope. It checks your speed. Cross about a hundred and fifteen percent of normal, and steel wedges lock onto the rails in a fraction of a second.',
      },
      {
        // Zone 6+7 — so-what, then the callback button (closes the loop)
        step: 7,
        dolly: 1.6,
        narration:
          'So a free-falling elevator is basically a myth: the machine catches it before you’d even feel the drop. No winch, no knot, just friction, and a weight that falls so you don’t.',
      },
    ],
  },
};
