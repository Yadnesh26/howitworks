// Article content for the prerendered page — see docs/seo-plan.md §C1 and
// .claude/skills/write-article/SKILL.md. This explainer's step copy is
// already the richest in the library numerically (spring rate, travel,
// damper force, anti-roll bar stiffness) — parts/numbers below mostly
// synthesize that existing, already-accurate copy. The wear-symptom and
// safety content in faq/failureModes IS new research, sourced from
// automotive-repair and suspension-engineering references, not from this
// explainer's own text.
export default {
  directAnswer: {
    question: 'How does car suspension work?',
    answer:
      'Car suspension works in two stages: a spring absorbs a bump by turning a sharp jolt into a slow squeeze, then a shock absorber bleeds that stored energy away as heat by forcing oil through small holes — because a spring alone would just bounce forever. A third part, the anti-roll bar, only engages when the two sides of the car disagree, keeping the body flat in corners.',
  },

  parts: [
    { name: 'MacPherson strut', body: 'A single tube that combines the spring and shock absorber into one unit, bolted rigidly to the steering knuckle and hinged into the body at one mount. Skipping the upper control arm this design needs is why it sits under almost every front wheel on the road — the space it frees up is where the engine goes.' },
    { name: 'Coil spring', body: 'The part that actually absorbs a bump — not by resisting it, but by converting a sharp shove into a slow squeeze spread across tens of millimetres of travel.' },
    { name: 'Shock absorber (damper)', body: 'An oil-filled cylinder with a valved piston inside it. Every hole in that piston is a doorway the oil must squeeze through, and that resistance is what stops the spring from bouncing forever.' },
    { name: 'Lower control arm', body: 'Swings on two rubber bushings and catches the bottom of the steering knuckle at a ball joint — the main link holding the wheel in position relative to the body.' },
    { name: 'Ball joint', body: 'The pivot connecting the control arm to the knuckle. It has to let the wheel steer and travel up and down at the same time, which is exactly why it wears.' },
    { name: 'Anti-roll bar (sway bar)', body: 'A bar running across the car that only twists when the two sides move differently — over an ordinary bump that lifts both wheels together, it just rotates freely in its bushings and does nothing.' },
    { name: 'Bump stop', body: 'A firm rubber or polyurethane cushion inside the strut that only makes contact right at the end of travel, softening a full-compression hit instead of leaving the suspension to crash metal-on-metal into its own limit.' },
  ],

  numbers: [
    { label: 'Coil spring rate', value: '~30 N/mm', note: '~24 N/mm as felt at the wheel, since the wheel sits further out along the arm than the spring' },
    { label: 'Spring travel', value: '~80 mm', note: 'the range a single bump gets spread across instead of arriving all at once' },
    { label: 'Body bounce frequency', value: '~1.4 Hz', note: 'close to the rhythm of an unhurried walking stride' },
    { label: 'Damper compression force', value: '800–1,500 N', note: 'climbs with the SPEED of the hit, not how far the suspension travels' },
    { label: 'Damper rebound force', value: '2–3× compression', note: 'rebound is deliberately harder — the spring isn’t helping on the way back up' },
    { label: 'Anti-roll bar diameter', value: '22 mm', note: 'stiffness scales with the 4th power of diameter — 22→26 mm nearly doubles it' },
    { label: 'Unsprung mass (per corner)', value: '~40 kg', note: 'wheel, hub, brake and arm — everything the spring isn’t supporting against inertia' },
  ],

  faq: [
    {
      q: 'How can you tell if your shocks are worn out?',
      a: 'Push down hard on one corner of the car and let go. A healthy shock lets the body bounce back up once, maybe settle with a half-bounce, then hold steady. If it keeps bouncing, the shock is too weak to control the spring anymore. Test all four corners — wear is rarely even across the car.',
    },
    {
      q: 'What does "unsprung mass" actually mean, and why does it matter?',
      a: 'It’s everything the spring doesn’t get to support against inertia between bumps — the wheel, hub, brake and control arm, roughly 40 kg per corner. The lighter that mass, the faster the wheel can follow the road surface instead of skipping over it, which is why keeping it down matters as much to grip as it does to ride comfort.',
    },
    {
      q: 'Why does a stiffer anti-roll bar make cornering feel flatter?',
      a: 'Because the bar resists twisting harder when the two sides disagree, which is exactly what happens as the body leans into a corner. The tradeoff is real, though: push a bar too stiff and it can unload the inside wheel enough in hard cornering to actually cost grip at that end of the car, which is why front/rear roll stiffness is tuned as a pair, not maximized independently.',
    },
    {
      q: 'Why does the damper respond differently to a slow dip than a sharp bump?',
      a: 'Because forcing oil through a small hole takes a force that climbs with speed, not distance. Ease over a gentle dip and the oil has time to get through — barely any resistance. Hit a sharp ridge and the same holes have to pass the same oil much faster, so the force spikes hard in response.',
    },
    {
      q: 'Why is a worn ball joint dangerous rather than just noisy?',
      a: 'Because it’s a structural connection, not just a wear item. A ball joint that fails completely lets the control arm disconnect from the steering knuckle entirely — the wheel can drop and collapse into the wheel well while the car is moving, which is why any looseness or clicking there is worth acting on immediately rather than waiting.',
    },
  ],

  failureModes: [
    {
      q: 'What does a clunk from the suspension usually mean?',
      a: 'It depends on where and when. A metallic clunk over bumps, especially while turning, usually points to a worn anti-roll-bar link — loosened joints letting the link rattle. A duller thud or creak points to worn control-arm bushings. A sharp metallic click or pop while steering, or a feeling of looseness in the front end, points to a ball joint.',
    },
    {
      q: 'What happens if a ball joint fails completely while driving?',
      a: 'The control arm disconnects from the steering knuckle, and that corner of the car loses its structural link to the wheel — it can drop and collapse into the wheel well. It’s one of the few suspension failures that’s a genuine safety event rather than just a ride-quality complaint.',
    },
    {
      q: 'How do you know a shock absorber has actually failed, versus just feeling old?',
      a: 'Beyond the bounce test: watch for brake dive (the nose dropping hard under braking), acceleration squat, or noticeably more body roll in corners than the car used to have — all signs the shock isn’t controlling weight transfer anymore. Visible oil leaking down the shock body, or a metal-on-metal clunk when it bottoms out on a bump, both mean it has already failed.',
    },
  ],
};
