/* Approved 7–0 celebration. Independent of the game's physics and scoring. */
(() => {
  'use strict';
  const DURATION = 18, overlay = document.getElementById('overlay');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const files = ['assets/audio/carney-perfect-fanfare.mp3', 'assets/audio/trump-perfect-fanfare.mp3'];
  const bytes = [], buffers = [];
  let run = null, source = null, audioContext = null, sound = false;
  let frameId = 0, timerId = 0, generation = 0, audioAttempt = 0;
  const canvas = document.createElement('canvas');
  canvas.className = 'perfect-fireworks'; canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true; overlay.prepend(canvas);
  const ctx = canvas.getContext('2d');
  function load(side) {
    if (!bytes[side]) bytes[side] = fetch(files[side]).then(response => {
      if (!response.ok) throw new Error('Anthem unavailable');
      return response.arrayBuffer();
    }).catch(() => { bytes[side] = null; return null; });
    return bytes[side];
  }
  function warm() { load(0); load(1); }
  document.addEventListener('pointerdown', warm, {once:true, passive:true});
  document.addEventListener('keydown', warm, {once:true});
  function silence() {
    audioAttempt++;
    if (source) { try { source.stop(); } catch {} source.disconnect(); source = null; }
  }
  async function playMusic() {
    silence();
    if (!run || !sound || !audioContext || document.hidden) return;
    const attempt = audioAttempt, token = generation, side = run.side;
    try {
      // Resume is requested synchronously when the player enables sound.
      if (audioContext.state === 'suspended') await audioContext.resume();
      const data = await load(side);
      if (!data) return;
      if (!buffers[side]) buffers[side] = await audioContext.decodeAudioData(data.slice(0));
      if (token !== generation || attempt !== audioAttempt || !run || !sound || document.hidden) return;
      const offset = (performance.now() - run.started) / 1000;
      if (offset >= Math.min(DURATION, buffers[side].duration)) return;
      source = audioContext.createBufferSource(); source.buffer = buffers[side];
      source.connect(audioContext.destination); source.start(0, Math.max(0, offset));
    } catch { /* A blocked or missing audio file must never interrupt the match. */ }
  }
  function clearEffects() {
    cancelAnimationFrame(frameId); frameId = 0;
    ctx?.clearRect(0, 0, canvas.width, canvas.height); canvas.hidden = true;
  }
  function finish() {
    clearTimeout(timerId); timerId = 0; generation++;
    silence(); clearEffects(); run = null;
    overlay.classList.remove('perfect-animating');
  }
  function stop() {
    finish(); overlay.classList.remove('perfect-victory');
    delete overlay.dataset.perfectWinner;
  }
  function paint(now) {
    if (!run || document.hidden || reduced.matches || !ctx) return;
    const t = (now - run.started) / 1000;
    if (t >= DURATION) { finish(); return; }
    const w = overlay.clientWidth, h = overlay.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {
      canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    const scale = Math.min(w/720, h/450), colors = run.side === 0
      ? ['#ff635c','#ffffff','#c5ff73','#ffcc80'] : ['#ff806a','#ffffff','#78a8ff','#ffd986'];
    ctx.lineCap = 'round';
    for (const event of run.events) {
      const age = t-event.at; if (age < -.48 || age > 2.2) continue;
      const x = event.x*w, y = event.y*h;
      ctx.strokeStyle = colors[event.color];
      if (age < 0) {
        const py = h+(y-h)*(age+.48)/.48;
        ctx.globalAlpha = .7; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x,py+20*scale); ctx.lineTo(x,py); ctx.stroke(); continue;
      }
      for (const p of event.particles) {
        if (age > p.life) continue;
        const radius = event.radius*scale*p.speed*(1-Math.exp(-age*2.3));
        const px = x+Math.cos(p.angle)*radius, py = y+Math.sin(p.angle)*radius+age*age*28*scale;
        const tail = Math.max(2,10*(1-age/p.life))*scale;
        ctx.globalAlpha = Math.pow(1-age/p.life,1.1); ctx.lineWidth = Math.max(1.5,2.4*scale);
        ctx.beginPath(); ctx.moveTo(px-Math.cos(p.angle)*tail,py-Math.sin(p.angle)*tail); ctx.lineTo(px,py); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1; frameId = requestAnimationFrame(paint);
  }
  function start({winner, score, enabled, context}) {
    stop();
    if (![0,1].includes(winner) || score[winner] !== 7 || score[1-winner] !== 0) return false;
    sound = Boolean(enabled); audioContext = context || audioContext;
    run = {side:winner, started:performance.now(), events:Array.from({length:23},(_,i)=>({
      at:.8+i*.63, x:i%2 ? .76+Math.random()*.14 : .10+Math.random()*.14,
      y:.15+Math.random()*.50, radius:75+Math.random()*50, color:i%4,
      particles:Array.from({length:55},(_,j)=>({angle:j/55*Math.PI*2, speed:.65+Math.random()*.4, life:1.25+Math.random()*.7}))
    }))};
    overlay.dataset.perfectWinner = winner === 0 ? 'carney' : 'trump';
    overlay.classList.add('perfect-victory','perfect-animating');
    document.getElementById('panel-kicker').textContent = 'AUCUN POINT CONCÉDÉ';
    document.getElementById('panel-title').innerHTML = 'Victoire parfaite.<span class="perfect-score">7 — 0</span><span class="victory-quip">'+(winner === 0 ? 'Zéro point. Zéro taxe. Merci, bonsoir !' : '100 % victoire. 0 % modestie.')+'</span>';
    document.getElementById('panel-copy').textContent = (winner === 0 ? 'Mark Carney' : 'Donald Trump')+' remporte le duel. Une revanche ?';
    timerId = setTimeout(finish, DURATION*1000);
    if (!reduced.matches && !document.hidden && ctx) { canvas.hidden = false; frameId = requestAnimationFrame(paint); }
    playMusic(); return true;
  }
  function setSound(enabled, context) { sound = Boolean(enabled); audioContext = context || audioContext; playMusic(); }
  document.addEventListener('visibilitychange', () => {
    silence(); clearEffects();
    if (!run || document.hidden) return;
    if ((performance.now()-run.started)/1000 >= DURATION) { finish(); return; }
    if (!reduced.matches && ctx) { canvas.hidden = false; frameId = requestAnimationFrame(paint); }
    playMusic();
  });
  reduced.addEventListener('change', () => {
    clearEffects();
    if (run && !reduced.matches && !document.hidden && ctx) { canvas.hidden = false; frameId = requestAnimationFrame(paint); }
  });
  window.addEventListener('pagehide', stop);
  window.TariffPerfectVictory = Object.freeze({start, stop, setSound});
})();
