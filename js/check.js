/* TT Candy Jumper: the headless check. The brief's rules, run on the real js/sim.js with no page and no Three.js: the
   glowing candy follows its order rule; collecting all 24 ends the round; jump height and floating are the same at 30, 60
   and 120 fps; flyers turn into coins after the power ball. Plus holding jumps higher, platforms, bumps and lives, the
   brother lighting a power ball, 2-player turns, and the autopilot reaching every candy on every screen.
     CJ.check.run()   every check (node tools/check.js, or game.check() in the page)
     CJ.check.fail()  switches on one sabotage at a time in the rules and makes sure its check catches it */
(function (root) {
  'use strict';
  const CJ = (root.CJ = root.CJ || {});
  const S = CJ.sim, L = CJ.levels;
  const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);

  // a quiet test world: playing at once, no flyers coming
  function lab(o) {
    o = o || {};
    const w = S.create({ level: o.level || 'easy', who: o.who || 'teddy', seed: o.seed || 7, sab: o.sab, round: o.round, two: o.two });
    w.phase = 'play';
    w.toSpawn = 0;
    w.spawnT = 1e9;
    return w;
  }
  const run = (w, secs, inp, each) => {
    const n = Math.round(secs / S.DT);
    for (let i = 0; i < n; i++) { S.step(w, typeof inp === 'function' ? inp(w, i) : inp); if (each && each(w, i) === false) return i; }
    return n;
  };
  const evs = (w, secs, inp) => { const out = []; run(w, secs, inp, (w2) => { out.push(...w2.events); }); return out; };
  // a hero floating in the air at (x, y), nothing under him for a while
  const putAir = (w, x, y) => Object.assign(w.hero, { x, y, vx: 0, vy: 0, ground: -1, float: false, holdT: S.P.holdMax, state: 'play', inv: 0 });
  const putOn = (w, i, x) => { const p = w.plats[i]; Object.assign(w.hero, { x: x != null ? x : (p.x0 + p.x1) / 2, y: p.y, vx: 0, vy: 0, ground: i, float: false, state: 'play', inv: 0 }); };

  const CHECKS = {};

  // ---------- the glowing candy follows its order rule ----------
  CHECKS.glowOrder = (sab) => {
    const fails = [];
    let grabs = 0, glowPts = 0;
    for (let s = 0; s < L.SCREENS.length; s++) {
      for (const seed of [1, 2, 3]) {
        const w = lab({ sab, round: s + 1, seed });
        if (w.glow !== 0) fails.push(`screen ${s}: the first glowing candy is #${w.glow}, not #0`);
        const r = S.rng(seed * 31 + s);
        // grab in a mixed order: sometimes the glowing one, sometimes a random one
        while (w.phase === 'play') {
          const left = w.candies.filter((c) => !c.got);
          const pick = r() < 0.5 && w.glow >= 0 ? w.candies[w.glow] : left[Math.floor(r() * left.length)];
          const wasGlow = pick.i === w.glow, before = w.score;
          w.events.length = 0;
          S.grab(w, pick);
          grabs++;
          const pts = w.events.find((e) => e.type === 'candy').pts;
          if (wasGlow) glowPts++;
          if (pts !== (wasGlow ? S.PTS.glow : S.PTS.candy)) fails.push(`screen ${s}: candy #${pick.i} gave ${pts}`);
          if (w.phase !== 'play') break;
          // the rule: the next uneaten candy after the one just grabbed, in the order, wrapping round
          let want = -1;
          for (let k = 1; k <= w.candies.length; k++) { const c = w.candies[(pick.i + k) % w.candies.length]; if (!c.got) { want = c.i; break; } }
          if (w.glow !== want) { fails.push(`screen ${s} seed ${seed}: after #${pick.i} the glow went to #${w.glow}, not #${want}`); break; }
          if (w.score - before < pts) fails.push('score did not go up');
        }
      }
    }
    // grabbing the glowing one every time: all 24 glow, and the perfect bonus
    const w = lab({ sab });
    while (w.phase === 'play') S.grab(w, w.candies[w.glow >= 0 ? w.glow : w.candies.findIndex((c) => !c.got)]);
    if (w.glowGot !== 24) fails.push(`always the glowing one: ${w.glowGot} of 24 glowed`);
    if (w.bonus !== 24 * S.PTS.glowBonus + S.PTS.perfect) fails.push(`perfect bonus ${w.bonus}`);
    return { ok: !fails.length, info: fails.length ? fails.slice(0, 4).join('; ') : `${grabs} grabs on 4 screens follow the order (${glowPts} glowing); always glowing = 24/24 and ${w.bonus} bonus` };
  };

  // ---------- collecting all 24 ends the round ----------
  CHECKS.roundEnds = (sab) => {
    const fails = [];
    for (let s = 0; s < L.SCREENS.length; s++) {
      const w = lab({ sab, round: s + 1 });
      if (w.candies.length !== 24) fails.push(`screen ${s} has ${w.candies.length} candies`);
      // walk the hero into them with the real touch test: put him on each candy
      for (let k = 0; k < 23; k++) {
        const c = w.candies.find((x) => !x.got);
        putAir(w, c.x, c.y - 0.6);
        S.step(w, null);
        if (!c.got) { fails.push(`screen ${s}: touching candy #${c.i} did not grab it`); break; }
      }
      if (w.phase !== 'play') fails.push(`screen ${s}: the round ended at ${w.got} candies`);
      const last = w.candies.find((x) => !x.got);
      if (!last) continue;
      putAir(w, last.x, last.y - 0.6);
      const e = evs(w, S.DT);
      if (w.phase !== 'clear' || !e.some((x) => x.type === 'clear')) fails.push(`screen ${s}: all 24 grabbed but the phase is ${w.phase}`);
      run(w, 4);
      if (w.round !== s + 2 || w.screen !== (s + 1) % 4 || w.got !== 0 || w.candies.some((c) => c.got)) fails.push(`screen ${s}: the next round did not start fresh (round ${w.round}, screen ${w.screen})`);
    }
    return { ok: !fails.length, info: fails.length ? fails.slice(0, 4).join('; ') : 'on all 4 screens 23 candies keep playing, the 24th clears, and the next screen starts with 24 new ones' };
  };

  // ---------- jump height and floating are the same at 30, 60 and 120 fps ----------
  // the keys, as times in seconds (all on 1/30 s frames): presses of jump, how long jump is held, ← →, ↓
  const SCRIPT = { press: [0.2, 0.9, 3.4, 3.6, 5.4, 6], holdTill: { 0.2: 0.7, 3.4: 3.4 + 1 / 30, 5.4: 5.8 }, down: [2], right: [[0, 0.6], [3.6, 4.2]], left: [[1.4, 2.2], [6, 6.4]] };
  function jumpRun(fps, sab, level) {
    const w = lab({ sab, level });
    const h = w.hero;
    const out = [];
    const frames = Math.round(8 * fps);
    let maxY = 0, minFloatV = 0;
    for (let k = 0; k < frames; k++) {
      const t = k / fps;
      let pressed = SCRIPT.press.some((p) => near(p, t, 1e-7)), downP = SCRIPT.down.some((p) => near(p, t, 1e-7));
      const hold = Object.entries(SCRIPT.holdTill).some(([a, b]) => t >= +a - 1e-9 && t < b - 1e-9);
      const lr = SCRIPT.right.some(([a, b]) => t >= a - 1e-9 && t < b - 1e-9) ? 1 : SCRIPT.left.some(([a, b]) => t >= a - 1e-9 && t < b - 1e-9) ? -1 : 0;
      S.advance(w, 1 / fps, () => { const i = { lr, jump: pressed, hold: hold || pressed, down: downP, downPress: downP }; pressed = downP = false; return i; }, () => {
        maxY = Math.max(maxY, h.y);
        if (h.float) minFloatV = Math.min(minFloatV, h.vy);
      });
      const k30 = ((k + 1) * 30) / fps;
      if (near(k30, Math.round(k30), 1e-7)) out.push([h.x, h.y, h.vy, h.jumps, h.floats]);
    }
    return { out, maxY, minFloatV };
  }
  CHECKS.jumpFps = (sab) => {
    const fails = [], info = [];
    for (const level of ['easy', 'normal']) {
      const a = jumpRun(30, sab, level), b = jumpRun(60, sab, level), c = jumpRun(120, sab, level);
      let worst = 0;
      for (let i = 0; i < a.out.length; i++) for (let j = 0; j < 5; j++) worst = Math.max(worst, Math.abs(a.out[i][j] - b.out[i][j]), Math.abs(a.out[i][j] - c.out[i][j]));
      if (worst > 1e-6) fails.push(`${level}: 30/60/120 fps differ by up to ${worst.toFixed(3)}`);
      if (!near(a.maxY, b.maxY, 1e-6) || !near(a.maxY, c.maxY, 1e-6)) fails.push(`${level}: top of the jump ${a.maxY.toFixed(3)} / ${b.maxY.toFixed(3)} / ${c.maxY.toFixed(3)} m`);
      if (!near(a.minFloatV, b.minFloatV, 1e-6) || !near(a.minFloatV, c.minFloatV, 1e-6)) fails.push(`${level}: float speed ${a.minFloatV.toFixed(2)} / ${b.minFloatV.toFixed(2)} / ${c.minFloatV.toFixed(2)} m/s`);
      const fl = a.out[a.out.length - 1][4];
      if (fl < 3) fails.push(`${level}: the script floated only ${fl} times`);
      info.push(`${level} top ${b.maxY.toFixed(2)} m, float ${(-b.minFloatV).toFixed(2)} m/s`);
    }
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : `same path at 30, 60 and 120 fps (${info.join('; ')})` };
  };

  // ---------- holding jumps higher; the cape floats you down slowly ----------
  CHECKS.holdAndFloat = () => {
    const fails = [];
    const top = (holdSecs) => {
      const w = lab();
      let peak = 0;
      run(w, 3, (w2, i) => ({ jump: i === 0, hold: i * S.DT < holdSecs }), (w2) => { peak = Math.max(peak, w2.hero.y); });
      return peak;
    };
    const tap = top(0), full = top(2);
    if (!(full > 2.2 * tap)) fails.push(`holding: ${full.toFixed(2)} m, a tap: ${tap.toFixed(2)} m`);
    if (!(full > 8.5 && full < 10)) fails.push(`a full jump goes ${full.toFixed(2)} m`);
    for (const level of ['easy', 'normal']) {
      const w = lab({ level });
      putAir(w, 3.5, 11); // a clear column on the pyramid: no platform under it
      run(w, 0.3);
      const vFall = -w.hero.vy;
      putAir(w, 3.5, 11);
      S.step(w, { jump: true });
      run(w, 1);
      const vFloat = -w.hero.vy;
      if (!(w.hero.float && near(vFloat, S.LV[level].floatFall, 1e-6) && vFloat < vFall / 3)) fails.push(`${level}: floating ${vFloat.toFixed(2)} m/s, falling ${vFall.toFixed(2)} m/s`);
      run(w, 8);
      if (w.hero.float || w.hero.ground !== 0) fails.push(`${level}: still floating after landing`);
    }
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : `a tap ${tap.toFixed(2)} m, holding ${full.toFixed(2)} m; the cape falls at ${S.LV.easy.floatFall} (EASY) / ${S.LV.normal.floatFall} (NORMAL) m/s` };
  };

  // ---------- platforms: up through from below, land on top, ↓ drops through, the floor holds, walk off the edge ----------
  CHECKS.platforms = () => {
    const fails = [];
    for (let s = 0; s < L.SCREENS.length; s++) {
      const w = lab({ round: s + 1 });
      for (let i = 1; i < w.plats.length; i++) {
        const p = w.plats[i], cx = (p.x0 + p.x1) / 2;
        // from below: up through and land on it
        putAir(w, cx, p.y - 1.6);
        w.hero.vy = 11;
        run(w, 1.5, null, (w2) => w2.hero.ground < 0);
        if (w.hero.ground !== i) { fails.push(`screen ${s} platform ${i}: jumping up from below landed on ${w.hero.ground} at ${w.hero.y.toFixed(2)}`); continue; }
        // ↓ drops through
        run(w, 0.4, { down: true, downPress: true });
        if (!(w.hero.y < p.y - 0.3)) fails.push(`screen ${s} platform ${i}: ↓ did not drop through (y ${w.hero.y.toFixed(2)})`);
        // walk off the edge: fall
        const toRight = p.x1 < L.HALF - 1; // off the side that isn't against a wall
        putOn(w, i, toRight ? p.x1 - 0.5 : p.x0 + 0.5);
        run(w, 0.6, { lr: toRight ? 1 : -1 });
        if (!(w.hero.y < p.y - 0.3)) fails.push(`screen ${s} platform ${i}: walking off the edge did not fall`);
      }
      putOn(w, 0, 0);
      run(w, 0.5, { down: true, downPress: true });
      if (w.hero.y !== 0 || w.hero.ground !== 0) fails.push(`screen ${s}: ↓ went through the floor`);
    }
    return { ok: !fails.length, info: fails.length ? fails.slice(0, 4).join('; ') : 'every platform on every screen: up through it from below, land on top, ↓ drops through, walk off the edge; the floor holds' };
  };

  // ---------- flyers turn into coins after the power ball ----------
  CHECKS.coins = (sab) => {
    const fails = [];
    for (const level of ['easy', 'normal']) {
      const w = lab({ level, sab });
      for (let i = 0; i < 4; i++) S.spawnFlyer(w);
      putOn(w, 0, -8);
      run(w, 1.2); // out of their clouds
      if (!w.flyers.every((f) => f.state === 'fly')) fails.push(`${level}: flyers not flying`);
      // the ball, right on the hero
      S.spawnBall(w, w.hero.x, w.hero.y + 0.8);
      const e = evs(w, S.DT);
      if (!e.some((x) => x.type === 'power') || w.ball) { fails.push(`${level}: touching the ball did nothing`); continue; }
      const coins = w.flyers.filter((f) => f.state === 'coin').length;
      if (coins !== 4) fails.push(`${level}: ${coins} of 4 flyers turned into coins`);
      // touch two coins (spread out, still): points that double
      w.flyers.forEach((f, i) => Object.assign(f, { x: -6 + i * 4, y: 10, vx: 0, vy: 0 }));
      const got = [];
      for (let k = 0; k < 2; k++) {
        const f = w.flyers.find((x) => x.state === 'coin');
        if (!f) break;
        putAir(w, f.x, f.y - 0.6);
        const e2 = evs(w, S.DT);
        const c = e2.find((x) => x.type === 'coin');
        if (c) got.push(c.pts);
      }
      if (got.join() !== '200,400') fails.push(`${level}: coins gave ${got.join()}`);
      // a coin touching the hero never bumps him
      if (w.phase !== 'play' || w.lives !== S.LV[level].lives) fails.push(`${level}: a coin bumped the hero`);
      // after the power time the coins fly again
      putOn(w, 0, 9.5);
      run(w, S.LV[level].power + 0.1);
      if (w.flyers.some((f) => f.state === 'coin') || !w.flyers.some((f) => f.state === 'fly')) fails.push(`${level}: the coins did not turn back into flyers`);
    }
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : 'the power ball turns every flyer into a coin (EASY 8 s, NORMAL 5.5 s): 200, 400 points, no bumps, then they fly again' };
  };

  // ---------- bumps, lives, respawn, game over ----------
  CHECKS.bumps = () => {
    const fails = [];
    for (const level of ['easy', 'normal']) {
      const w = lab({ level });
      const lives = S.LV[level].lives;
      let respawns = 0;
      for (let k = 0; k < lives; k++) {
        if (w.phase === 'ready') run(w, 1.3);
        w.hero.inv = 0;
        S.spawnFlyer(w);
        const f = w.flyers[w.flyers.length - 1];
        f.state = 'fly';
        f.x = w.hero.x + 0.3;
        f.y = w.hero.y + 0.7;
        f.vx = f.vy = 0;
        S.step(w, null);
        if (w.phase !== 'dizzy') { fails.push(`${level}: a flyer touching the hero did not bump him`); break; }
        const e = evs(w, 2.2);
        if (e.some((x) => x.type === 'respawn')) respawns++;
        // safe for a moment after coming back
        if (w.phase === 'ready' && !(w.hero.inv > 1.5)) fails.push(`${level}: no safe time after respawn`);
      }
      if (w.phase !== 'over' || respawns !== lives - 1) fails.push(`${level}: after ${lives} bumps phase ${w.phase}, ${respawns} respawns`);
    }
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : 'a bump: dizzy, a life gone, the flyers puff away, back with 2.2 s safe; EASY 5 lives, NORMAL 3, then game over' };
  };

  // ---------- the brother: his move, a treat, then a power ball (2 players: a high five, no ball) ----------
  CHECKS.buddy = (sab) => {
    const fails = [];
    const w = lab({ sab, who: 'tommy' });
    putOn(w, 0, -3);
    S.call(w);
    if (!w.buddy || w.buddy.who !== 'teddy') fails.push('Tommy called, but no Teddy');
    let e = evs(w, 3.5);
    const ty = e.map((x) => x.type);
    if (!ty.includes('treat')) fails.push('no treat');
    if (!ty.includes('helper')) fails.push('no "TEDDY SAYS"');
    if (!ty.includes('ball') || !w.ball || w.ball.from !== 'buddy') fails.push('no power ball from the brother');
    // call again and again: each call is another visit and another ball
    S.call(w); S.call(w); S.call(w);
    e = evs(w, 12);
    const balls = e.filter((x) => x.type === 'ball').length;
    if (balls !== 3) fails.push(`3 more calls lit ${balls} balls`);
    // 2 players: a high five
    const w2 = lab({ sab, two: true });
    S.call(w2);
    const e2 = evs(w2, 3.5).map((x) => x.type);
    if (!e2.includes('hi5') || e2.includes('ball')) fails.push('2 players: no high five (or a ball)');
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : 'Teddy pops in for Tommy, a treat, "TEDDY SAYS", a power ball; 3 more calls = 3 more balls; 2 players: a high five' };
  };

  // ---------- 2 players take turns ----------
  CHECKS.turns = () => {
    const fails = [];
    const m = S.createMatch({ players: ['teddy', 'tommy'], level: 'normal' });
    const bumpCur = () => {
      const w = m.ws[m.turn];
      while (w.phase === 'ready') { S.step(w, null); S.matchAfter(m); }
      w.hero.inv = 0;
      S.spawnFlyer(w);
      const f = w.flyers[w.flyers.length - 1];
      Object.assign(f, { state: 'fly', x: w.hero.x, y: w.hero.y + 0.7, vx: 0, vy: 0 });
      for (let i = 0; i < 300 && !m.over; i++) { const before = m.turn; S.step(w, null); S.matchAfter(m); if (m.turn !== before) break; if (w.phase === 'over') break; }
    };
    const turns = [m.turn];
    for (let k = 0; k < 6 && !m.over; k++) { bumpCur(); turns.push(m.turn); }
    if (turns.slice(0, 6).join('') !== '010101') fails.push(`turns went ${turns.join('')}`);
    if (!m.over || m.ws.some((w) => w.phase !== 'over')) fails.push('both out of lives but the match is not over');
    // one brother out: the other keeps playing
    const m2 = S.createMatch({ players: ['teddy', 'tommy'], level: 'easy' });
    m2.ws[1].lives = 0; m2.ws[1].phase = 'over';
    const w0 = m2.ws[0];
    while (w0.phase === 'ready') S.step(w0, null);
    w0.hero.inv = 0;
    S.bump(w0, { kind: 'bird' });
    for (let i = 0; i < 300; i++) { S.step(w0, null); S.matchAfter(m2); }
    if (m2.turn !== 0 || w0.phase === 'over') fails.push('with Tommy out, Teddy lost his turn');
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : 'a lost life passes the turn (Teddy, Tommy, Teddy...), each brother keeps his own screen and score; one out = the other plays on' };
  };

  // ---------- the autopilot reaches every candy on every screen (no flyers): nothing is out of reach ----------
  CHECKS.reach = () => {
    const fails = [], info = [];
    for (const level of ['easy', 'normal']) {
      for (let s = 0; s < L.SCREENS.length; s++) {
        const w = lab({ level, round: s + 1 });
        let t = 0;
        while (t < 150 && w.round === s + 1 && w.phase !== 'clear') { S.step(w, CJ.bot.decide(w)); t += S.DT; }
        if (w.got < 24 && w.phase !== 'clear') fails.push(`${level} screen ${s}: ${w.got}/24 after ${t.toFixed(0)} s`);
        else info.push(`${t.toFixed(0)}s`);
      }
    }
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : `the autopilot grabbed all 24 on every screen (${info.join(' ')})` };
  };

  const SABOTAGES = [
    ['glowLowest', 'the glow goes to the lowest uneaten candy', 'glowOrder'],
    ['roundEarly', 'the round ends at 23 candies', 'roundEnds'],
    ['frameJump', 'a jump as strong as the frame is long', 'jumpFps'],
    ['frameFloat', 'a float as fast as the frame is long', 'jumpFps'],
    ['noCoins', 'the power ball leaves the flyers as they are', 'coins'],
    ['lazyBuddy', 'the brother never lights a power ball', 'buddy'],
  ];

  CJ.check = {
    names: Object.keys(CHECKS),
    run(only) {
      const results = [];
      for (const name of only || Object.keys(CHECKS)) {
        let r;
        try { r = CHECKS[name](null); } catch (e) { r = { ok: false, info: 'threw ' + ((e && e.stack) || e) }; }
        results.push({ name, ok: r.ok, info: r.info });
      }
      const failed = results.filter((r) => !r.ok).map((r) => r.name);
      return { ok: !failed.length, results, failed };
    },
    fail() {
      const caught = SABOTAGES.map(([sab, what, check]) => {
        let r;
        try { r = CHECKS[check](sab); } catch (e) { r = { ok: false, info: 'threw ' + e }; }
        return { sabotage: sab, what, check, caught: !r.ok, failed: [r.info] };
      });
      return { ok: caught.every((c) => c.caught), caught };
    },
    lab, putAir, putOn,
  };
})(typeof window !== 'undefined' ? window : globalThis);
