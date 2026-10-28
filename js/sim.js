/* TT Candy Jumper: the rules, in fixed 1/120 s steps (S.advance turns any frame rate into the same steps, so a jump and a
   float are the same at 30, 60 or 120 fps). The caped hero walks, jumps very high (hold the jump key to go higher; let go
   and he comes down), and pressing jump again in the air opens the cape: he floats down slowly. He grabs the 24 fizzy
   candies; the next one in the ORDER glows, and grabbing the glowing one each time gives a big bonus. Silly flying robots
   and birds bump him (he gets dizzy and loses a life, nobody gets hurt); the wobbly power ball turns every flyer into a coin
   for a few seconds. All 24 candies end the round. Also the brother who pops in and lights up a power ball, and the
   2-player match where the brothers take turns. No Three.js here, so node runs it (tools/check.js). */
(function (root) {
  'use strict';
  const CJ = (root.CJ = root.CJ || {});
  const L = CJ.levels;
  const DT = 1 / 120;
  const HALF = L.HALF, CEIL = L.CEIL;
  const EPS = 1e-6;
  const HW = 0.38, HH = 1.3; // the hero's half width and height
  const CR = 0.35; // a candy's reach
  const P = {
    walk: 6, groundAcc: 50, airAcc: 26, jump: 14, grav: 30, gravHold: 9, holdMax: 0.8, maxFall: 15,
    gravFloat: 5, drop: 0.28,
  };
  const LV = {
    easy: { lives: 5, bird: 1.5, robot: 1.15, start: 1, max: 3, every: 11, power: 8, floatFall: 1.8, ballSpeed: 1.8 },
    normal: { lives: 3, bird: 2.5, robot: 2, start: 2, max: 5, every: 7, power: 5.5, floatFall: 2.2, ballSpeed: 2.4 },
  };
  const PTS = { candy: 100, glow: 300, glowBonus: 500, perfect: 10000, coin: 200, ball: 1000, treat: 100, hi5: 50, life: 30000 };
  const TREATS = ['🍦', '💧', '🧃', '🍪', '🍉', '🍌'];
  const BALL_AT = [8, 17]; // the power ball comes out after this many candies
  const FR = { bird: [0.42, 0.32], robot: [0.42, 0.42] }; // a flyer's half size

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ev = (w, type, o) => w.events.push(Object.assign({ type }, o));

  // ---------- a new game for one hero ----------
  function create(o) {
    o = o || {};
    const w = {
      level: o.level === 'normal' ? 'normal' : 'easy', who: o.who || 'teddy', seed: o.seed || 1, rng: rng(o.seed || 1), sab: o.sab || null,
      buddyFor: o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy')), two: !!o.two,
      t: 0, acc: 0, round: 0, screen: 0, phase: 'ready', phaseT: 0, events: [], plats: [], candies: [], glow: 0, got: 0, glowGot: 0,
      flyers: [], spawnT: 0, toSpawn: 0, kindN: 0, ball: null, balls: 0, power: 0, chain: 0, buddy: null, buddyQ: 0, calls: 0,
      score: 0, lives: LV[o.level === 'normal' ? 'normal' : 'easy'].lives, nextLife: PTS.life, candiesTotal: 0, nextId: 1,
      jumpScale: 1, floatScale: 1, hero: null, bonus: 0,
    };
    w.hero = { x: L.SPAWN.x, y: L.SPAWN.y, vx: 0, vy: 0, ground: 0, face: 1, holdT: P.holdMax, float: false, dropT: 0, dropP: -1, inv: 0, state: 'play', t: 0, jumps: 0, floats: 0, peak: 0 };
    startRound(w, o.round || 1);
    return w;
  }
  function startRound(w, n) {
    const lv = LV[w.level];
    w.round = n;
    w.screen = L.screen(n);
    w.plats = L.plats(w.screen);
    w.candies = L.SCREENS[w.screen].candies.map(([x, y], i) => ({ i, x, y, got: false }));
    w.glow = 0;
    w.got = 0;
    w.glowGot = 0;
    w.flyers = [];
    w.ball = null;
    w.balls = 0;
    w.power = 0;
    w.chain = 0;
    w.toSpawn = lv.start;
    w.spawnT = 1.6;
    w.bonus = 0;
    respawnHero(w, 0);
    ready(w);
    ev(w, 'round', { n, screen: w.screen });
  }
  function ready(w) {
    w.phase = 'ready';
    w.phaseT = 0;
  }
  function respawnHero(w, inv) {
    Object.assign(w.hero, { x: L.SPAWN.x, y: L.SPAWN.y, vx: 0, vy: 0, ground: 0, face: 1, holdT: P.holdMax, float: false, dropT: 0, dropP: -1, inv, state: 'play', t: 0 });
  }

  // ---------- the hero ----------
  const speedScale = (w) => 1 + 0.1 * L.cycle(w.round);
  function overX(x, p) { return x + HW > p.x0 && x - HW < p.x1; }
  function heroStep(w, inp) {
    const h = w.hero, lv = LV[w.level];
    const stuck = w.sab === 'stuckLand' && h.ground > 0; // the play check's sabotage: frozen on a platform
    let lr = stuck ? 0 : inp.lr || 0;
    if (lr) h.face = lr;
    const acc = h.ground >= 0 ? P.groundAcc : P.airAcc;
    const target = lr * P.walk;
    h.vx += clamp(target - h.vx, -acc * DT, acc * DT);
    if (inp.jump && !stuck) {
      if (h.ground >= 0) {
        h.vy = P.jump * w.jumpScale;
        h.ground = -1;
        h.holdT = 0;
        h.float = false;
        h.jumps++;
        h.peak = h.y;
        ev(w, 'jump');
      } else if (!h.float) {
        h.float = true;
        h.vy = Math.min(h.vy, 0);
        h.holdT = P.holdMax;
        h.floats++;
        ev(w, 'float');
      }
    }
    if (inp.down && !stuck) {
      if (h.ground > 0) { // drop through the platform you stand on
        h.dropP = h.ground;
        h.dropT = P.drop;
        h.ground = -1;
        h.vy = -1;
        ev(w, 'drop');
      } else if (h.ground < 0 && h.float && inp.downPress) { h.float = false; ev(w, 'unfloat'); }
    }
    if (h.ground < 0) {
      let g;
      if (h.float) g = P.gravFloat;
      else if (inp.hold && h.vy > 0 && h.holdT < P.holdMax) { g = P.gravHold; h.holdT += DT; }
      else { g = P.grav; h.holdT = P.holdMax; } // let go once and the boost is gone for this jump
      h.vy -= g * DT;
      const minV = h.float ? -lv.floatFall * w.floatScale : -P.maxFall;
      if (h.vy < minV) h.vy = minV;
    }
    if (h.dropT > 0) h.dropT -= DT;
    // move
    h.x += h.vx * DT;
    if (h.x > HALF - HW) { h.x = HALF - HW; h.vx = Math.min(0, h.vx); }
    if (h.x < -HALF + HW) { h.x = -HALF + HW; h.vx = Math.max(0, h.vx); }
    const prevY = h.y;
    if (h.ground >= 0) {
      const p = w.plats[h.ground];
      if (!overX(h.x, p)) { h.ground = -1; h.vy = 0; h.holdT = P.holdMax; } // walked off the edge
      else { h.y = p.y; h.vy = 0; }
    }
    if (h.ground < 0) {
      h.y += h.vy * DT;
      if (h.y > h.peak) h.peak = h.y;
      if (h.y + HH > CEIL) { h.y = CEIL - HH; if (h.vy > 0) { h.vy = 0; ev(w, 'ceiling'); } }
      if (h.vy <= 0) {
        for (let i = 0; i < w.plats.length; i++) {
          const p = w.plats[i];
          if (i === h.dropP && h.dropT > 0) continue;
          if (prevY >= p.y - EPS && h.y <= p.y && overX(h.x, p)) {
            h.y = p.y;
            h.vy = 0;
            h.ground = i;
            h.dropP = -1;
            const fl = h.float;
            h.float = false;
            ev(w, 'land', { soft: fl });
            break;
          }
        }
      }
      if (h.y < 0) { h.y = 0; h.vy = 0; h.ground = 0; h.float = false; }
    }
    if (h.inv > 0) h.inv -= DT;
    h.t += DT;
  }

  // ---------- candies and the glowing order ----------
  function nextGlow(w, from) {
    if (w.sab === 'glowLowest') { const c = w.candies.find((k) => !k.got); return c ? c.i : -1; } // the check's sabotage
    const n = w.candies.length;
    for (let k = 1; k <= n; k++) {
      const c = w.candies[(from + k) % n];
      if (!c.got) return c.i;
    }
    return -1;
  }
  function grab(w, c) {
    const glow = c.i === w.glow;
    c.got = true;
    w.got++;
    w.candiesTotal++;
    let pts = PTS.candy;
    if (glow) { w.glowGot++; pts = PTS.glow; }
    addScore(w, pts);
    w.glow = nextGlow(w, c.i);
    ev(w, 'candy', { i: c.i, x: c.x, y: c.y, glow, pts, n: w.got, streak: w.glowGot });
    if (BALL_AT.includes(w.got)) spawnBall(w, 0, 11.6, 'top');
    if (w.got >= (w.sab === 'roundEarly' ? w.candies.length - 1 : w.candies.length)) roundClear(w);
  }
  function candyStep(w) {
    const h = w.hero;
    for (const c of w.candies) {
      if (c.got) continue;
      if (Math.abs(c.x - h.x) < HW + CR && c.y > h.y - CR && c.y < h.y + HH + CR) grab(w, c);
      if (w.phase !== 'play') return;
    }
  }
  function roundClear(w) {
    w.phase = 'clear';
    w.phaseT = 0;
    const perfect = w.glowGot === w.candies.length;
    w.bonus = w.glowGot * PTS.glowBonus + (perfect ? PTS.perfect : 0);
    addScore(w, w.bonus);
    w.flyers.forEach((f) => { if (f.state !== 'gone') { f.state = 'gone'; ev(w, 'puff', { x: f.x, y: f.y, kind: f.kind }); } });
    if (w.ball) { ev(w, 'ballPop', { x: w.ball.x, y: w.ball.y }); w.ball = null; }
    w.power = 0;
    ev(w, 'clear', { glowGot: w.glowGot, bonus: w.bonus, perfect });
  }

  // ---------- flyers ----------
  function spawnFlyer(w) {
    const lv = LV[w.level];
    const kind = w.kindN++ % 2 === 0 ? 'bird' : 'robot';
    const side = w.kindN % 2 ? -1 : 1;
    const sp = lv[kind] * speedScale(w);
    const a = 0.45 + w.rng() * 0.5;
    const f = {
      id: w.nextId++, kind, x: side * 8.4, y: 12.1, vx: -side * Math.cos(a) * sp, vy: -Math.sin(a) * sp, sp, state: 'in', t: 0, turnT: 2 + w.rng() * 3,
    };
    w.flyers.push(f);
    ev(w, 'flyerIn', { id: f.id, x: f.x, y: f.y, kind });
  }
  function flyerStep(w) {
    const h = w.hero;
    const hx = h.x, hy = h.y + HH / 2;
    for (const f of w.flyers) {
      f.t += DT;
      if (f.state === 'gone') continue;
      if (f.state === 'in') { if (f.t > 0.8) { f.state = w.power > 0 && w.sab !== 'noCoins' ? 'coin' : 'fly'; f.t = 0; } continue; }
      const [hw, hh] = FR[f.kind];
      if (f.state === 'coin') { // drifts slowly, wobbling
        f.x += f.vx * 0.3 * DT;
        f.y += f.vy * 0.3 * DT;
      } else if (f.kind === 'robot') { // flies toward the hero, a bit too fast to stop: it swings past him
        const dx = hx - f.x, dy = hy - f.y, d = Math.hypot(dx, dy) || 1;
        f.vx += (dx / d) * 1.6 * DT * f.sp;
        f.vy += (dy / d) * 1.6 * DT * f.sp;
        const v = Math.hypot(f.vx, f.vy);
        if (v > f.sp) { f.vx *= f.sp / v; f.vy *= f.sp / v; }
        f.x += f.vx * DT;
        f.y += f.vy * DT;
      } else { // a bird: flies in straight lines, bouncing off the edges, and sometimes changes its mind
        f.turnT -= DT;
        if (f.turnT <= 0) {
          f.turnT = 2.5 + w.rng() * 3;
          const a = Math.atan2(f.vy, f.vx) + (w.rng() - 0.5) * 1.6;
          f.vx = Math.cos(a) * f.sp;
          f.vy = Math.sin(a) * f.sp;
          if (Math.abs(f.vy) < 0.25 * f.sp) f.vy = sign(f.vy || 1) * 0.25 * f.sp;
        }
        f.x += f.vx * DT;
        f.y += f.vy * DT;
      }
      if (f.x > HALF - hw) { f.x = HALF - hw; f.vx = -Math.abs(f.vx); }
      if (f.x < -HALF + hw) { f.x = -HALF + hw; f.vx = Math.abs(f.vx); }
      if (f.y > CEIL - hh) { f.y = CEIL - hh; f.vy = -Math.abs(f.vy); }
      if (f.y < hh + 0.05) { f.y = hh + 0.05; f.vy = Math.abs(f.vy); }
      // touching the hero
      if (h.state !== 'play' || w.phase !== 'play') continue;
      if (Math.abs(f.x - hx) < hw + HW * 0.9 && Math.abs(f.y - hy) < hh + HH / 2 * 0.85) {
        if (f.state === 'coin') {
          const pts = Math.min(PTS.coin * 2 ** w.chain, 3200);
          w.chain++;
          addScore(w, pts);
          f.state = 'gone';
          f.t = 0;
          w.toSpawn++;
          ev(w, 'coin', { x: f.x, y: f.y, pts, kind: f.kind, n: w.chain });
        } else if (f.state === 'fly' && h.inv <= 0) bump(w, f);
      }
    }
    w.flyers = w.flyers.filter((f) => f.state !== 'gone' || f.t < 1);
    // more flyers come out of the clouds at the top (not while they are coins)
    const lv = LV[w.level];
    const live = w.flyers.filter((f) => f.state !== 'gone').length;
    if (w.power <= 0 && live < lv.max) {
      w.spawnT -= DT;
      if (w.spawnT <= 0) {
        spawnFlyer(w);
        if (w.toSpawn > 0) w.toSpawn--;
        w.spawnT = w.toSpawn > 0 ? 1.6 : lv.every / speedScale(w);
      }
    }
  }
  function bump(w, f) {
    const h = w.hero;
    h.state = 'dizzy';
    h.float = false;
    h.vx = 0;
    h.vy = 2.5;
    h.ground = -1;
    w.lives--;
    w.phase = 'dizzy';
    w.phaseT = 0;
    ev(w, 'bump', { x: h.x, y: h.y, kind: f.kind, lives: w.lives });
  }

  // ---------- the wobbly power ball ----------
  function spawnBall(w, x, y, from) {
    const lv = LV[w.level];
    if (w.ball) ev(w, 'ballPop', { x: w.ball.x, y: w.ball.y });
    const a = w.rng() * Math.PI * 2;
    w.ball = { x: clamp(x, -HALF + 0.6, HALF - 0.6), y: clamp(y, 1, CEIL - 0.6), vx: Math.cos(a) * lv.ballSpeed, vy: Math.sin(a) * lv.ballSpeed, t: 0, life: 12, from };
    w.balls++;
    ev(w, 'ball', { x: w.ball.x, y: w.ball.y, from });
  }
  function ballStep(w) {
    const b = w.ball, h = w.hero;
    if (!b) return;
    b.t += DT;
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    if (b.x > HALF - 0.45) { b.x = HALF - 0.45; b.vx = -Math.abs(b.vx); }
    if (b.x < -HALF + 0.45) { b.x = -HALF + 0.45; b.vx = Math.abs(b.vx); }
    if (b.y > CEIL - 0.45) { b.y = CEIL - 0.45; b.vy = -Math.abs(b.vy); }
    if (b.y < 0.6) { b.y = 0.6; b.vy = Math.abs(b.vy); }
    if (b.t > b.life) { ev(w, 'ballPop', { x: b.x, y: b.y }); w.ball = null; return; }
    if (h.state === 'play' && w.phase === 'play' && Math.abs(b.x - h.x) < HW + 0.45 && b.y > h.y - 0.45 && b.y < h.y + HH + 0.45) power(w);
  }
  function power(w) {
    const b = w.ball;
    w.ball = null;
    w.power = LV[w.level].power;
    w.chain = 0;
    addScore(w, PTS.ball);
    if (w.sab !== 'noCoins') for (const f of w.flyers) if (f.state === 'fly' || f.state === 'in') { f.state = 'coin'; f.t = 0; }
    ev(w, 'power', { x: b.x, y: b.y, pts: PTS.ball, secs: w.power });
  }
  function powerStep(w) {
    if (w.power <= 0) return;
    w.power -= DT;
    if (w.power <= 0) {
      w.power = 0;
      for (const f of w.flyers) if (f.state === 'coin') { f.state = 'fly'; f.t = 0; }
      ev(w, 'powerEnd');
    }
  }

  // ---------- score ----------
  function addScore(w, n) {
    w.score += n;
    while (w.score >= w.nextLife) {
      w.nextLife += PTS.life;
      w.lives++;
      ev(w, 'life', { lives: w.lives });
    }
  }

  // ---------- the brother: pops in, his move, a treat, then he lights up a power ball (2 players: a high five) ----------
  function call(w) {
    if (w.phase === 'over') return false;
    w.calls++;
    if (w.buddy) { w.buddyQ = Math.min(3, w.buddyQ + 1); return true; }
    startBuddy(w);
    return true;
  }
  function startBuddy(w) {
    const h = w.hero;
    const side = h.x > 6 ? -1 : h.x < -6 ? 1 : h.face > 0 ? -1 : 1;
    w.buddy = { who: w.buddyFor(w.who), x: clamp(h.x + side * 1.6, -HALF + 0.6, HALF - 0.6), y: 0, face: -side, phase: 'in', t: 0, n: w.calls, hi5: w.two, lit: false, treat: null };
    // he stands on the floor under the hero, or on the platform the hero stands on
    if (h.ground > 0) { const p = w.plats[h.ground]; if (w.buddy.x > p.x0 + 0.3 && w.buddy.x < p.x1 - 0.3) w.buddy.y = p.y; }
    ev(w, 'buddyIn', { who: w.buddy.who, x: w.buddy.x, y: w.buddy.y, hi5: w.two });
  }
  function buddyStep(w) {
    const b = w.buddy;
    if (!b) return;
    b.t += DT;
    if (b.phase === 'in' && b.t > 0.35) { b.phase = 'sig'; b.t = 0; }
    else if (b.phase === 'sig' && b.t > (b.hi5 ? 0.9 : 1.3)) {
      b.phase = 'give';
      b.t = 0;
      if (b.hi5) { addScore(w, PTS.hi5); ev(w, 'hi5', { x: (b.x + w.hero.x) / 2, y: Math.max(b.y, w.hero.y) + 1.2, pts: PTS.hi5 }); }
      else {
        b.treat = TREATS[(b.n - 1) % TREATS.length];
        addScore(w, PTS.treat);
        ev(w, 'treat', { treat: b.treat, pts: PTS.treat, x: b.x, y: b.y });
      }
    } else if (b.phase === 'give' && b.t > 0.6) {
      b.phase = 'light';
      b.t = 0;
      if (!b.hi5) {
        ev(w, 'helper', { who: b.who });
        if (w.sab !== 'lazyBuddy') spawnBall(w, b.x, b.y + 1.9, 'buddy');
        b.lit = true;
      }
    } else if (b.phase === 'light' && b.t > (b.hi5 ? 0.1 : 0.7)) { b.phase = 'out'; b.t = 0; ev(w, 'buddyOut', { x: b.x, y: b.y }); }
    else if (b.phase === 'out' && b.t > 0.4) {
      w.buddy = null;
      if (w.buddyQ > 0) { w.buddyQ--; startBuddy(w); }
    }
  }

  // ---------- one step ----------
  const NOIN = {};
  function step(w, inp) {
    inp = inp || NOIN;
    w.t += DT;
    w.phaseT += DT;
    w.events.length = 0;
    const h = w.hero;
    if (w.phase === 'ready') {
      if (w.phaseT > 1.2) { w.phase = 'play'; w.phaseT = 0; ev(w, 'go'); }
    } else if (w.phase === 'play') {
      heroStep(w, inp);
      candyStep(w);
      if (w.phase === 'play') { flyerStep(w); ballStep(w); powerStep(w); }
    } else if (w.phase === 'dizzy') { // the hero spins with stars round his head and floats up a little; the flyers puff away
      h.vy -= 3 * DT;
      h.y = Math.max(0, h.y + h.vy * DT);
      h.t += DT;
      if (w.phaseT > 0.5) w.flyers.forEach((f) => { if (f.state !== 'gone') { f.state = 'gone'; f.t = 0; ev(w, 'puff', { x: f.x, y: f.y, kind: f.kind }); } });
      if (w.phaseT > 2) {
        if (w.ball) { ev(w, 'ballPop', { x: w.ball.x, y: w.ball.y }); w.ball = null; }
        w.power = 0;
        w.flyers = [];
        if (w.lives <= 0) { w.phase = 'over'; w.phaseT = 0; h.state = 'out'; ev(w, 'over', { score: w.score }); }
        else {
          respawnHero(w, 2.2);
          w.toSpawn = LV[w.level].start;
          w.spawnT = 2.2;
          ready(w);
          ev(w, 'respawn', { lives: w.lives });
        }
      }
    } else if (w.phase === 'clear') {
      heroStep(w, NOIN);
      if (w.phaseT > 3.6) startRound(w, w.round + 1);
    }
    if (w.phase !== 'over') buddyStep(w);
  }
  // any frame rate -> the same fixed steps; input(w) is asked once per step
  function advance(w, dt, input, after) {
    w.acc = Math.min(w.acc + dt, 0.25);
    w.jumpScale = w.sab === 'frameJump' ? dt * 60 : 1; // the check's sabotages: a jump or a float that depends on the frame rate
    w.floatScale = w.sab === 'frameFloat' ? dt * 60 : 1;
    let n = 0;
    while (w.acc >= DT - 1e-9) {
      w.acc -= DT;
      step(w, input ? input(w) : null);
      if (after) after(w);
      n++;
    }
    return n;
  }

  // ---------- 2 players take turns: each brother has his own game; a lost life passes the turn ----------
  function createMatch(o) {
    const who = o.players || ['teddy'];
    const seed = o.seed || 1;
    const m = { ws: who.map((id, i) => create(Object.assign({}, o, { who: id, seed: seed + i * 7919, two: who.length === 2 }))), turn: 0, over: false, events: [] };
    return m;
  }
  const alive = (w) => w.phase !== 'over';
  // after each step of the current world: when it respawns after a bump, or runs out of lives, the turn passes
  function matchAfter(m) {
    const w = m.ws[m.turn];
    m.events = [];
    if (m.ws.length < 2) { if (!alive(w)) m.over = true; return; }
    const other = 1 - m.turn;
    const lost = w.events.some((e) => e.type === 'respawn' || e.type === 'over');
    if (lost && alive(m.ws[other])) {
      m.turn = other;
      const o = m.ws[other];
      ready(o);
      o.buddy = null;
      o.buddyQ = 0;
      m.events.push({ type: 'turn', turn: other, who: o.who });
    } else if (!alive(w) && !alive(m.ws[other])) m.over = true;
  }

  CJ.sim = {
    DT, P, LV, PTS, TREATS, HW, HH, CR, BALL_AT, FR, create, step, advance, startRound, call, nextGlow, grab, spawnBall, spawnFlyer, power, bump, rng,
    createMatch, matchAfter,
  };
})(typeof window !== 'undefined' ? window : globalThis);
