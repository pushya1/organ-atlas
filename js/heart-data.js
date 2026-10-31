/* Content and heartbeat timing for the heart page.
   Plain script (not a module) so the page also works when index.html is opened straight from disk. */
window.HEART = (function () {
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const bump = (x, mu, sigma) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

  // One heartbeat is a phase from 0 to 1: atria squeeze, then ventricles squeeze, then everything relaxes and refills.
  const timing = { lub: 0.14, dub: 0.45 };

  function cycle(p) {
    const atria = p < 0.14 ? Math.sin((Math.PI * p) / 0.14) : 0;
    const ventricles = p >= 0.14 && p < 0.5 ? Math.pow(Math.sin((Math.PI * (p - 0.14)) / 0.36), 0.8) : 0;
    // Tricuspid + mitral (AV valves) shut while the ventricles squeeze; pulmonary + aortic open only during ejection.
    const avOpen = 1 - smooth(0.12, 0.16, p) + smooth(0.48, 0.56, p);
    const slOpen = smooth(0.18, 0.22, p) - smooth(0.43, 0.47, p);
    const phase = p < 0.14 ? 'atrial' : p < 0.47 ? 'ventricular' : 'diastole';
    return { p, atria, ventricles, avOpen, slOpen, phase };
  }

  // A stylised ECG trace: P wave, QRS spike, T wave.
  function ecg(p) {
    return (
      0.14 * bump(p, 0.06, 0.016) -
      0.1 * bump(p, 0.122, 0.006) +
      1.0 * bump(p, 0.138, 0.0065) -
      0.22 * bump(p, 0.155, 0.007) +
      0.28 * bump(p, 0.39, 0.032)
    );
  }

  const parts = {
    rightAtrium: {
      name: 'Right atrium',
      kind: 'chamber',
      blood: 'poor',
      tag: 'Receiving room for oxygen-poor blood',
      desc: 'The right atrium is the heart’s first waiting room. Blood that has already given its oxygen to your body flows in here through two big veins, the superior and inferior vena cava. When it is full, it squeezes and pushes the blood down through the tricuspid valve into the right ventricle.',
      fact: 'The heart’s natural pacemaker, the SA node, sits in the wall of the right atrium. It starts every single heartbeat.',
    },
    rightVentricle: {
      name: 'Right ventricle',
      kind: 'chamber',
      blood: 'poor',
      tag: 'The pump to the lungs',
      desc: 'The right ventricle pumps oxygen-poor blood up through the pulmonary valve into the pulmonary artery, which carries it to the lungs. The lungs are close by, so this pump doesn’t need to be very strong.',
      fact: 'Its wall is only about 3–5 mm thick, roughly a third as thick as the left ventricle’s.',
    },
    leftAtrium: {
      name: 'Left atrium',
      kind: 'chamber',
      blood: 'rich',
      tag: 'Receiving room for oxygen-rich blood',
      desc: 'Fresh, oxygen-rich blood coming back from the lungs enters the left atrium through four pulmonary veins. The left atrium then squeezes it through the mitral valve into the left ventricle.',
      fact: 'The left atrium sits at the back of the heart. Spin the model around to find it!',
    },
    leftVentricle: {
      name: 'Left ventricle',
      kind: 'chamber',
      blood: 'rich',
      tag: 'The powerhouse',
      desc: 'The left ventricle is the strongest chamber. It pumps oxygen-rich blood through the aortic valve into the aorta, and from there to every part of your body, from your brain to your toes.',
      fact: 'Its thick muscular wall (about 1–1.5 cm) makes enough pressure to push blood through roughly 100,000 km of blood vessels.',
    },
    aorta: {
      name: 'Aorta',
      kind: 'vessel',
      blood: 'rich',
      tag: 'The biggest artery in your body',
      desc: 'The aorta carries oxygen-rich blood away from the left ventricle. Its first branches go up to your head and arms, then it curves over (the aortic arch) and runs down to supply the rest of your body.',
      fact: 'It is about as wide as a garden hose, and blood can rush through it at up to about 1 metre per second.',
    },
    pulmonaryArtery: {
      name: 'Pulmonary artery',
      kind: 'vessel',
      blood: 'poor',
      tag: 'The road to the lungs',
      desc: 'The pulmonary artery leaves the right ventricle and splits into two branches, one for each lung. It carries oxygen-poor blood to the lungs to pick up fresh oxygen.',
      fact: 'It is the only artery that carries oxygen-poor blood. Arteries carry blood away from the heart, not always oxygen-rich blood!',
    },
    superiorVenaCava: {
      name: 'Superior vena cava',
      kind: 'vessel',
      blood: 'poor',
      tag: 'Return route from the upper body',
      desc: 'This large vein brings oxygen-poor blood back from your head, neck and arms into the right atrium.',
      fact: '“Vena cava” is Latin for “hollow vein”.',
    },
    inferiorVenaCava: {
      name: 'Inferior vena cava',
      kind: 'vessel',
      blood: 'poor',
      tag: 'Return route from the lower body',
      desc: 'This vein brings oxygen-poor blood back from your legs, tummy and lower body into the right atrium.',
      fact: 'It is the largest vein in the human body.',
    },
    pulmonaryVeins: {
      name: 'Pulmonary veins',
      kind: 'vessel',
      blood: 'rich',
      tag: 'Fresh blood from the lungs',
      desc: 'Four pulmonary veins, two from each lung, bring oxygen-rich blood back to the left atrium.',
      fact: 'They are the only veins in your body that carry oxygen-rich blood.',
    },
    coronary: {
      name: 'Coronary arteries',
      kind: 'muscle',
      blood: 'rich',
      tag: 'The heart’s own blood supply',
      desc: 'The heart muscle needs oxygen too! The coronary arteries branch off the aorta and wrap around the outside of the heart to feed the muscle itself.',
      fact: 'If one of these arteries gets blocked, part of the heart muscle is starved of oxygen. That is a heart attack.',
    },
    tricuspidValve: {
      name: 'Tricuspid valve',
      kind: 'valve',
      blood: 'poor',
      tag: 'Door between the right atrium and right ventricle',
      desc: 'Three flaps that open to let blood into the right ventricle, then snap shut when the ventricle squeezes so blood can’t flow backwards.',
      fact: '“Tri” means three: it has three flaps, called cusps. Its closing is part of the “LUB” sound.',
    },
    pulmonaryValve: {
      name: 'Pulmonary valve',
      kind: 'valve',
      blood: 'poor',
      tag: 'Exit door to the lungs',
      desc: 'Opens when the right ventricle squeezes, letting blood into the pulmonary artery, then closes so it can’t fall back into the heart.',
      fact: 'Its closing is part of the “DUB” sound.',
    },
    mitralValve: {
      name: 'Mitral valve',
      kind: 'valve',
      blood: 'rich',
      tag: 'Door between the left atrium and left ventricle',
      desc: 'Two flaps that let oxygen-rich blood into the left ventricle and then seal shut while the ventricle pumps.',
      fact: 'It is named after a bishop’s pointed hat, called a mitre, because of its shape.',
    },
    aorticValve: {
      name: 'Aortic valve',
      kind: 'valve',
      blood: 'rich',
      tag: 'Exit door to the body',
      desc: 'Three flaps between the left ventricle and the aorta. They burst open when the ventricle squeezes and close tight when it relaxes.',
      fact: 'It opens and closes about 100,000 times a day.',
    },
  };

  const phases = {
    atrial: {
      name: 'Atria squeeze',
      short: 'Atrial systole',
      text: 'The two top chambers (atria) contract and top up the ventricles below. The tricuspid and mitral valves are open.',
    },
    ventricular: {
      name: 'Ventricles pump',
      short: 'Ventricular systole',
      text: 'The big bottom chambers squeeze hard. The tricuspid and mitral valves snap shut (LUB!) and blood is pushed into the pulmonary artery and aorta. As the squeeze ends, the pulmonary and aortic valves shut (DUB!).',
    },
    diastole: {
      name: 'Relax & refill',
      short: 'Diastole',
      text: 'The whole heart relaxes. Blood flows in from the veins and fills the chambers, ready for the next beat. This is the longest part of every heartbeat.',
    },
  };

  const journey = [
    {
      place: 'Vena cava',
      title: 'Back from the body',
      blood: 'poor',
      parts: ['superiorVenaCava', 'inferiorVenaCava'],
      text: 'Blood that has delivered its oxygen returns to the heart through two big veins: the superior vena cava (from the upper body) and the inferior vena cava (from the lower body).',
    },
    {
      place: 'Right atrium',
      title: 'Into the right atrium',
      blood: 'poor',
      parts: ['rightAtrium', 'tricuspidValve'],
      text: 'The blood collects in the right atrium. When the atrium squeezes, it pushes the blood through the tricuspid valve into the right ventricle.',
    },
    {
      place: 'Right ventricle',
      title: 'Pumped toward the lungs',
      blood: 'poor',
      parts: ['rightVentricle', 'pulmonaryValve'],
      text: 'The right ventricle contracts. The tricuspid valve shuts so blood can’t go backwards, and the blood is forced out through the pulmonary valve.',
    },
    {
      place: 'Pulmonary artery',
      title: 'Off to the lungs',
      blood: 'poor',
      parts: ['pulmonaryArtery'],
      text: 'The pulmonary artery splits in two and carries the blood to the right and left lungs.',
    },
    {
      place: 'Lungs',
      title: 'The big swap',
      blood: 'swap',
      parts: [],
      text: 'In millions of tiny air sacs called alveoli, the blood drops off carbon dioxide (which you breathe out) and picks up fresh oxygen (which you breathed in). It turns bright red!',
    },
    {
      place: 'Pulmonary veins → left atrium',
      title: 'Back to the heart',
      blood: 'rich',
      parts: ['pulmonaryVeins', 'leftAtrium', 'mitralValve'],
      text: 'Oxygen-rich blood returns through the pulmonary veins into the left atrium, which squeezes it through the mitral valve.',
    },
    {
      place: 'Left ventricle',
      title: 'The big squeeze',
      blood: 'rich',
      parts: ['leftVentricle', 'aorticValve'],
      text: 'The powerful left ventricle contracts. The mitral valve shuts and the blood bursts out through the aortic valve.',
    },
    {
      place: 'Aorta',
      title: 'Out to the whole body',
      blood: 'rich',
      parts: ['aorta'],
      text: 'The aorta arches over the heart and sends blood up to the head and arms, and down to the rest of the body.',
    },
    {
      place: 'Body',
      title: 'Delivering oxygen',
      blood: 'swap',
      parts: [],
      text: 'Arteries branch into tiny capillaries where oxygen and food pass into your cells and carbon dioxide is collected. Then the trip starts again. The whole loop takes only about a minute!',
    },
  ];

  const quiz = [
    {
      q: 'Which chamber pumps blood to the whole body?',
      options: ['Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle'],
      answer: 3,
      why: 'The left ventricle has the thickest, strongest wall because it has to push blood all the way around your body.',
    },
    {
      q: 'Where does blood go to pick up oxygen?',
      options: ['The liver', 'The lungs', 'The stomach', 'The brain'],
      answer: 1,
      why: 'The right side of the heart sends blood to the lungs, where it swaps carbon dioxide for oxygen.',
    },
    {
      q: 'What is the job of the heart valves?',
      options: ['To make blood red', 'To store oxygen', 'To stop blood flowing backwards', 'To start each heartbeat'],
      answer: 2,
      why: 'Valves are one-way doors. They open to let blood through and shut to stop it leaking back.',
    },
    {
      q: 'What makes the “lub-dub” sound of a heartbeat?',
      options: ['Blood hitting the ribs', 'Valves snapping shut', 'The lungs breathing', 'Muscles stretching'],
      answer: 1,
      why: 'LUB is the tricuspid and mitral valves closing; DUB is the pulmonary and aortic valves closing.',
    },
    {
      q: 'Which blood vessel is the largest artery in the body?',
      options: ['Vena cava', 'Pulmonary vein', 'Aorta', 'Capillary'],
      answer: 2,
      why: 'The aorta carries oxygen-rich blood out of the left ventricle to the whole body.',
    },
    {
      q: 'Where does each heartbeat start?',
      options: ['In the brain', 'In the SA node in the right atrium', 'In the aorta', 'In the left ventricle'],
      answer: 1,
      why: 'The SA node is the heart’s natural pacemaker. It fires an electrical signal that spreads through the heart.',
    },
    {
      q: 'The pulmonary artery carries…',
      options: ['Oxygen-rich blood to the body', 'Oxygen-poor blood to the lungs', 'Oxygen-rich blood to the lungs', 'Food to the stomach'],
      answer: 1,
      why: 'It is the only artery carrying oxygen-poor blood. Arteries are defined by going away from the heart.',
    },
  ];

  const activities = {
    55: { label: 'Sleeping', text: 'While you sleep your body needs less oxygen, so your heart slows down and rests a little.' },
    72: { label: 'Resting', text: 'A typical resting heart rate is 60–100 beats per minute (children often a bit faster).' },
    100: { label: 'Walking', text: 'Your leg muscles are working, so they need more oxygen. The heart beats faster to deliver it.' },
    150: { label: 'Running', text: 'Hard exercise can more than double your heart rate. Each beat also pumps more blood. Regular exercise makes your heart stronger!' },
  };

  return { timing, cycle, ecg, parts, phases, journey, quiz, activities };
})();
