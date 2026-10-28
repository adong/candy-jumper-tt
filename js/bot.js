/* TT Candy Jumper: the autopilot, for the title-screen demo and the headless check (every candy on every screen can be
   reached). It heads for the glowing candy (or a coin, or a close power ball), jumps holding the key until it is high
   enough, opens the cape to drift across, and drops through platforms to go down. A candy too high for one jump: it
   first hops onto the highest platform it can reach. It gives the same input the keys give: { lr, jump, hold, down }. */
(function (root) {
  'use strict';
  const CJ = (root.CJ = root.CJ || {});
  const MAXJ = 8.2; // a bit less than the highest jump, so it never comes up just short

  function target(w) {
    const h = w.hero;
    const near = (o) => Math.hypot(o.x - h.x, o.y - (h.y + 0.65));
    if (w.power > 0) {
      const coins = w.flyers.filter((f) => f.state === 'coin');
      if (coins.length) return coins.sort((a, b) => near(a) - near(b))[0];
    }
    if (w.ball && near(w.ball) < 5) return w.ball;
    if (w.glow >= 0 && !w.candies[w.glow].got) return w.candies[w.glow];
    const left = w.candies.filter((c) => !c.got);
    return left.length ? left.sort((a, b) => near(a) - near(b))[0] : null;
  }
  function decide(w) {
    const h = w.hero;
    const m = w.bot || (w.bot = { stuckT: 0, lastX: 0, lastY: 0 });
    if (w.phase !== 'play' || h.state !== 'play') return { lr: 0 };
    const t = target(w);
    if (!t) return { lr: 0 };
    let tx = t.x, want = t.y - 0.65;
    // too high for one jump from here: first hop onto the highest platform that can be reached
    if (h.ground >= 0 && want - h.y > MAXJ) {
      let best = null;
      w.plats.forEach((p, i) => {
        if (i === 0 || p.y <= h.y + 0.5 || p.y > h.y + MAXJ) return;
        const score = p.y - 0.05 * Math.abs((p.x0 + p.x1) / 2 - tx);
        if (!best || score > best.score) best = { p, score };
      });
      if (best) { tx = Math.max(best.p.x0 + 0.6, Math.min(best.p.x1 - 0.6, tx)); want = best.p.y + 0.6; }
    }
    const dx = tx - h.x, dy = want - h.y;
    const inp = { lr: Math.abs(dx) > 0.12 ? Math.sign(dx) : 0, jump: false, hold: false, down: false, downPress: false };
    if (h.ground >= 0) {
      if (dy > 0.45) { inp.jump = true; inp.hold = true; }
      else if (dy < -0.6 && h.ground > 0) { inp.down = true; inp.downPress = true; }
    } else {
      if (h.vy > 0 && !h.float) {
        inp.hold = h.y < want - 0.05;
        if (h.y >= want - 0.05 && Math.abs(dx) > 0.4) inp.jump = true; // open the cape at the right height and drift across
      }
      if (h.float && dy < -1.2) { inp.down = true; inp.downPress = true; }
    }
    // a flyer about to bump us on the ground: hop over it
    if (h.ground >= 0 && !inp.jump) {
      for (const f of w.flyers) {
        if (f.state !== 'fly') continue;
        const fx = f.x - h.x, fy = f.y - (h.y + 0.65);
        if (Math.abs(fx) < 2 && Math.abs(fy) < 1.4 && fx * f.vx < 0) { inp.jump = true; inp.hold = true; break; }
      }
    }
    return inp;
  }
  CJ.bot = { decide, target };
})(typeof window !== 'undefined' ? window : globalThis);
