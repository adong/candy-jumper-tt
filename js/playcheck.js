/* TT Candy Jumper: the real-key play check. It presses keys with real keydown/keyup events on window and taps the touch
   buttons with pointer events, never the autopilot, and reads where the hero is drawn on the screen (his 3D body through
   the camera). Time runs with game.step, the same advance() the frames use.
     game.playCheck()           every check; { ok, total, failed }
     game.playCheck('mirror')   with ← and → swapped in the input layer: the direction checks must fail
     game.playCheck('stuck')    with the hero frozen whenever he stands on a platform (in the rules): the stuck checks must fail
     game.playCheck.prove()     runs both and says whether each one was caught */
(function () {
  'use strict';
  const L = CJ.levels, S = CJ.sim;
  const KEYS = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's', Space: ' ', Enter: 'Enter', KeyP: 'p', KeyT: 't', Escape: 'Escape' };
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: KEYS[code] || code, bubbles: true, cancelable: true }));
  const down = (code) => key('keydown', code), up = (code) => key('keyup', code);
  let pid = 40;
  const btn = (k) => document.querySelector(`#touch [data-k="${k}"]`);
  const touch = (b, on) => { const id = on ? ++pid : pid; b.dispatchEvent(new PointerEvent(on ? 'pointerdown' : 'pointerup', { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true })); };
  const step = (s) => game.step(s, { draw: false });
  const W = () => game.world();
  const H = () => W().hero;

  function run(sab) {
    const fails = [];
    let total = 0;
    const ok = (cond, what, kind) => { total++; if (!cond) fails.push((kind || 'dir') + ': ' + what); return cond; };
    const prev = { sab: game.sabotage(), simSab: game.G.simSab, auto: game.G.autoPause, touch: document.body.classList.contains('touch'), hold: game.G.hold };
    game.sabotage(sab === 'mirror' ? 'mirror' : null);
    game.simSabotage(sab === 'stuck' ? 'stuckLand' : null);
    game.G.autoPause = false;
    game.hold(true);
    const release = () => { for (const c of Object.keys(KEYS)) up(c); document.querySelectorAll('#touch [data-k]').forEach((b) => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: pid }))); };

    // which keys and buttons move the hero; 2 players take turns, and either set of keys moves whoever's turn it is
    const SETS = [
      { name: '1P Teddy ← →', start: { players: 1, who: 'teddy' }, l: 'ArrowLeft', r: 'ArrowRight', jump: 'Space', down: 'ArrowDown' },
      { name: '1P Teddy A D', start: { players: 1, who: 'teddy' }, l: 'KeyA', r: 'KeyD', jump: 'KeyW', down: 'KeyS' },
      { name: '1P Tommy ← →', start: { players: 1, who: 'tommy' }, l: 'ArrowLeft', r: 'ArrowRight', jump: 'ArrowUp', down: 'ArrowDown' },
      { name: "2P Teddy's turn", start: { players: 2 }, turn: 0, l: 'ArrowLeft', r: 'ArrowRight', jump: 'Space', down: 'ArrowDown' },
      { name: "2P Tommy's turn", start: { players: 2 }, turn: 1, l: 'KeyA', r: 'KeyD', jump: 'KeyW', down: 'KeyS' },
      { name: '1P touch', start: { players: 1, who: 'tommy' }, touch: true },
      { name: "2P touch, Tommy's turn", start: { players: 2 }, turn: 1, touch: true },
    ];
    const hold = (set, what, on) => {
      if (set.touch) touch(btn(what === 'l' ? 'l' : what === 'r' ? 'r' : what), on);
      else (on ? down : up)(set[what]);
    };
    const begin = (set, level, round) => {
      document.body.classList.toggle('touch', !!set.touch);
      game.start(Object.assign({ level, round, go: true }, set.start));
      if (set.turn != null) game.setTurn(set.turn);
      game.quiet();
    };
    // → then ← from wherever put() puts him: the drawn body moves that way on the screen
    const sideways = (set, tag, put) => {
      for (const [what, sign] of [['r', 1], ['l', -1]]) {
        put();
        step(1 / 60);
        const a = game.drawn();
        hold(set, what, true);
        step(0.3);
        hold(set, what, false);
        const b = game.drawn();
        const dx = b.sx - a.sx;
        ok(sign > 0 ? dx > 20 : dx < -20, `${tag}: ${what === 'r' ? '→' : '←'} moved ${dx.toFixed(0)} px on screen`, set.stuckKind || 'dir');
        step(0.2);
      }
    };
    const jumpUp = (set, tag, put, kind) => {
      put();
      step(1 / 60);
      const a = game.drawn();
      hold(set, 'jump', true);
      step(0.25);
      const b = game.drawn();
      hold(set, 'jump', false);
      ok(a.sy - b.sy > 20, `${tag}: jump moved ${(a.sy - b.sy).toFixed(0)} px up the screen`, kind || 'dir');
      step(0.05);
    };

    try {
      // ---------- every direction moves the way it shows, on every screen, both levels, keys and touch ----------
      for (const level of ['easy', 'normal']) {
        for (let round = 1; round <= L.SCREENS.length; round++) {
          for (const set of SETS) {
            begin(set, level, round);
            const tag = `${level} round ${round} ${set.name}`;
            const plats = W().plats;
            // on the floor in the middle, and against each wall
            sideways(set, `${tag} floor`, () => game.put(0, 0, { ground: 0 }));
            jumpUp(set, `${tag} floor`, () => game.put(0, 0, { ground: 0 }));
            game.put(-L.HALF + S.HW, 0, { ground: 0 });
            step(1 / 60);
            let a = game.drawn();
            hold(set, 'r', true); step(0.3); hold(set, 'r', false);
            ok(game.drawn().sx - a.sx > 20, `${tag}: → away from the left wall`, 'stuck');
            game.put(L.HALF - S.HW, 0, { ground: 0 });
            step(1 / 60);
            a = game.drawn();
            hold(set, 'l', true); step(0.3); hold(set, 'l', false);
            ok(game.drawn().sx - a.sx < -20, `${tag}: ← away from the right wall`, 'stuck');
            // in the air: steering works, and a second press opens the cape and he floats down slowly
            game.put(0, 0, { ground: 0 });
            hold(set, 'jump', true); step(0.3); hold(set, 'jump', false);
            step(0.1);
            hold(set, 'jump', true); step(1 / 60); hold(set, 'jump', false);
            ok(H().float, `${tag}: a second press in the air opens the cape`);
            step(0.3);
            a = game.drawn();
            step(0.5);
            const fall = game.drawn().sy - a.sy, vy = H().vy;
            ok(H().float ? Math.abs(vy + S.LV[level].floatFall) < 1e-6 && fall > 0 && fall < 120 : H().ground >= 0, `${tag}: floating down ${fall.toFixed(0)} px in 0.5 s (vy ${vy.toFixed(2)})`);
            sideways(set, `${tag} in the air`, () => game.put(0, 8, {}));
            // every platform: walk both ways, jump off, ↓ drops through
            for (let i = 1; i < plats.length; i++) {
              const p = plats[i], cx = (p.x0 + p.x1) / 2;
              const on = () => game.put(cx, p.y, { ground: i });
              sideways(Object.assign({}, set, { stuckKind: 'stuck' }), `${tag} platform ${i}`, on);
              jumpUp(set, `${tag} platform ${i}`, on, 'stuck');
              on();
              step(1 / 60);
              a = game.drawn();
              hold(set, 'down', true); step(0.3); hold(set, 'down', false);
              ok(H().y < p.y - 0.2 && game.drawn().sy - a.sy > 15, `${tag} platform ${i}: ↓ dropped to ${H().y.toFixed(2)}`, 'stuck');
            }
            release();
          }
        }
      }
      document.body.classList.toggle('touch', false);
      const K = SETS[0];
      const canMove = (tag) => {
        sideways(Object.assign({}, K, { stuckKind: 'stuck' }), tag, () => game.put(0, 0, { ground: 0 }));
        jumpUp(K, tag, () => game.put(0, 0, { ground: 0 }), 'stuck');
      };

      // ---------- nothing leaves him stuck ----------
      // a bump: dizzy, back on his feet, keys work again
      begin(K, 'easy', 1);
      down('ArrowRight');
      CJ.sim.spawnFlyer(W());
      Object.assign(W().flyers[0], { state: 'fly', x: H().x + 0.3, y: H().y + 0.7, vx: 0, vy: 0 });
      step(0.1);
      ok(W().phase === 'dizzy', 'a flyer bumped the hero', 'stuck');
      up('ArrowRight');
      step(3.6);
      game.quiet();
      ok(W().phase === 'play' && H().state === 'play', `after a bump: phase ${W().phase}`, 'stuck');
      canMove('after a bump');
      // the brother's visit (T): keys work while he is here and after he goes
      begin(K, 'easy', 2);
      down('KeyT'); up('KeyT');
      step(0.8);
      ok(!!W().buddy, 'T called the brother', 'stuck');
      canMove('while the brother visits');
      step(4);
      canMove('after the brother lit a power ball');
      // a key let go during the pause does not stay held
      begin(K, 'easy', 3);
      game.put(0, 0, { ground: 0 });
      down('ArrowRight'); step(0.1);
      down('KeyP'); up('KeyP');
      up('ArrowRight');
      down('KeyP'); up('KeyP');
      step(0.05);
      game.put(0, 0, { ground: 0 });
      step(0.4);
      ok(Math.abs(H().x) < 0.05 && game.state().screen === 'play', `→ let go during the pause: drifted to x ${H().x.toFixed(2)}`, 'stuck');
      canMove('after the pause');
      // the window loses focus with a key held
      down('ArrowLeft'); step(0.1);
      window.dispatchEvent(new Event('blur'));
      game.put(0, 0, { ground: 0 });
      step(0.4);
      ok(Math.abs(H().x) < 0.05, `blur with ← held: drifted to x ${H().x.toFixed(2)}`, 'stuck');
      canMove('after a blur');
      // every candy grabbed: the next screen starts and the keys work there
      begin(K, 'normal', 4);
      const w4 = W();
      w4.candies.slice(0, 23).forEach((c) => CJ.sim.grab(w4, c));
      const last = w4.candies[23];
      game.put(last.x, last.y - 0.6, {});
      step(0.1);
      ok(w4.phase === 'clear', `the 24th candy cleared the screen (${w4.phase})`, 'stuck');
      step(5.2);
      game.quiet();
      ok(W().round === 5 && W().phase === 'play', `the next screen: round ${W().round} ${W().phase}`, 'stuck');
      canMove('on the next screen');
      // 2 players: a bump passes the turn, and the keys move the other brother
      begin(SETS[3], 'easy', 1);
      CJ.sim.spawnFlyer(W());
      Object.assign(W().flyers[0], { state: 'fly', x: H().x + 0.3, y: H().y + 0.7, vx: 0, vy: 0 });
      step(2.4);
      ok(game.state().turn === 1 && W().who === 'tommy', `after Teddy's bump it is ${W().who}'s turn`, 'stuck');
      step(1.3);
      game.quiet();
      canMove("Tommy's turn");
      // the keyboard kid: every key at once for a while, then it still plays
      begin(K, 'easy', 1);
      const mash = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyT', 'Enter'];
      let seed = 7;
      const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 400; i++) {
        const c = mash[Math.floor(r() * mash.length)];
        (r() < 0.55 ? down : up)(c);
        step(1 / 50);
      }
      release();
      step(5);
      game.quiet();
      if (W().phase !== 'play') step(4);
      game.quiet();
      ok(W().phase === 'play' && H().state === 'play', `the keyboard kid: phase ${W().phase}`, 'stuck');
      canMove('after the keyboard kid');
      // touch: holding ▶ walks, holding the big ⬆ jumps higher than a tap
      const T1 = SETS[5];
      begin(T1, 'easy', 1);
      document.body.classList.add('touch');
      game.put(0, 0, { ground: 0 });
      hold(T1, 'jump', true); step(1 / 60); hold(T1, 'jump', false);
      let top = 0;
      for (let i = 0; i < 90; i++) { step(1 / 60); top = Math.max(top, H().y); }
      game.put(0, 0, { ground: 0 });
      hold(T1, 'jump', true);
      let top2 = 0;
      for (let i = 0; i < 90; i++) { step(1 / 60); top2 = Math.max(top2, H().y); }
      hold(T1, 'jump', false);
      ok(top2 > top * 2, `touch: holding ⬆ jumped ${top2.toFixed(1)} m, a tap ${top.toFixed(1)} m`);
      release();
    } catch (e) {
      fails.push('threw: ' + ((e && e.stack) || e));
    } finally {
      release();
      game.sabotage(prev.sab);
      game.simSabotage(prev.simSab);
      game.G.autoPause = prev.auto;
      document.body.classList.toggle('touch', prev.touch);
      game.showTitle();
      game.hold(prev.hold);
    }
    return { ok: !fails.length, total, failed: fails };
  }

  game.playCheck = run;
  game.playCheck.prove = () => {
    const m = run('mirror'), s = run('stuck');
    const mirror = { caught: m.failed.some((f) => f.startsWith('dir:')), failed: m.failed.length, sample: m.failed.slice(0, 3) };
    const stuck = { caught: s.failed.some((f) => f.startsWith('stuck:')), failed: s.failed.length, sample: s.failed.filter((f) => f.startsWith('stuck:')).slice(0, 3) };
    return { ok: mirror.caught && stuck.caught, mirror, stuck };
  };
})();
