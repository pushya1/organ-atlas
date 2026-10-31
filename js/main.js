/* Page wiring: builds the content from heart-data.js, runs the heartbeat clock, the ECG monitor,
   sound, and every interactive piece. The 3D scene plugs in once Three.js has loaded. */
(function () {
  const H = window.HEART;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const state = { bpm: 72, playing: true, phase: 0.6, sound: false, electric: false };
  let scene = null;

  const BLOOD_LABEL = { poor: 'Oxygen-poor blood', rich: 'Oxygen-rich blood', swap: 'Gas swap' };

  // ---------- content ----------
  $('#chamberGrid').innerHTML = ['rightAtrium', 'leftAtrium', 'rightVentricle', 'leftVentricle']
    .map((key) => {
      const p = H.parts[key];
      return `<article class="chamber-card panel reveal blood-${p.blood}">
        <span class="tag">${p.tag}</span>
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <p class="fact"><b>Fun fact:</b> ${p.fact}</p>
        <button class="link-btn" data-show="${key}">Show me in 3D →</button>
      </article>`;
    })
    .join('');

  $('#partChips').innerHTML = Object.entries(H.parts)
    .filter(([, p]) => p.kind !== 'chamber')
    .map(([key, p]) => `<button class="chip blood-${p.blood}" data-show="${key}"><i></i>${p.name}</button>`)
    .join('');

  $('#journeyList').innerHTML = H.journey
    .map(
      (s, i) => `<li class="step blood-${s.blood}" data-step="${i}">
        <span class="num">${i + 1}</span>
        <div><p class="place">${s.place}</p><h3>${s.title}</h3><p>${s.text}</p></div>
      </li>`
    )
    .join('');

  $('#phaseCards').innerHTML = Object.entries(H.phases)
    .map(([key, ph], i) => `<div class="phase-card panel reveal" data-phase="${key}">
        <span class="num">${i + 1}</span><p class="eyebrow">${ph.short}</p><h3>${ph.name}</h3><p>${ph.text}</p>
      </div>`)
    .join('');

  $('#rideDots').innerHTML = H.journey.map(() => '<i></i>').join('');

  // ---------- quiz ----------
  let score = 0;
  let answered = 0;
  $('#quizList').innerHTML = H.quiz
    .map(
      (q, i) => `<div class="quiz-q panel reveal" data-q="${i}">
        <h3><span>${i + 1}.</span> ${q.q}</h3>
        <div class="options">${q.options.map((o, j) => `<button data-a="${j}">${o}</button>`).join('')}</div>
        <p class="why" hidden></p>
      </div>`
    )
    .join('');
  $('#quizList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-a]');
    if (!btn) return;
    const box = btn.closest('.quiz-q');
    if (box.classList.contains('done')) return;
    const q = H.quiz[box.dataset.q];
    const right = Number(btn.dataset.a) === q.answer;
    box.classList.add('done');
    btn.classList.add(right ? 'right' : 'wrong');
    $$('button', box)[q.answer].classList.add('right');
    const why = $('.why', box);
    why.hidden = false;
    why.textContent = (right ? '✅ Correct! ' : '❌ Not quite. ') + q.why;
    answered++;
    if (right) score++;
    $('#quizScore').textContent = `${score} / ${answered}` + (answered === H.quiz.length ? (score === answered ? ' 🏆 Perfect!' : ' 🎉 Well done!') : '');
  });

  // ---------- ECG monitor (sweeping trace like a hospital monitor) ----------
  class EcgMonitor {
    constructor(canvas, seconds, color) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.seconds = seconds;
      this.color = color;
      new ResizeObserver(() => this.resize()).observe(canvas);
      this.resize();
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      this.w = r.width;
      this.h = r.height;
      this.canvas.width = Math.max(1, r.width * dpr);
      this.canvas.height = Math.max(1, r.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.x = 0;
      this.y = null;
    }
    level(p) {
      return this.h * (0.66 - 0.52 * H.ecg(p));
    }
    // Draws in small sub-steps so the narrow QRS spike is never skipped.
    push(p0, dp, dt) {
      if (!this.w) return;
      const ctx = this.ctx;
      const dx = (dt * this.w) / this.seconds;
      const gap = 18;
      ctx.clearRect(this.x + 1, 0, dx + gap, this.h);
      if (this.x + dx + gap > this.w) ctx.clearRect(0, 0, this.x + dx + gap - this.w, this.h);
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      if (this.y !== null) ctx.moveTo(this.x, this.y);
      const steps = Math.max(1, Math.ceil(dx));
      for (let i = 1; i <= steps; i++) {
        let x = this.x + dx / steps;
        const y = this.level((p0 + (dp * i) / steps) % 1);
        if (x > this.w) {
          ctx.stroke();
          ctx.beginPath();
          x = 0;
          ctx.moveTo(x, y);
        } else if (this.y === null) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        this.x = x;
        this.y = y;
      }
      ctx.stroke();
    }
  }
  const ecgBig = new EcgMonitor($('#ecgBig'), 4, '#5dffa8');

  // ---------- sound ----------
  let audio = null;
  function thump(kind) {
    const word = $('#beatWord2');
    word.textContent = kind === 'lub' ? 'LUB' : 'DUB';
    word.classList.remove('pop');
    void word.offsetWidth;
    word.classList.add('pop');
    if (!state.sound) return;
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const lub = kind === 'lub';
    for (const [mult, vol] of [[1, 1], [2.1, 0.35]]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = mult === 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime((lub ? 68 : 92) * mult, t);
      osc.frequency.exponentialRampToValueAtTime((lub ? 40 : 55) * mult, t + 0.13);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime((lub ? 0.9 : 0.6) * vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (lub ? 0.17 : 0.12));
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  function setSound(on) {
    state.sound = on;
    if (on) {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
    }
    for (const b of [$('#soundToggle'), $('#soundToggle2')]) {
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    }
    $('#soundToggle').innerHTML = (on ? '🔊' : '🔈') + '<span class="txt"> Sound</span>';
    $('#soundToggle2').textContent = on ? '🔊 Heartbeat sound is on' : '🔈 Turn on heartbeat sound';
  }
  $('#soundToggle').addEventListener('click', () => setSound(!state.sound));
  $('#soundToggle2').addEventListener('click', () => setSound(!state.sound));

  // ---------- controls ----------
  function setBpm(bpm) {
    state.bpm = bpm;
    $('#bpm').value = bpm;
    for (const id of ['#bpmReadout', '#bpmReadout2', '#activityBpm']) $(id).textContent = bpm;
    $$('#activityBtns button').forEach((b) => b.classList.toggle('active', Number(b.dataset.bpm) === bpm));
    const nearest = Object.keys(H.activities).reduce((a, b) => (Math.abs(b - bpm) < Math.abs(a - bpm) ? b : a));
    $('#activityText').textContent = H.activities[nearest].text;
  }
  $('#bpm').addEventListener('input', (e) => setBpm(Number(e.target.value)));
  $('#activityBtns').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-bpm]');
    if (b) setBpm(Number(b.dataset.bpm));
  });

  $('#playBtn').addEventListener('click', () => {
    state.playing = !state.playing;
    $('#playBtn').textContent = state.playing ? '❚❚' : '▶';
    $('#playBtn').setAttribute('aria-label', state.playing ? 'Pause heartbeat' : 'Play heartbeat');
  });

  function setMode(mode) {
    $$('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    scene?.setMode(mode);
  }
  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  function setElectric(on) {
    state.electric = on;
    $('#electricToggle').classList.toggle('active', on);
    $('#electricToggle').setAttribute('aria-pressed', on);
    scene?.setElectric(on);
  }
  $('#electricToggle').addEventListener('click', () => setElectric(!state.electric));
  $('#electricBtn2').addEventListener('click', () => {
    setElectric(true);
    if (state.bpm > 60) setBpm(48); // slow it down so the spark is easy to follow
    scrollToViewer();
  });

  function scrollToViewer() {
    $('#top').scrollIntoView({ behavior: 'smooth' });
  }

  // "Show me in 3D" buttons and chips anywhere on the page.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-show]');
    if (!b || !scene) return;
    const key = b.dataset.show;
    if (H.parts[key].kind === 'valve') setMode('flow');
    scrollToViewer();
    scene.select(key);
    scene.focus(key);
  });

  // ---------- part info card ----------
  function showPart(key) {
    const card = $('#partCard');
    if (!key) {
      card.hidden = true;
      return;
    }
    const p = H.parts[key];
    $('#partName').textContent = p.name;
    $('#partTag').textContent = p.tag;
    $('#partDesc').textContent = p.desc;
    $('#partFact').innerHTML = `<b>Fun fact:</b> ${p.fact}`;
    const badge = $('#partBadge');
    badge.textContent = p.kind === 'muscle' ? 'Feeds the heart muscle' : BLOOD_LABEL[p.blood];
    badge.className = 'blood-badge blood-' + p.blood;
    card.hidden = false;
  }
  $('#partClose').addEventListener('click', () => scene?.select(null));

  // On phones the info card and tour steps start compact (title only) so they never crowd the heart.
  $$('.more-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      const open = btn.closest('.panel').classList.toggle('expanded');
      btn.setAttribute('aria-expanded', open);
      btn.textContent = open ? 'Show less ▴' : 'Read more ▾';
    })
  );

  // ---------- follow a blood cell ----------
  function setRiding(on) {
    if (!scene) return;
    if (on) {
      scene.select(null);
      setMode('flow');
      scene.startRide();
      scrollToViewer();
    } else scene.stopRide();
    $('#rideBtn').innerHTML = on
      ? '■ <span class="txt-long">Stop the tour</span><span class="txt-short">Stop tour</span>'
      : '▶ <span class="txt-long">Follow a blood cell</span><span class="txt-short">Blood cell tour</span>';
    $('#rideBtn').classList.toggle('active', on);
    $('#rideCaption').hidden = !on;
  }
  $('#rideBtn').addEventListener('click', () => setRiding(!scene?.riding));
  $('#rideBtn2').addEventListener('click', () => setRiding(true));

  function showRideStep(i) {
    const s = H.journey[i];
    $('#rideStepNo').textContent = `Step ${i + 1} of ${H.journey.length} · ${s.place}`;
    $('#rideTitle').textContent = s.title;
    $('#rideText').textContent = s.text;
    $('#rideCaption').classList.remove('blood-poor', 'blood-rich', 'blood-swap');
    $('#rideCaption').classList.add('blood-' + s.blood);
    $$('#rideDots i').forEach((d, j) => d.classList.toggle('on', j <= i));
    $$('#journeyList .step').forEach((li, j) => li.classList.toggle('active', j === i));
  }

  // Clicking a journey step highlights those parts in the 3D view.
  $('#journeyList').addEventListener('click', (e) => {
    const li = e.target.closest('.step');
    if (!li || !scene) return;
    const s = H.journey[li.dataset.step];
    $$('#journeyList .step').forEach((x) => x.classList.toggle('active', x === li));
    if (!s.parts.length) return;
    if (scene.riding) setRiding(false);
    setMode('flow');
    scene.select(s.parts[0]);
    scene.highlight(s.parts);
    scene.focus(s.parts[0]);
    scrollToViewer();
  });

  // ---------- pulse tapper ----------
  const taps = [];
  let tappedBpm = null;
  $('#tapBtn').addEventListener('click', () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2500) taps.length = 0;
    taps.push(now);
    if (taps.length > 10) taps.shift();
    const btn = $('#tapBtn');
    btn.classList.remove('beat');
    void btn.offsetWidth;
    btn.classList.add('beat');
    if (taps.length < 5) {
      $('#tapResult').textContent = taps.length === 1 ? 'Keep going…' : `Keep going… (${taps.length}/5)`;
      return;
    }
    const gaps = taps.slice(1).map((t, i) => t - taps[i]).sort((a, b) => a - b);
    tappedBpm = Math.round(60000 / gaps[Math.floor(gaps.length / 2)]);
    const verdict = tappedBpm < 50 ? 'That’s quite slow. Did you miss a beat?' : tappedBpm > 130 ? 'That’s fast! Have you been running?' : 'That’s a healthy-looking rate.';
    $('#tapResult').innerHTML = `Your heart rate: <b>${tappedBpm}</b> BPM. ${verdict}`;
    $('#useTap').disabled = false;
  });
  $('#useTap').addEventListener('click', () => {
    if (!tappedBpm) return;
    setBpm(Math.min(180, Math.max(40, tappedBpm)));
    scrollToViewer();
  });

  // ---------- counters & reveal on scroll ----------
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('in');
        if (en.target.dataset.count) countUp(en.target);
        io.unobserve(en.target);
      }
    },
    { threshold: 0.15 }
  );
  $$('.reveal, [data-count]').forEach((el) => io.observe(el));

  function countUp(el) {
    const target = Number(el.dataset.count);
    const pre = el.dataset.prefix || '';
    const suf = el.dataset.suffix || '';
    const start = performance.now();
    (function tick(now) {
      const k = Math.min(1, (now - start) / 1500);
      el.textContent = pre + Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString() + suf;
      if (k < 1) requestAnimationFrame(tick);
    })(start);
  }

  const pageStart = performance.now();
  setInterval(() => {
    $('#yourBeats').textContent = Math.floor(((performance.now() - pageStart) / 1000) * 1.25).toLocaleString();
  }, 400);

  // ---------- heartbeat clock & main loop ----------
  const crossed = (p0, dp, mark) => (p0 < mark && p0 + dp >= mark) || (p0 < mark + 1 && p0 + dp >= mark + 1);
  let lastPhase = null;

  function updatePhaseUI(cyc) {
    if (cyc.phase !== lastPhase) {
      lastPhase = cyc.phase;
      const name = H.phases[cyc.phase].name;
      $('#phaseName2').textContent = name;
      $$('[data-phase]').forEach((c) => c.classList.toggle('active', c.dataset.phase === cyc.phase));
      document.body.dataset.phase = cyc.phase;
    }
    $$('[data-valve]').forEach((v) => {
      const open = (v.dataset.valve === 'av' ? cyc.avOpen : cyc.slOpen) > 0.5;
      v.classList.toggle('open', open);
      $('b', v).textContent = open ? 'OPEN' : 'SHUT';
    });
    const squeeze = Math.max(cyc.ventricles, cyc.atria * 0.5);
    $('#activityHeart').style.transform = `scale(${1 + 0.18 * squeeze})`;
    $('#miniHeart').style.transform = `scale(${1 + 0.25 * squeeze})`;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p0 = state.phase;
    const dp = state.playing ? (dt * state.bpm) / 60 : 0;
    if (state.playing) {
      if (crossed(p0, dp, H.timing.lub)) thump('lub');
      if (crossed(p0, dp, H.timing.dub)) thump('dub');
      state.phase += dp;
      if (state.phase >= 1) state.phase -= 1;
      ecgBig.push(p0, dp, dt);
    }
    const cyc = H.cycle(state.phase);
    updatePhaseUI(cyc);
    if (scene) scene.update(dt, cyc, state);
    requestAnimationFrame(frame);
  }
  setBpm(72);
  requestAnimationFrame(frame);

  // ---------- 3D scene ----------
  function startScene() {
    if (scene || !window.__three) return;
    try {
      scene = window.createHeartScene(window.__three, $('#scene'));
    } catch (err) {
      console.error(err);
      $('#loadingText').textContent = 'Sorry, the 3D heart could not start on this device. The rest of the page still works!';
      return;
    }
    scene.on('select', showPart);
    scene.on('rideStep', showRideStep);
    scene.on('rideEnd', () => $$('#journeyList .step').forEach((li) => li.classList.remove('active')));
    scene.setElectric(state.electric);
    $('#zoomIn').addEventListener('click', () => scene.zoom(0.8));
    $('#zoomOut').addEventListener('click', () => scene.zoom(1.25));
    $('#resetView').addEventListener('click', () => scene.resetView());
    $('#top').classList.add('ready');
  }
  window.addEventListener('three-ready', startScene);
  startScene();
  setTimeout(() => {
    if (!scene) $('#loadingText').textContent = 'The 3D heart needs an internet connection to load. You can still scroll down and learn!';
  }, 12000);
})();
