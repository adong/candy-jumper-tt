/* TT Candy Jumper: the page. The Three.js scene with a fixed arcade camera in front of the landmark, the HUD and screens,
   keys and touch, the brother who pops in to light a power ball, the 2-player turns, the celebrations, and the window.game
   test hooks. The rules are js/sim.js (fixed 1/120 s steps); the 3D things are js/art.js; sounds are js/sfx.js. */
(function () {
  'use strict';
  const T = THREE, S = CJ.sim, A = CJ.art, SFX = CJ.sfx, L = CJ.levels;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI, DT = S.DT;
  const KEY = 'candyJumperTT.v1';
  const NAME = (id) => (Kit.roster.get(id) || { name: id.toUpperCase() }).name;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const SCALE = 0.65; // the kit's people are 2 m tall; the hero here is 1.3 m
  const CRY = { bird: 'TWEET!', robot: 'BEEP BOOP!' };

  const store = {
    d: {},
    load() {
      try { this.d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.d = {}; }
      this.d.hi = this.d.hi || {};
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* private mode: fine */ } },
  };

  const G = {
    screen: 'loading', m: null, demo: false, paused: false, hold: false, autoPause: true,
    keys: {}, jumpQ: 0, downQ: 0, touch: {}, players: 1, who: 'teddy', level: 'easy', sab: null, simSab: null,
    time: 0, overT: 0, cele: null, demoReset: false, newHi: false, sndT: {}, shownScreen: -1,
  };
  let renderer, scene, cam, confetti, glow, fizz, ballMesh, stars, treatSprite, hoopBall, floor, last = 0;
  const backdrops = [], platGroups = [], candyMeshes = [], clouds = [];
  const bodies = {}; // teddy, tommy (hero or visiting brother), foxy, froggy (cheering at the sides)
  const pools = { bird: [], robot: [], coin: [] };
  const slotOf = new Map();
  const emojiTex = new Map();
  let portraits = {};
  const v3 = new T.Vector3();
  const cur = () => G.m && G.m.ws[G.m.turn];

  // ---------- start-up ----------
  function boot() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, Math.max(1, devicePixelRatio || 1)));
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(30, 1, 1, 400);
    scene.add(new T.HemisphereLight('#ffffff', '#c8b8ff', 0.95));
    const sun = new T.DirectionalLight('#fff4dd', 0.75);
    sun.position.set(-8, 20, 30);
    scene.add(sun);
    for (let s = 0; s < L.SCREENS.length; s++) {
      const b = A.backdrop(s); b.visible = false; scene.add(b); backdrops.push(b);
      const p = A.platforms(s); p.visible = false; scene.add(p); platGroups.push(p);
    }
    floor = A.floor();
    scene.add(floor);
    scene.add(A.walls());
    for (const sx of [-1, 1]) { const c = A.cloud(); c.position.set(sx * 8.4, 12.3, -0.4); c.scale.setScalar(0.9); scene.add(c); clouds.push(c); }
    for (let i = 0; i < 24; i++) { const c = A.candy(i); scene.add(c); candyMeshes.push(c); }
    glow = A.glow();
    scene.add(glow);
    fizz = A.fizz(48);
    scene.add(fizz);
    for (const id of ['teddy', 'tommy']) bodies[id] = makeBody(id, true);
    for (const id of ['foxy', 'froggy']) bodies[id] = makeBody(id, false);
    for (let i = 0; i < 6; i++) {
      const b = A.bird(A.BIRDS[i % A.BIRDS.length]); b.visible = false; scene.add(b); pools.bird.push(b);
      const r = A.robot(A.ROBOTS[i % A.ROBOTS.length]); r.visible = false; scene.add(r); pools.robot.push(r);
      const c = A.coin(); c.visible = false; scene.add(c); pools.coin.push(c);
    }
    ballMesh = A.ball();
    ballMesh.visible = false;
    scene.add(ballMesh);
    stars = A.stars();
    stars.visible = false;
    scene.add(stars);
    confetti = A.confetti(scene, 700);
    hoopBall = A.emoji('🏀', 0.32);
    hoopBall.visible = false;
    scene.add(hoopBall);
    treatSprite = A.emoji('🍦', 0.5);
    treatSprite.visible = false;
    scene.add(treatSprite);
    portraits = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 128 });
    store.load();
    const o = store.d.opts || {};
    if (o.players === 2) G.players = 2;
    if (o.who === 'tommy') G.who = 'tommy';
    if (o.level === 'normal') G.level = 'normal';
    setupUI();
    addEventListener('resize', fit);
    showTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }
  function makeBody(id, cape) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const person = Kit.people.build(Kit.roster.get(id).look);
    person.root.scale.setScalar(SCALE * (cape ? 1 : 0.9));
    body.add(person.root);
    let capeG = null;
    if (cape) { // the cape hangs from the shoulders as a flat sheet facing you, the way capes look in a side-on game
      capeG = A.cape(A.CAPE[id]);
      capeG.position.set(0, 0.95, -0.22);
      root.add(capeG);
    }
    root.visible = false;
    scene.add(root);
    return { root, body, person, cape: capeG, who: id, ph: Math.random() * 6, yaw: 0, spin: 0 };
  }

  // ---------- the fixed arcade camera: the whole screen fits the free part of the window ----------
  const BOX = { x0: -10.9, x1: 10.9, y0: -0.9, y1: 14.3 };
  const PITCH = 0.07;
  let view = { left: 58, right: 10, top: 64, bottom: 6 };
  function fit() {
    const W = innerWidth, H = innerHeight;
    renderer.setSize(W, H, false);
    const short = H <= 460, narrow = W <= 520;
    const top = short ? 46 : narrow ? 54 : 64;
    const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
    const cands = [];
    const touch = document.body.classList.contains('touch') && (G.screen === 'play' || G.screen === 'pause');
    if (!touch) cands.push({ left: 58, right: 10, bottom: 6 });
    else {
      const rl = $('tL').getBoundingClientRect(), rr = $('tR').getBoundingClientRect();
      cands.push({ left: Math.max(58, rl.right + 6), right: Math.max(10, W - rr.left + 6), bottom: 6 }); // beside the buttons
      cands.push({ left: 58, right: 10, bottom: Math.max(6, H - Math.min(rl.top, rr.top) + 6) }); // above them
    }
    let best = null;
    for (const c of cands) {
      const sw = Math.max(50, W - c.left - c.right), sh = Math.max(50, H - top - c.bottom);
      const k = Math.min(sw / bw, sh / bh);
      if (!best || k > best.k + 1e-6) best = Object.assign({ k, sw, sh, top }, c);
    }
    view = best;
    const k = best.k;
    const D = H / k / 2 / Math.tan((cam.fov * PI) / 360);
    const offX = best.left + best.sw / 2 - W / 2, offY = top + best.sh / 2 - H / 2;
    const cx = (BOX.x0 + BOX.x1) / 2 - offX / k, cy = (BOX.y0 + BOX.y1) / 2 + offY / k;
    cam.aspect = W / H;
    cam.position.set(cx, cy + D * Math.sin(PITCH), D * Math.cos(PITCH));
    cam.near = Math.max(1, D * 0.3);
    cam.far = D + 90;
    cam.lookAt(cx, cy, 0);
    cam.updateProjectionMatrix();
  }
  function toScreen(x, y, z) {
    v3.set(x, y, z || 0).project(cam);
    return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
  }

  // ---------- games ----------
  function newMatch(demo) {
    const who = demo ? ['teddy'] : G.players === 2 ? ['teddy', 'tommy'] : [G.who];
    return S.createMatch({ level: demo ? 'easy' : G.level, players: who, seed: (Math.random() * 1e9) | 0, buddyFor: (id) => Kit.roster.buddyFor(id) });
  }
  function setScreen(name) {
    G.screen = name;
    for (const id of ['title', 'pause', 'results']) $(id).classList.toggle('hidden', id !== name);
    document.body.classList.toggle('title', name === 'title');
    const playing = name === 'play' || name === 'pause';
    $('hud').classList.toggle('hidden', !playing);
    $('touch').classList.toggle('hidden', name !== 'play');
    $('menuMute').classList.toggle('hidden', playing);
    fit();
  }
  function clearInput() {
    G.keys = {};
    G.jumpQ = 0;
    G.downQ = 0;
    G.touch = {};
    document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down'));
  }
  function play() {
    Kit.sound.init();
    G.demo = false;
    G.paused = false;
    G.m = newMatch(false);
    G.m.ws.forEach((w) => (w.sab = G.simSab || null));
    clearInput();
    G.overT = 0;
    G.cele = null;
    G.newHi = false;
    slotOf.clear();
    confetti.clear();
    clearPops();
    document.body.classList.toggle('p2', G.players === 2);
    store.d.opts = { players: G.players, who: G.who, level: G.level };
    store.save();
    setupHud();
    setScreen('play');
    SFX.click();
    announceRound(cur());
  }
  function showTitle() {
    G.demo = true;
    G.paused = false;
    G.m = newMatch(true);
    G.cele = null;
    slotOf.clear();
    clearPops();
    document.body.classList.remove('p2');
    setScreen('title');
    syncOpts();
  }
  function pause() {
    if (G.screen !== 'play') return;
    G.paused = true;
    setScreen('pause');
  }
  function resume() {
    if (G.screen !== 'pause') return;
    G.paused = false;
    G.jumpQ = G.downQ = 0;
    setScreen('play');
  }
  function call() {
    const w = cur();
    if (G.screen !== 'play' || !w || G.paused) return;
    Kit.sound.init();
    w.events = []; // the last step's events were handled already
    S.call(w);
    handleEvents(w, w.events);
    w.events = [];
  }
  function setOpt(k, v) {
    G[k] = v;
    syncOpts();
    SFX.click();
  }
  const KEYS1 = '<span>walk</span><span><kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd></span><span>jump (hold to go higher)</span><span><kbd>Space</kbd> or <kbd>↑</kbd> <kbd>W</kbd></span><span>in the air: open your cape</span><span>press jump again</span><span>drop down · stop floating</span><span><kbd>↓</kbd> or <kbd>S</kbd></span>';
  function syncOpts() {
    document.querySelectorAll('[data-players]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.players === G.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === G.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
    $('whoRow').classList.toggle('off', G.players === 2);
    const hi = store.d.hi[G.level];
    $('titleHi').textContent = hi ? `HI-SCORE ${fmt(hi.score)} · ${NAME(hi.who)}` : '';
    $('titleKeys').innerHTML = KEYS1 + (G.players === 2
      ? '<span>take turns: a bump passes the keys</span><span><kbd>T</kbd> high five</span>'
      : '<span>call your brother</span><span><kbd>T</kbd></span>') + '<span>pause · sound</span><span><kbd>P</kbd> · <kbd>M</kbd></span>';
    $('touchHint').textContent = G.players === 2
      ? '◀ ▶ walk, the big ⬆ jumps (tap it again in the air to float), ▼ drops down. Teddy and Tommy take turns!'
      : "◀ ▶ walk, the big ⬆ jumps (tap it again in the air to float), ▼ drops down. Tap your brother's face to call him!";
  }

  // ---------- HUD ----------
  let hudCache = '';
  function setupHud() {
    const m = G.m;
    m.ws.forEach((w, pi) => { $('hudP' + pi).querySelector('[data-name]').textContent = NAME(w.who); });
    $('hudP1').classList.toggle('off', m.ws.length < 2);
    const two = m.ws.length === 2;
    $('budBtn').style.display = two ? 'none' : '';
    const bud = Kit.roster.buddyFor(m.ws[0].who);
    $('budBtn').querySelector('img').src = portraits[bud] || '';
    $('budLbl').textContent = `CALL ${NAME(bud)}`;
    const cb = document.querySelector('#tR .call');
    cb.classList.toggle('hi5', two);
    cb.innerHTML = two ? '✋<small>HIGH FIVE</small>' : `<img alt="" src="${portraits[bud] || ''}"><small>CALL</small>`;
    hudCache = '';
  }
  function hud() {
    const m = G.m, w = cur();
    if (!w || G.demo) return;
    const hi = Math.max((store.d.hi[w.level] || { score: 0 }).score, ...m.ws.map((x) => x.score));
    const round = `ROUND ${w.round} · ${L.SCREENS[w.screen].name}`;
    const count = w.power > 0 ? `🪙 COINS! ${Math.ceil(w.power)}` : `🍬 ${w.got}/24 · ✨ ${w.glowGot}`;
    const lives = m.ws.map((x) => (x.lives > 6 ? `❤️×${x.lives}` : '❤️'.repeat(Math.max(0, x.lives))));
    const key = [hi, round, count, m.ws.map((x) => x.score).join(), lives.join(), m.turn, !!w.buddy].join('|');
    if (key === hudCache) return;
    hudCache = key;
    $('hudHi').textContent = fmt(hi);
    $('hudRound').textContent = round;
    $('hudCount').textContent = count;
    $('hudCount').classList.toggle('pow', w.power > 0);
    m.ws.forEach((x, pi) => {
      const box = $('hudP' + pi);
      box.querySelector('.sc').textContent = fmt(x.score);
      box.querySelector('.lives').textContent = lives[pi] || ' ';
      box.classList.toggle('turn', m.ws.length === 2 && pi === m.turn);
    });
    $('budBtn').classList.toggle('on', !!w.buddy);
    const cb = document.querySelector('#tR .call');
    if (cb) cb.classList.toggle('on', !!w.buddy);
  }

  // ---------- input (2 players take turns, so both sets of keys move whoever's turn it is) ----------
  const JUMP = ['Space', 'ArrowUp', 'KeyW'], DOWN = ['ArrowDown', 'KeyS'];
  function readInput() {
    const k = G.keys, t = G.touch;
    const left = k.ArrowLeft || k.KeyA || t.l, right = k.ArrowRight || k.KeyD || t.r;
    let lr = (right ? 1 : 0) - (left ? 1 : 0);
    if (G.sab === 'mirror') lr = -lr; // the play check's own sabotage
    const jump = G.jumpQ > 0;
    if (jump) G.jumpQ--;
    const downPress = G.downQ > 0;
    if (downPress) G.downQ--;
    return { lr, jump, hold: !!(k.Space || k.ArrowUp || k.KeyW || t.jump), down: !!(k.ArrowDown || k.KeyS || t.down) || downPress, downPress };
  }
  function setupUI() {
    const logo = () => {
      const zh = Kit.lang.is('zh');
      $('logoText').textContent = zh ? CJ.ZH : CJ.TITLE;
      $('logoSub').textContent = zh ? CJ.TITLE : '';
    };
    logo();
    Kit.lang.onChange(logo);
    $('tagline').textContent = CJ.TAGLINE;
    document.querySelectorAll('[data-who] img').forEach((im) => (im.src = portraits[im.parentNode.dataset.who] || ''));
    document.querySelectorAll('[data-players]').forEach((b) => b.addEventListener('click', () => setOpt('players', +b.dataset.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => setOpt('who', b.dataset.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setOpt('level', b.dataset.level)));
    $('startBtn').addEventListener('click', play);
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', resume);
    $('quitBtn').addEventListener('click', showTitle);
    $('againBtn').addEventListener('click', play);
    $('menuBtn').addEventListener('click', showTitle);
    $('budBtn').addEventListener('click', call);
    const syncMute = () => document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); syncMute(); }));
    Kit.sound.onMute(syncMute);
    syncMute();

    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !document.body.classList.contains('touch')) {
        document.body.classList.add('touch');
        fit();
      }
    }, true);
    if (matchMedia('(hover: none) and (pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) document.body.classList.add('touch');

    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      Kit.sound.init();
      const c = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (c === 'KeyM' && !e.repeat) { Kit.sound.toggleMute(); syncMute(); return; }
      if (G.screen === 'title') {
        if (e.repeat) return;
        if (c === 'Digit1') setOpt('players', 1);
        else if (c === 'Digit2') setOpt('players', 2);
        else if (c === 'KeyE') setOpt('level', 'easy');
        else if (c === 'KeyN') setOpt('level', 'normal');
        else if ((c === 'KeyC' || c === 'ArrowLeft' || c === 'ArrowRight') && G.players === 1) setOpt('who', G.who === 'teddy' ? 'tommy' : 'teddy');
        else if (c === 'Enter' || c === 'Space') play();
        return;
      }
      if (G.screen === 'results') {
        if (e.repeat) return;
        if (c === 'Enter' || c === 'Space') play();
        else if (c === 'Escape' || c === 'KeyQ') showTitle();
        return;
      }
      if (G.paused) {
        if (e.repeat) return;
        if (c === 'KeyP' || c === 'Escape') resume();
        else if (c === 'KeyQ') showTitle();
        G.keys[c] = true; // still held when the game goes on
        return;
      }
      if (G.screen === 'play') {
        if ((c === 'KeyP' || c === 'Escape') && !e.repeat) return pause();
        if ((c === 'KeyT' || c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { call(); return; }
        G.keys[c] = true;
        if (JUMP.includes(c) && !e.repeat) G.jumpQ = Math.min(2, G.jumpQ + 1);
        if (DOWN.includes(c) && !e.repeat) G.downQ = Math.min(2, G.downQ + 1);
      }
    });
    addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.autoPause && G.screen === 'play' && !G.paused) pause();
      if (document.hidden) Kit.sound.suspend();
      else Kit.sound.resume();
    });

    // touch: ◀ ▶ ▼ on the left, the brother's face and a big ⬆ JUMP on the right
    const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* a test's pointer: fine */ } };
    document.querySelectorAll('#touch [data-k]').forEach((b) => {
      const k = b.dataset.k;
      const on = (v) => {
        b.classList.toggle('down', v);
        if (k === 'call') { if (v) call(); return; }
        const was = !!G.touch[k];
        G.touch[k] = v;
        if (v && !was && G.screen === 'play' && !G.paused) {
          if (k === 'jump') G.jumpQ = Math.min(2, G.jumpQ + 1);
          if (k === 'down') G.downQ = Math.min(2, G.downQ + 1);
        }
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(b, e); on(true); });
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointercancel', () => on(false));
      b.addEventListener('lostpointercapture', () => on(false));
    });
  }

  // ---------- each frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const gap = now - (last || now);
    const dt = Math.min(0.1, Math.max(0, gap / 1000));
    last = now;
    if (gap > 300) { G.touch = {}; document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down')); } // frames were held back (the ? panel, a hidden tab)
    if (!G.hold) advance(dt);
    draw();
  }
  function inputFor(w) {
    if (G.demo) return CJ.bot.decide(w);
    if (G.screen === 'play') return readInput();
    return null;
  }
  function afterStep(w) {
    handleEvents(w, w.events);
    const m = G.m;
    S.matchAfter(m);
    for (const e of m.events) if (e.type === 'turn') onTurn(e);
    if (G.demo) { if (m.over || w.t > 150) G.demoReset = true; }
    else if (m.over && G.screen === 'play') {
      G.overT += DT;
      if (G.overT > 3.4) showResults();
    }
  }
  function advance(dt) {
    G.time += dt;
    const w = cur();
    if (!w) return;
    if (!G.paused) {
      S.advance(w, dt, inputFor, afterStep);
      if (G.demoReset) { G.demoReset = false; G.m = newMatch(true); slotOf.clear(); }
    }
    visuals(G.paused ? 0 : dt);
  }
  function draw() { renderer.render(scene, cam); }

  // ---------- what the rules said happened ----------
  function sfx(name, gap, ...a) {
    if (G.demo) return;
    if (gap && G.time - (G.sndT[name] || -9) < gap) return;
    G.sndT[name] = G.time;
    SFX[name](...a);
  }
  const FIZZ = ['#ffffff', '#fff6a0', '#bff3ff', '#ffd0f0'];
  function announceRound(w) {
    big(`ROUND ${w.round}`, L.SCREENS[w.screen].name);
  }
  function onTurn(e) {
    const w = G.m.ws[e.turn];
    sfx('turn');
    big(`${NAME(e.who)}'S TURN!`, `ROUND ${w.round} · ${L.SCREENS[w.screen].name}`);
    slotOf.clear();
    clearInput();
    hudCache = '';
  }
  function handleEvents(w, evs) {
    const m = G.m;
    for (const e of evs) {
      switch (e.type) {
        case 'jump': sfx('jump', 0.05); break;
        case 'float': sfx('float', 0.1); pop(w.hero.x, w.hero.y + 1.9, 'WHOOSH!', 'cool'); break;
        case 'land': if (e.soft) sfx('land', 0.1); break;
        case 'drop': sfx('drop', 0.1); break;
        case 'candy': {
          const col = A.CANDY[e.i % A.CANDY.length];
          confetti.burst(e.x, e.y, 0.4, e.glow ? 26 : 12, e.glow ? 4 : 2.6, e.glow ? null : [col, '#ffffff', ...FIZZ]);
          if (e.glow) { sfx('glow', 0, e.streak); pop(e.x, e.y + 0.4, `IN ORDER! +${e.pts}`, 'big'); cheer(); }
          else { sfx('candy', 0, e.n); pop(e.x, e.y + 0.4, `FIZZ! +${e.pts}`); }
          break;
        }
        case 'ball':
          sfx('ball');
          confetti.burst(e.x, e.y, 0.4, 16, 3);
          if (e.from !== 'buddy') toast('THE POWER BALL IS HERE!');
          break;
        case 'ballPop': confetti.burst(e.x, e.y, 0.4, 10, 2, ['#ffffff', '#fff6a0']); break;
        case 'power': {
          sfx('power');
          big('POWER BALL!', 'Flyers turned into coins!');
          confetti.burst(e.x, e.y, 0.5, 40, 5);
          if (!G.demo) w.flyers.forEach((f) => { if (f.state === 'coin') confetti.burst(f.x, f.y, 0.5, 10, 2.5, ['#ffd400', '#ffffff']); });
          break;
        }
        case 'coin': sfx('coin', 0, e.n); confetti.burst(e.x, e.y, 0.5, 24, 3.5, ['#ffd400', '#ffb000', '#ffffff']); pop(e.x, e.y + 0.4, `+${e.pts}`, 'big'); break;
        case 'powerEnd': sfx('unCoin'); w.flyers.forEach((f) => { if (f.state === 'fly') pop(f.x, f.y + 0.6, 'BOING!', 'cool'); }); break;
        case 'flyerIn': sfx('flyerIn', 0.3); confetti.burst(e.x, e.y, 0.3, 10, 2, ['#ffffff', '#e8f4ff']); break;
        case 'bump':
          sfx('bump');
          confetti.burst(w.hero.x, w.hero.y + 1, 0.6, 18, 3, ['#ffd400', '#ffffff']);
          pop(w.hero.x, w.hero.y + 1.9, `${CRY[e.kind] || 'BONK!'} DIZZY!`, 'ouch');
          break;
        case 'puff': sfx('puff', 0.15); confetti.burst(e.x, e.y, 0.4, 16, 2.5, ['#ffffff', '#ffe0f4', '#bff3ff']); pop(e.x, e.y + 0.5, 'POOF!', 'cool'); break;
        case 'respawn': if (m.ws.length < 2) big('READY?', `${'❤️'.repeat(Math.min(6, w.lives))}`); break;
        case 'go': if (!G.demo) { sfx('go'); pop(w.hero.x, w.hero.y + 2.2, 'GO!', 'big'); } break;
        case 'round': if (w.round > 1) { slotOf.clear(); if (!G.demo && G.screen === 'play') announceRound(w); } break;
        case 'clear':
          if (e.perfect) { sfx('perfect'); big('PERFECT ORDER!', `+${fmt(e.bonus)}`); }
          else { sfx('clear'); big('ALL 24 CANDIES!', `IN ORDER: ${e.glowGot} · +${fmt(e.bonus)}`); }
          celebrate(w, 3.4);
          cheer();
          if (!G.demo) confetti.rain(-10, 10, 13, 120);
          break;
        case 'life': sfx('life'); pop(w.hero.x, w.hero.y + 2.4, 'EXTRA LIFE!', 'big'); break;
        case 'over': {
          sfx('gameOver');
          if (m.ws.length === 2) toast(`${NAME(w.who)} IS OUT OF LIVES`);
          if (m.ws.every((x) => x.phase === 'over')) {
            const best = Math.max(...m.ws.map((x) => x.score));
            const win = m.ws.findIndex((x) => x.score === best);
            m.turn = win;
            G.cele = { w: m.ws[win], ids: new Set(m.ws.filter((x) => x.score === best).map((x) => x.who)), until: G.time + 99, over: true, t0: G.time, n: 1 };
            if (!G.demo) confetti.rain(-10, 10, 13, 160);
          }
          break;
        }
        case 'buddyIn': sfx('buddy'); confetti.burst(e.x, e.y + 0.8, 0.6, 20, 3); break;
        case 'buddyOut': confetti.burst(e.x, e.y + 0.8, 0.6, 14, 2.5, ['#ffffff', '#fff6a0']); break;
        case 'treat': sfx('treat'); throwTreat(w, e.treat); pop(w.hero.x, w.hero.y + 2.3, `${e.treat} +${e.pts}`); break;
        case 'helper': sfx('helper'); toast(`${NAME(e.who)} SAYS: POWER BALL FOR YOU!`); break;
        case 'hi5': sfx('hi5'); toast('HIGH FIVE! ✋ +50'); confetti.burst(e.x, e.y, 0.6, 40, 4); break;
        default: break;
      }
    }
  }
  function celebrate(w, secs) {
    G.cele = { w, ids: new Set([w.who]), until: G.time + secs, over: false, t0: G.time, n: (G.cele ? G.cele.n : 0) + 1 };
  }
  let cheerT = -9;
  function cheer() { cheerT = G.time; }
  let treatFly = null;
  function throwTreat(w, e) {
    const b = w.buddy;
    if (!emojiTex.has(e)) emojiTex.set(e, Kit.gfx.emojiTexture(e));
    treatSprite.material.map = emojiTex.get(e);
    treatSprite.material.needsUpdate = true;
    treatFly = { t: 0, x0: b ? b.x : w.hero.x - 1, y0: b ? b.y + 1.1 : w.hero.y + 2, hero: w.hero };
  }

  // ---------- pops, toasts and big words ----------
  function pop(x, y, text, cls) {
    if (G.demo) return;
    const [sx, sy] = toScreen(x, y, 0.5);
    const d = document.createElement('div');
    d.className = 'pop' + (cls ? ' ' + cls : '');
    d.textContent = text;
    d.style.left = sx + 'px';
    d.style.top = sy + 'px';
    $('pops').appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  function clearPops() { $('pops').innerHTML = ''; }
  let toastTimer = 0;
  function toast(text) {
    if (G.demo) return;
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  let bigTimer = 0;
  function big(text, small) {
    if (G.demo) return;
    const b = $('bigmsg');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    if (small) { const s = document.createElement('small'); s.textContent = small; b.appendChild(s); }
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bigTimer);
    bigTimer = setTimeout(() => b.classList.remove('show'), 1600);
  }

  // ---------- results ----------
  function showResults() {
    const m = G.m;
    if (!m || G.screen === 'results') return;
    const ws = m.ws;
    const best = Math.max(...ws.map((w) => w.score));
    const two = ws.length === 2;
    const winners = ws.filter((w) => w.score === best);
    $('resTitle').textContent = !two ? 'GREAT JUMPING!' : winners.length === 2 ? "IT'S A TIE!" : `${NAME(winners[0].who)} WINS!`;
    $('resSub').textContent = two ? `TEAM ${fmt(ws[0].score + ws[1].score)} POINTS` : `ROUND ${ws[0].round} · ${fmt(best)} POINTS`;
    $('resTable').innerHTML = '';
    ws.slice().sort((a, b) => b.score - a.score).forEach((w) => {
      const tr = document.createElement('tr');
      if (w.score === best) tr.className = 'me';
      tr.innerHTML = `<td class="who"><img alt="" src="${portraits[w.who] || ''}">${NAME(w.who)}</td><td class="pts">${fmt(w.score)}</td><td>🍬 ${w.candiesTotal}</td><td>🏁 ${w.round}</td>`;
      $('resTable').appendChild(tr);
    });
    const old = store.d.hi[ws[0].level];
    const top = ws.reduce((a, b) => (b.score > a.score ? b : a));
    if (top.score > 0 && (!old || top.score > old.score)) {
      store.d.hi[ws[0].level] = { score: top.score, who: top.who };
      store.save();
      G.newHi = true;
    }
    const hi = store.d.hi[ws[0].level];
    $('resBest').textContent = G.newHi ? '⭐ NEW HI-SCORE!' : hi ? `HI-SCORE ${fmt(hi.score)} · ${NAME(hi.who)}` : '';
    $('resBest').classList.toggle('new', G.newHi);
    setScreen('results');
  }

  // ---------- moving the 3D things to match the rules ----------
  function visuals(dt) {
    const w = cur();
    const t = G.time;
    const k = 1 - Math.exp(-14 * dt);
    if (G.shownScreen !== w.screen) {
      G.shownScreen = w.screen;
      backdrops.forEach((b, i) => (b.visible = i === w.screen));
      scene.background = new T.Color(backdrops[w.screen].userData.top);
      platGroups.forEach((g, i) => (g.visible = i === w.screen));
      floor.userData.set(A.LOOK[w.screen]);
    }
    // candies, the glow on the next one, and their fizz
    const fp = fizz.geometry.attributes.position;
    candyMeshes.forEach((c, i) => {
      const o = w.candies[i];
      c.visible = !!o && !o.got;
      const ph = t * 1.6 + i * 0.7;
      if (c.visible) {
        const isG = o.i === w.glow;
        c.position.set(o.x, o.y + 0.06 * Math.sin(ph * 1.3), 0.2);
        c.rotation.set(0, 0.5 * Math.sin(ph), isG ? 0.25 * Math.sin(t * 8) : 0.1 * Math.sin(ph * 0.7));
        c.scale.setScalar(isG ? 1.25 + 0.08 * Math.sin(t * 7) : 1);
        c.userData.body.material.emissiveIntensity = isG ? 0.55 + 0.25 * Math.sin(t * 7) : 0.12;
      }
      for (let j = 0; j < 2; j++) {
        const u = (t * 0.7 + i * 0.37 + j * 0.5) % 1;
        if (c.visible) fp.setXYZ(i * 2 + j, o.x + 0.25 * Math.sin(i * 3 + j * 2 + u * 6), o.y + 0.15 + u * 0.8, 0.3);
        else fp.setXYZ(i * 2 + j, 0, -50, 0);
      }
    });
    fp.needsUpdate = true;
    const gc = w.glow >= 0 ? w.candies[w.glow] : null;
    glow.visible = !!gc && !gc.got && (w.phase === 'play' || w.phase === 'ready');
    if (glow.visible) {
      glow.position.set(gc.x, gc.y, 0.1);
      const pu = 1 + 0.15 * Math.sin(t * 6);
      glow.userData.s.scale.set(2 * pu, 2 * pu, 1);
      glow.userData.ring.material.rotation = t * 1.5;
    }
    // the clouds at the top puff when a flyer comes out
    clouds.forEach((c, i) => { c.position.y = 12.3 + 0.1 * Math.sin(t * 1.3 + i * 2); });
    // the flyers and their coins
    const used = { bird: new Set(), robot: new Set(), coin: new Set() };
    const shown = new Set();
    const taken = { bird: new Set(), robot: new Set(), coin: new Set() };
    for (const f of w.flyers) for (const kind in taken) { const s = slotOf.get(f.id + kind); if (s != null && f.state !== 'gone') taken[kind].add(s); }
    const slot = (f, kind) => {
      const key = f.id + kind;
      let s = slotOf.get(key);
      if (s == null || used[kind].has(s)) {
        s = pools[kind].findIndex((_, j) => !used[kind].has(j) && !taken[kind].has(j));
        if (s < 0) s = pools[kind].findIndex((_, j) => !used[kind].has(j));
        if (s < 0) return null;
        slotOf.set(key, s);
        taken[kind].add(s);
      }
      used[kind].add(s);
      return pools[kind][s];
    };
    for (const f of w.flyers) {
      if (f.state === 'gone') continue;
      const blinkBack = f.state === 'coin' && w.power < 1.5 && Math.floor(t * 8) % 2 === 0;
      const kind = f.state === 'coin' && !blinkBack ? 'coin' : f.kind;
      const m = slot(f, kind);
      if (!m) continue;
      shown.add(m);
      m.visible = true;
      m.position.set(f.x, f.y, 0.3);
      const pop = f.state === 'in' ? Math.min(1, f.t / 0.5) : 1;
      if (kind === 'coin') {
        m.rotation.set(0, t * 3 + f.id, 0);
        m.scale.setScalar(1 + 0.08 * Math.sin(t * 9 + f.id));
      } else if (kind === 'bird') {
        const flap = Math.sin(t * 14 + f.id);
        m.userData.wings[0].rotation.z = 0.2 + 0.7 * flap;
        m.userData.wings[1].rotation.z = -0.2 - 0.7 * flap;
        m.rotation.set(0, (f.vx > 0 ? 0.5 : -0.5), 0.15 * Math.sin(t * 3 + f.id));
        m.scale.setScalar(pop);
      } else {
        m.userData.prop.rotation.y = t * 25;
        m.rotation.set(0, 0.35 * Math.sin(t * 1.5 + f.id), 0.2 * Math.sin(t * 2.5 + f.id));
        m.position.y += 0.08 * Math.sin(t * 5 + f.id);
        m.scale.setScalar(pop);
      }
    }
    for (const kind in pools) for (const m of pools[kind]) if (!shown.has(m)) m.visible = false;
    // the wobbly power ball
    const b = w.ball;
    ballMesh.visible = !!b && !(b.life - b.t < 2 && Math.floor(t * 10) % 2 === 0);
    if (b) {
      ballMesh.position.set(b.x, b.y, 0.4);
      const wob = Math.sin(t * 9);
      ballMesh.userData.s.scale.set(1 + 0.14 * wob, 1 - 0.14 * wob, 1);
      ballMesh.userData.s.rotation.set(t * 1.2, t * 2, 0);
      const gl = 2.2 + 0.3 * Math.sin(t * 6);
      ballMesh.userData.glow.scale.set(gl, gl, 1);
    }
    // the hero, the visiting brother, and Foxy and Froggy cheering at the sides
    const usedB = new Set();
    const cele = G.cele && G.time < G.cele.until && G.cele.w === w ? G.cele : null;
    drawHero(bodies[w.who], w, dt, t, k, cele);
    usedB.add(w.who);
    if (w.buddy && bodies[w.buddy.who] && !usedB.has(w.buddy.who)) { drawBuddy(bodies[w.buddy.who], w.buddy, w, dt, t, k); usedB.add(w.buddy.who); }
    for (const id of ['teddy', 'tommy']) if (!usedB.has(id)) bodies[id].root.visible = false;
    drawFans(dt, t, k);
    ballFollow(t);
    // a treat flying from the brother to the hero
    if (treatFly) {
      treatFly.t += dt;
      const u = Math.min(1, treatFly.t / 0.55), h = treatFly.hero;
      treatSprite.visible = u < 1;
      treatSprite.position.set(treatFly.x0 + (h.x - treatFly.x0) * u, treatFly.y0 + (h.y + 1.1 - treatFly.y0) * u + Math.sin(u * PI) * 1.2, 1);
      if (u >= 1) treatFly = null;
    } else treatSprite.visible = false;
    confetti.update(dt);
    hud();
  }
  // the side the body faces, turned a little toward the camera so you see the face
  const YAW = (face) => (face > 0 ? -PI / 2 - 0.45 : PI / 2 + 0.45);
  function turn(c, yaw, k) {
    let d = yaw - c.yaw;
    while (d > PI) d -= 2 * PI;
    while (d < -PI) d += 2 * PI;
    c.yaw += d * Math.min(1, k * 1.3);
    c.body.rotation.y = c.yaw;
  }
  function sigMode(who, n) {
    const e = Kit.roster.get(who);
    if (!e || !e.signature) return 'wave';
    return e.signature[(n || 0) % e.signature.length];
  }
  let ballOwner = null;
  function ballFollow(t) {
    hoopBall.visible = !!ballOwner;
    if (ballOwner) {
      const c = ballOwner;
      c.root.updateMatrixWorld(true);
      Kit.people.handWorld(c.person, 1, v3);
      hoopBall.position.set(v3.x, v3.y + 0.12 + 0.04 * Math.sin(t * 8), v3.z + 0.3);
    }
    ballOwner = null;
  }
  // lift: how far it swings back (behind = away from where he faces), spread: how wide it opens
  function capeSet(c, lift, spread, k, face) {
    if (!c.cape) return;
    const want = -(face || 0) * lift;
    c.cape.rotation.z += (want - c.cape.rotation.z) * Math.min(1, k * 1.2);
    const sx = c.cape.scale.x + (spread - c.cape.scale.x) * Math.min(1, k * 1.2);
    c.cape.scale.set(sx, 1, 1);
  }
  function drawHero(c, w, dt, t, k, cele) {
    const h = w.hero;
    let vis = h.state !== 'out' || (cele && cele.over);
    let x = h.x, y = h.y;
    if (cele && cele.over) { // the winner on the floor in the middle, doing his move
      const ids = [...cele.ids];
      x = ids.length > 1 ? (ids.indexOf(w.who) - 0.5) * 1.6 : 0;
      y = 0;
    }
    if (vis && h.state === 'play' && h.inv > 0 && w.phase === 'play' && !cele) vis = Math.floor(t * 10) % 2 === 0;
    c.root.visible = vis;
    c.root.position.set(x, y, 0.15); // even while blinking, so game.drawn() is always where he is
    stars.visible = false;
    if (!vis) return;
    c.root.scale.setScalar(1);
    c.ph += dt * 7;
    const p = c.person;
    p.root.rotation.z = 0;
    if (cele) {
      turn(c, PI, k * 2);
      const mode = sigMode(w.who, cele.n + (cele.over ? 1 : 0));
      Kit.people.pose(p, (G.time - cele.t0) * 7, mode, k);
      if (mode === 'jumpshot') { c.root.position.y += Math.abs(Math.sin((G.time - cele.t0) * 3)) * 0.35; ballOwner = c; }
      capeSet(c, 0.15 * Math.sin(t * 6), 1.3, k, 1);
      return;
    }
    if (h.state === 'dizzy') {
      c.yaw += dt * 9;
      c.body.rotation.y = c.yaw;
      Kit.people.pose(p, c.ph, 'fall', k);
      capeSet(c, 0.5 * Math.sin(t * 9), 1.2, k, 1);
      stars.visible = true;
      stars.children.forEach((s, i) => { const a = t * 5 + (i * 2 * PI) / 3; s.position.set(x + Math.cos(a) * 0.5, y + 1.45 + Math.sin(a * 2) * 0.05, 0.15 + Math.sin(a) * 0.5); });
      return;
    }
    const air = h.ground < 0;
    turn(c, air && h.float ? PI + 0.45 * h.face : YAW(h.face), k); // floating: he turns to you, the cape spread out behind
    if (!air) {
      const run = Math.abs(h.vx) > 0.6;
      Kit.people.pose(p, c.ph * (run ? 1.3 : 1), run ? 'run' : 'stand', k);
      capeSet(c, run ? 0.75 + 0.12 * Math.sin(t * 14) : 0.06, 1, k, h.face);
    } else if (h.float) {
      Kit.people.pose(p, c.ph, 'jump', k);
      p.armL.rotation.z = -1.35 + 0.1 * Math.sin(t * 5);
      p.armR.rotation.z = 1.35 - 0.1 * Math.sin(t * 5);
      p.armL.rotation.x = p.armR.rotation.x = 0;
      capeSet(c, 0.12 * Math.sin(t * 4), 2.3, k, h.face); // wide open, like a parachute
    } else {
      Kit.people.pose(p, c.ph, 'jump', k);
      if (h.vy > 0) { p.armR.rotation.x = -2.8; p.armR.rotation.z = 0.2; } // a superhero fist up when jumping
      capeSet(c, h.vy > 0 ? 0.35 + 0.1 * Math.sin(t * 16) : 1.2, 1.1, k, h.face);
    }
  }
  function drawBuddy(c, b, w, dt, t, k) {
    const sc = (Kit.roster.get(b.who) || {}).buddyScale || 0.8;
    const pop = b.phase === 'in' ? Math.min(1, b.t / 0.3) : b.phase === 'out' ? Math.max(0, 1 - b.t / 0.35) : 1;
    c.root.visible = pop > 0.02;
    c.root.position.set(b.x, b.y, 0.6);
    c.root.scale.setScalar(sc * pop);
    c.ph += dt * 6;
    capeSet(c, 0.1 * Math.sin(t * 5), 1, k, 1);
    if (b.phase === 'sig' || b.phase === 'in') {
      turn(c, PI, k * 2);
      const mode = b.hi5 ? 'wave' : sigMode(b.who, b.n - 1);
      Kit.people.pose(c.person, b.t * 7, mode, k);
      if (mode === 'jumpshot') ballOwner = c;
    } else if (b.phase === 'give') {
      turn(c, YAW(b.face), k);
      Kit.people.pose(c.person, c.ph, b.hi5 ? 'wave' : 'give', k);
    } else if (b.phase === 'light') {
      turn(c, PI, k);
      Kit.people.pose(c.person, c.ph, 'jumpshot', k); // both hands up: here comes the power ball
    } else {
      turn(c, PI, k);
      Kit.people.pose(c.person, c.ph, 'wave', k);
    }
  }
  function drawFans(dt, t, k) {
    const ch = G.time - cheerT < 1.6;
    [['foxy', -12.2], ['froggy', 12.2]].forEach(([id, x], i) => {
      const c = bodies[id];
      c.root.visible = true;
      c.ph += dt * 6;
      c.root.position.set(x, ch ? Math.abs(Math.sin((G.time - cheerT) * 7 + i)) * 0.5 : 0, -1.2);
      turn(c, x < 0 ? PI + 0.5 : PI - 0.5, k);
      Kit.people.pose(c.person, c.ph, ch ? (i ? 'jump' : 'wave') : 'stand', k);
      if (ch) { c.person.armL.rotation.z = -2.6; c.person.armR.rotation.z = 2.6; }
    });
  }

  // ---------- test hooks ----------
  function state() {
    const w = cur();
    const h = w && w.hero;
    return {
      screen: G.screen, paused: G.paused, demo: G.demo, phase: w && w.phase, round: w && w.round, level: w && w.level, turn: G.m && G.m.turn,
      p: h && { x: +h.x.toFixed(3), y: +h.y.toFixed(3), vx: +h.vx.toFixed(3), vy: +h.vy.toFixed(3), state: h.state, ground: h.ground, float: h.float, inv: +h.inv.toFixed(2) },
      players: G.m && G.m.ws.map((x) => ({ who: x.who, score: x.score, lives: x.lives, phase: x.phase, got: x.got })),
      got: w && w.got, glow: w && w.glow, power: w && +w.power.toFixed(2), flyers: w && w.flyers.map((f) => f.kind + ':' + f.state), ball: !!(w && w.ball),
      buddy: w && w.buddy && { who: w.buddy.who, phase: w.buddy.phase },
      muted: Kit.sound.isMuted(), sfx: Object.assign({}, SFX.log), lang: Kit.lang.get(), touch: document.body.classList.contains('touch'),
    };
  }
  window.game = {
    start(o) {
      o = o || {};
      if (o.players) G.players = o.players;
      if (o.who) G.who = o.who;
      if (o.level) G.level = o.level;
      play();
      if (o.round && o.round !== 1) { for (const w of G.m.ws) { S.startRound(w, o.round); w.events = []; } announceRound(cur()); }
      if (o.go) for (const w of G.m.ws) if (w.phase === 'ready') { w.phase = 'play'; w.phaseT = 0; }
      return state();
    },
    step(secs, o) {
      const n = Math.max(1, Math.round((secs || DT) / DT));
      for (let i = 0; i < n; i++) advance(DT);
      if (!o || o.draw !== false) draw();
      return state();
    },
    state,
    hold(v) { G.hold = v !== false; return G.hold; },
    call, pause, resume, showTitle, showResults, play,
    check: (only) => CJ.check.run(only),
    checkFail: () => CJ.check.fail(),
    // put the hero at (x, y): on platform `ground` (or in the air with ground -1); the rules stay the real ones
    put(x, y, o) {
      const h = cur().hero;
      Object.assign(h, { x, y, vx: 0, vy: 0, ground: -1, float: false, state: 'play', inv: 0, dropT: 0, holdT: S.P.holdMax }, o || {});
      return state();
    },
    // no flyers, no ball, nothing coming (tests that only look at moving)
    quiet() { for (const w of G.m.ws) { w.flyers = []; w.toSpawn = 0; w.spawnT = 1e9; w.ball = null; w.power = 0; if (w.phase === 'ready') { w.phase = 'play'; w.phaseT = 0; } } return state(); },
    setTurn(i) { G.m.turn = i; const w = cur(); if (w.phase === 'ready') { w.phase = 'play'; w.phaseT = 0; } slotOf.clear(); return state(); },
    sabotage(s) { G.sab = s || null; return G.sab; },
    simSabotage(s) { G.simSab = s || null; if (G.m) G.m.ws.forEach((w) => (w.sab = G.simSab)); return G.simSab; },
    // where the hero is drawn on the screen (his own 3D body, projected through the camera)
    drawn() {
      const w = cur(), c = bodies[w.who];
      c.root.updateMatrixWorld(true);
      c.root.getWorldPosition(v3);
      const x = v3.x, y = v3.y;
      const [sx, sy] = toScreen(x, y + 0.65, v3.z);
      return { sx, sy, x, y };
    },
    toScreen, view: () => view, world: cur, match: () => G.m, G,
    info() { draw(); const r = renderer.info.render; let meshes = 0; scene.traverseVisible((o) => { if (o.isMesh || o.isSprite) meshes++; }); return { calls: r.calls, triangles: r.triangles, meshes, pixelRatio: renderer.getPixelRatio() }; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
