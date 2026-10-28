/* TT Candy Jumper: the 3D things, chunky toy style, all painted on canvases (no image files). The four landmarks behind
   the screen (a pyramid in the desert, a castle on the hills, a city at night, a rocket base), the floor, the candy-cane
   walls, the frosted platforms with sprinkles, the wrapped fizzy candies and the glow on the next one, the capes, the silly
   birds and propeller robots, the smiley coins they turn into, the wobbly power ball, the clouds the flyers pop out of,
   dizzy stars and the confetti. js/game.js places and moves them. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx, L = CJ.levels;
  const A = (CJ.art = {});
  const PI = Math.PI;
  const mats = new Map();
  const mat = (color, o) => {
    const k = color + JSON.stringify(o || {});
    if (!mats.has(k)) mats.set(k, G.std(color, o));
    return mats.get(k);
  };
  A.mat = mat;

  // many still meshes with one material drawn as one (fewer draw calls for older iPads); from TT Balloon Bump
  function merge(meshes, material) {
    const parts = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      return g;
    });
    const cat = (name, n) => {
      const out = new Float32Array(parts.reduce((a, g) => a + g.attributes.position.count * n, 0));
      let o = 0;
      for (const g of parts) { out.set(g.attributes[name].array, o); o += g.attributes.position.count * n; }
      return new T.BufferAttribute(out, n);
    };
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', cat('position', 3));
    geo.setAttribute('normal', cat('normal', 3));
    if (parts.every((g) => g.attributes.uv)) geo.setAttribute('uv', cat('uv', 2));
    parts.forEach((g) => g.dispose());
    return material ? new T.Mesh(geo, material) : geo;
  }
  const at = (geo, x, y, z, rx, ry, rz, sx, sy, sz) => {
    const m = new T.Mesh(geo);
    m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    if (sx) m.scale.set(sx, sy || sx, sz || sx);
    return m;
  };

  // ---------- the four screens: colours ----------
  A.LOOK = [
    { floor: '#f2c66d', floorFront: '#c98f3c', body: '#d99a52', icing: '#ff8fc4', fog: '#ffd9a0' },
    { floor: '#73d66a', floorFront: '#3f9a45', body: '#a8b3c4', icing: '#ffffff', fog: '#ffd6f2' },
    { floor: '#5a6188', floorFront: '#33395c', body: '#3d4d93', icing: '#5ff0ff', fog: '#20234a' },
    { floor: '#c4cfe0', floorFront: '#8392ad', body: '#f0f4fa', icing: '#ff5a6a', fog: '#3a2a6a' },
  ];

  // ---------- the landmarks, painted ----------
  const BW = 1024, BH = 640;
  function sky(g, stops) {
    const gr = g.createLinearGradient(0, 0, 0, BH);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr;
    g.fillRect(0, 0, BW, BH);
  }
  function blob(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); }
  function cloud(g, x, y, s, col) { [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.2, 0.75], [0.4, -0.4, 0.7]].forEach(([dx, dy, r]) => blob(g, x + dx * 40 * s, y + dy * 40 * s, 40 * s * r, col)); }
  function stars(g, n, h) { for (let i = 0; i < n; i++) { const x = (i * 397) % BW, y = (i * 211) % h; g.fillStyle = `rgba(255,255,255,${0.4 + ((i * 7) % 6) / 10})`; g.fillRect(x, y, 2 + (i % 3), 2 + (i % 3)); } }
  const HORIZON = 470; // where the floor's top meets the backdrop (roughly)
  const PAINT = {
    pyramid(g) {
      sky(g, [[0, '#59c3ff'], [0.55, '#bfe9ff'], [0.75, '#ffe7a3']]);
      blob(g, 820, 120, 60, '#fff3a0');
      blob(g, 820, 120, 46, '#ffd84a');
      cloud(g, 180, 110, 1, 'rgba(255,255,255,0.9)');
      cloud(g, 560, 70, 0.7, 'rgba(255,255,255,0.85)');
      // dunes
      g.fillStyle = '#f5cf7d';
      g.beginPath(); g.moveTo(0, 430); g.quadraticCurveTo(250, 360, 520, 420); g.quadraticCurveTo(800, 470, BW, 400); g.lineTo(BW, BH); g.lineTo(0, BH); g.fill();
      // the big pyramid, and two small ones
      const pyr = (cx, base, w, h, a, b) => {
        g.fillStyle = a; g.beginPath(); g.moveTo(cx, base - h); g.lineTo(cx - w / 2, base); g.lineTo(cx, base); g.fill();
        g.fillStyle = b; g.beginPath(); g.moveTo(cx, base - h); g.lineTo(cx + w / 2, base); g.lineTo(cx, base); g.fill();
        g.strokeStyle = 'rgba(120,70,20,0.25)'; g.lineWidth = 2;
        for (let k = 1; k < 9; k++) { const y = base - (h * k) / 9, hw = (w / 2) * (1 - k / 9); g.beginPath(); g.moveTo(cx - hw, y); g.lineTo(cx + hw, y); g.stroke(); }
      };
      pyr(250, 450, 260, 150, '#f0c070', '#d9a050');
      pyr(780, 455, 220, 125, '#f0c070', '#d9a050');
      pyr(512, 470, 520, 330, '#ffcf7a', '#e8a955');
      g.fillStyle = '#9a5a20'; g.fillRect(492, 420, 40, 50); // the door
      // palms
      const palm = (x, y) => {
        g.strokeStyle = '#8a5a2a'; g.lineWidth = 10; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 50, x + 4, y - 100); g.stroke();
        g.fillStyle = '#3fbf5a';
        for (let k = 0; k < 5; k++) { const a = -PI / 2 + (k - 2) * 0.6; g.beginPath(); g.ellipse(x + 4 + Math.cos(a) * 34, y - 100 + Math.sin(a) * 18 + 10, 40, 12, a, 0, PI * 2); g.fill(); }
      };
      palm(90, 470); palm(940, 470); palm(990, 480);
    },
    castle(g) {
      sky(g, [[0, '#ffb3e0'], [0.5, '#ffe0f4'], [0.8, '#d9f3ff']]);
      // a rainbow
      ['#ff5a6a', '#ff9f43', '#ffe14a', '#5fe07a', '#4fb3ff', '#a97bff'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 14; g.beginPath(); g.arc(800, 470, 330 - i * 14, PI, 2 * PI); g.stroke(); });
      cloud(g, 160, 120, 1, '#ffffff');
      cloud(g, 900, 90, 0.8, '#ffffff');
      // hills
      g.fillStyle = '#8ee07a'; g.beginPath(); g.ellipse(200, 520, 420, 140, 0, PI, 2 * PI); g.fill();
      g.fillStyle = '#6fd36a'; g.beginPath(); g.ellipse(820, 530, 420, 150, 0, PI, 2 * PI); g.fill();
      // the castle: walls, towers with pointy roofs, flags, windows
      const stone = '#e8ecf4', shade = '#c7cfdd';
      g.fillStyle = stone; g.fillRect(340, 300, 344, 180);
      for (let x = 340; x < 684; x += 43) g.fillRect(x, 280, 26, 22);
      const tower = (x, w, top, roof) => {
        g.fillStyle = shade; g.fillRect(x - w / 2, top, w, 480 - top);
        g.fillStyle = stone; g.fillRect(x - w / 2 + 6, top, w - 12, 480 - top);
        g.fillStyle = roof; g.beginPath(); g.moveTo(x - w / 2 - 12, top); g.lineTo(x, top - w * 1.2); g.lineTo(x + w / 2 + 12, top); g.fill();
        g.strokeStyle = '#7a5a40'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, top - w * 1.2); g.lineTo(x, top - w * 1.2 - 40); g.stroke();
        g.fillStyle = '#ffd84a'; g.beginPath(); g.moveTo(x, top - w * 1.2 - 40); g.lineTo(x + 30, top - w * 1.2 - 32); g.lineTo(x, top - w * 1.2 - 24); g.fill();
        g.fillStyle = '#5a6aa8'; g.fillRect(x - 8, top + 30, 16, 26);
      };
      tower(340, 80, 210, '#ff6fae');
      tower(684, 80, 210, '#ff6fae');
      tower(512, 110, 150, '#6f9bff');
      g.fillStyle = '#9a6a40'; g.beginPath(); g.moveTo(482, 480); g.lineTo(482, 420); g.arc(512, 420, 30, PI, 2 * PI); g.lineTo(542, 480); g.fill();
      for (const x of [400, 450, 574, 624]) { g.fillStyle = '#5a6aa8'; g.fillRect(x - 8, 350, 16, 24); }
    },
    city(g) {
      sky(g, [[0, '#0d1238'], [0.6, '#27307a'], [0.85, '#5a3a8a']]);
      stars(g, 120, 360);
      blob(g, 170, 110, 50, '#fff6c8');
      blob(g, 190, 100, 44, '#27307a'); // a crescent moon
      // the skyline: towers with lit windows, a tall one with a spike
      const bld = (x, w, h, col) => {
        g.fillStyle = col; g.fillRect(x, HORIZON - h, w, h);
        for (let yy = HORIZON - h + 14; yy < HORIZON - 14; yy += 22) for (let xx = x + 8; xx < x + w - 12; xx += 18) {
          g.fillStyle = ((xx * 7 + yy * 3) % 5) < 3 ? '#ffe46b' : '#2a2f5a'; g.fillRect(xx, yy, 10, 12);
        }
      };
      bld(20, 110, 190, '#3a3f7a'); bld(140, 90, 260, '#2f3570'); bld(240, 120, 160, '#46498a');
      bld(600, 100, 230, '#3a3f7a'); bld(710, 130, 170, '#2f3570'); bld(850, 90, 280, '#46498a'); bld(950, 80, 150, '#3a3f7a');
      // the big tower in the middle
      g.fillStyle = '#5a5fb0'; g.fillRect(450, 150, 124, 320);
      g.fillStyle = '#6f74c8'; g.fillRect(470, 100, 84, 60);
      g.fillStyle = '#8a8fe0'; g.fillRect(492, 50, 40, 50);
      g.strokeStyle = '#ff6fd8'; g.lineWidth = 6; g.beginPath(); g.moveTo(512, 50); g.lineTo(512, 0); g.stroke();
      blob(g, 512, 6, 9, '#ff6fd8');
      for (let yy = 170; yy < 460; yy += 26) for (let xx = 462; xx < 560; xx += 22) { g.fillStyle = ((xx + yy) % 4) < 3 ? '#fff08a' : '#3a3f7a'; g.fillRect(xx, yy, 12, 14); }
      g.fillStyle = '#ff6fd8'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('🍬', 512, 140);
    },
    rocket(g) {
      sky(g, [[0, '#1a1450'], [0.55, '#5a3aa8'], [0.82, '#ff9ad0']]);
      stars(g, 90, 300);
      blob(g, 860, 120, 58, '#ffcf6b');
      g.strokeStyle = '#ffe9b0'; g.lineWidth = 8; g.beginPath(); g.ellipse(860, 120, 100, 22, -0.25, 0, PI * 2); g.stroke();
      blob(g, 150, 90, 26, '#7fe3ff');
      // the launch tower and the rocket
      g.strokeStyle = '#ff9f43'; g.lineWidth = 8;
      g.strokeRect(610, 120, 50, 350);
      for (let y = 120; y < 470; y += 35) { g.beginPath(); g.moveTo(610, y); g.lineTo(660, y + 35); g.stroke(); }
      const cx = 512;
      g.fillStyle = '#ffffff'; g.fillRect(cx - 50, 160, 100, 290);
      g.fillStyle = '#ff5a6a'; for (let y = 200; y < 440; y += 60) g.fillRect(cx - 50, y, 100, 22);
      g.beginPath(); g.moveTo(cx - 50, 160); g.quadraticCurveTo(cx, 20, cx + 50, 160); g.fill();
      blob(g, cx, 230, 22, '#5fd3ff');
      blob(g, cx, 230, 14, '#bff3ff');
      g.fillStyle = '#4f6fff';
      g.beginPath(); g.moveTo(cx - 50, 360); g.lineTo(cx - 100, 470); g.lineTo(cx - 50, 450); g.fill();
      g.beginPath(); g.moveTo(cx + 50, 360); g.lineTo(cx + 100, 470); g.lineTo(cx + 50, 450); g.fill();
      // little domes and dishes
      g.fillStyle = '#d6def0'; g.beginPath(); g.ellipse(200, 470, 120, 70, 0, PI, 2 * PI); g.fill();
      g.fillStyle = '#c4cfe0'; g.beginPath(); g.ellipse(860, 470, 100, 60, 0, PI, 2 * PI); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.arc(320, 380, 40, 0.2, PI - 0.2); g.stroke();
      g.beginPath(); g.moveTo(320, 420); g.lineTo(320, 470); g.stroke();
    },
  };
  // the painting sits in the middle of a wider canvas; its edge columns stretch out to the sides, and the sky's top colour
  // goes above it (scene.background), so tall and wide screens never see an edge
  A.backdrop = function (screen) {
    const [src, g] = G.makeCanvas(BW, BH);
    PAINT[L.SCREENS[screen].sky](g);
    g.fillStyle = 'rgba(255, 255, 255, 0.1)'; // a little softer, so the play pops
    g.fillRect(0, 0, BW, BH);
    const [c, d] = G.makeCanvas(BW + 512, BH);
    d.drawImage(src, 256, 0);
    d.drawImage(src, 0, 0, 2, BH, 0, 0, 256, BH);
    d.drawImage(src, BW - 2, 0, 2, BH, BW + 256, 0, 256, BH);
    const px = g.getImageData(4, 1, 1, 1).data;
    const m = new T.Mesh(new T.PlaneGeometry(62.4, 26), new T.MeshBasicMaterial({ map: G.toTexture(c) }));
    m.position.set(0, 7.1, -9);
    m.userData.top = `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
    return m;
  };

  // ---------- the floor and the candy-cane walls ----------
  function stripes(cols, w, h, slant) {
    const [c, g] = G.makeCanvas(w, h);
    const n = cols.length, sw = w / 4;
    for (let i = -8; i < 16; i++) {
      g.fillStyle = cols[((i % n) + n) % n];
      g.beginPath(); g.moveTo(i * sw, 0); g.lineTo(i * sw + sw, 0); g.lineTo(i * sw + sw + slant, h); g.lineTo(i * sw + slant, h); g.fill();
    }
    return c;
  }
  A.floor = function () {
    const g = new T.Group();
    const top = new T.Mesh(new T.BoxGeometry(80, 0.4, 10), mat('#ffffff', { roughness: 0.8 }));
    top.position.set(0, -0.2, -3.9);
    const front = new T.Mesh(new T.BoxGeometry(80, 30, 0.4), mat('#ffffff', { roughness: 0.8 })); // tall: it fills the bottom of tall screens
    front.position.set(0, -15.4, 1.1);
    g.add(top, front);
    g.userData.set = (look) => {
      top.material = mat(look.floor, { roughness: 0.85 });
      front.material = mat(look.floorFront, { roughness: 0.85 });
    };
    return g;
  };
  A.walls = function () {
    const tex = G.toTexture(stripes(['#ffffff', '#ff3d5a'], 128, 128, 64), true);
    tex.repeat.set(1, 10);
    const m = new T.MeshStandardMaterial({ map: tex, roughness: 0.35 });
    const g = new T.Group();
    const geo = new T.CylinderGeometry(0.3, 0.3, 15, 16);
    for (const sx of [-1, 1]) {
      const p = new T.Mesh(geo, m);
      p.position.set(sx * (L.HALF + 0.32), 6.1, 0);
      g.add(p);
      const knob = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), mat('#ff3d5a', { roughness: 0.3 }));
      knob.position.set(sx * (L.HALF + 0.32), 13.7, 0);
      g.add(knob);
    }
    const barTex = G.toTexture(stripes(['#ffffff', '#ff8fc4', '#ffffff', '#7fd8ff'], 128, 64, 32), true);
    barTex.repeat.set(14, 1);
    const bar = new T.Mesh(new T.BoxGeometry(L.HALF * 2 + 0.6, 0.28, 0.5), new T.MeshStandardMaterial({ map: barTex, roughness: 0.4 }));
    bar.position.set(0, L.CEIL + 0.18, 0);
    g.add(bar);
    return g;
  };

  // ---------- the frosted platforms, one group per screen ----------
  function sprinkleTex(base) {
    const [c, g] = G.makeCanvas(128, 64);
    g.fillStyle = base; g.fillRect(0, 0, 128, 64);
    const cols = ['#ff3d5a', '#ffd400', '#18d4ff', '#7dff5a', '#c77dff', '#ffffff', '#ff8a1f'];
    for (let i = 0; i < 40; i++) {
      g.save(); g.translate((i * 53) % 128, (i * 29) % 64); g.rotate(i); g.fillStyle = cols[i % cols.length]; G.roundRect(g, -5, -1.5, 10, 3, 1.5); g.fill(); g.restore();
    }
    return G.toTexture(c);
  }
  A.platforms = function (screen) {
    const look = A.LOOK[screen];
    const g = new T.Group();
    const body = [], icing = [], drips = [];
    const boxG = new T.BoxGeometry(1, 1, 1), dripG = new T.SphereGeometry(0.12, 8, 6);
    for (const p of L.SCREENS[screen].plats) {
      const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2;
      body.push(at(boxG, cx, p.y - 0.3, -0.1, 0, 0, 0, w - 0.1, 0.42, 1.5));
      icing.push(at(boxG, cx, p.y - 0.06, -0.1, 0, 0, 0, w + 0.06, 0.14, 1.62));
      for (let x = p.x0 + 0.35; x < p.x1 - 0.2; x += 0.62) drips.push(at(dripG, x + 0.1 * Math.sin(x * 9), p.y - 0.19, 0.66, 0, 0, 0, 1, 1.5 + 0.6 * Math.abs(Math.sin(x * 3)), 0.8));
    }
    const icingMat = new T.MeshStandardMaterial({ map: sprinkleTex(look.icing), roughness: 0.45 });
    g.add(merge(body, mat(look.body, { roughness: 0.7 })), merge(icing, icingMat), merge(drips, mat(look.icing, { roughness: 0.45 })));
    return g;
  };

  // ---------- candies ----------
  A.CANDY = ['#ff3d5a', '#ffd400', '#2f8cff', '#57d16a', '#c77dff', '#ff8a1f'];
  const candyGeo = (() => {
    const s = at(new T.SphereGeometry(0.22, 14, 10), 0, 0, 0, 0, 0, 0, 1.25, 1, 1);
    const l = at(new T.ConeGeometry(0.17, 0.26, 10), -0.36, 0, 0, 0, 0, -PI / 2);
    const r = at(new T.ConeGeometry(0.17, 0.26, 10), 0.36, 0, 0, 0, 0, PI / 2);
    return merge([s, l, r]);
  })();
  const stripeGeo = new T.TorusGeometry(0.2, 0.035, 6, 16);
  A.candy = function (i) {
    const col = A.CANDY[i % A.CANDY.length];
    const g = new T.Group();
    const m = new T.Mesh(candyGeo, new T.MeshStandardMaterial({ color: col, roughness: 0.25, emissive: col, emissiveIntensity: 0.12 }));
    g.add(m);
    const st = new T.Mesh(stripeGeo, mat('#ffffff', { roughness: 0.3 }));
    st.rotation.y = PI / 2;
    st.scale.set(1, 1.1, 1.1);
    g.add(st);
    g.userData.body = m;
    return g;
  };
  // the glow that sits on the next candy in the order
  A.glow = function () {
    const tex = G.radialTexture ? G.radialTexture(128, [[0, 'rgba(255,255,220,1)'], [0.35, 'rgba(255,230,120,0.75)'], [1, 'rgba(255,200,80,0)']]) : G.glowTexture();
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    s.scale.set(2, 2, 1);
    s.renderOrder = 2;
    const ringTex = (() => {
      const [c, g] = G.makeCanvas(128, 128);
      g.strokeStyle = '#fff6a0'; g.lineWidth = 8; g.setLineDash([14, 10]);
      g.beginPath(); g.arc(64, 64, 52, 0, PI * 2); g.stroke();
      return G.toTexture(c);
    })();
    const ring = new T.Sprite(new T.SpriteMaterial({ map: ringTex, transparent: true, depthWrite: false }));
    ring.scale.set(1.25, 1.25, 1);
    const g = new T.Group();
    g.add(s, ring);
    g.userData = { s, ring };
    return g;
  };
  // the fizz: tiny bubbles rising from every candy (one Points for all of them)
  A.fizz = function (n) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.12, map: G.dotTexture(), transparent: true, depthWrite: false, color: '#ffffff', opacity: 0.9 }));
    pts.frustumCulled = false;
    return pts;
  };

  // ---------- the hero's cape ----------
  A.CAPE = { teddy: '#ff3d5a', tommy: '#2f8cff' };
  A.cape = function (color) {
    const piv = new T.Group();
    const geo = new T.BoxGeometry(0.5, 0.74, 0.03);
    geo.translate(0, -0.36, 0);
    const c = new T.Mesh(geo, mat(color, { roughness: 0.6 }));
    piv.add(c);
    const collar = new T.Mesh(new T.BoxGeometry(0.42, 0.07, 0.08), mat(G.shade(color, -0.25), { roughness: 0.6 }));
    piv.add(collar);
    const star = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.015, 5), mat('#ffd400', { roughness: 0.4 }));
    star.rotation.x = PI / 2;
    star.position.set(0, -0.4, -0.025);
    piv.add(star);
    piv.userData.cloth = c;
    return piv;
  };

  // ---------- flyers: silly birds and propeller robots; their coins ----------
  A.BIRDS = [['#2fc9c0', '#ffe9a8'], ['#9b6bff', '#ffd6f0'], ['#ff7a9e', '#ffe2ea']];
  function eyes(g, x, y, z, r, sep) {
    for (const sx of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(r, 12, 10), mat('#ffffff', { roughness: 0.3 }));
      e.position.set(x + sx * sep, y, z);
      g.add(e);
      const p = new T.Mesh(new T.SphereGeometry(r * 0.48, 10, 8), mat('#14121f', { roughness: 0.3 }));
      p.position.set(x + sx * sep + sx * r * 0.15, y - r * 0.1, z + r * 0.72);
      g.add(p);
    }
  }
  A.bird = function (cols) {
    const g = new T.Group();
    const body = new T.Mesh(new T.SphereGeometry(0.36, 16, 12), mat(cols[0], { roughness: 0.6 }));
    body.scale.set(1.1, 0.95, 0.95);
    g.add(body);
    const belly = new T.Mesh(new T.SphereGeometry(0.26, 14, 10), mat(cols[1], { roughness: 0.6 }));
    belly.position.set(0, -0.08, 0.16);
    g.add(belly);
    eyes(g, 0, 0.13, 0.27, 0.11, 0.12);
    const beak = new T.Mesh(new T.ConeGeometry(0.08, 0.22, 8), mat('#ff9f1c', { roughness: 0.5 }));
    beak.rotation.x = PI / 2;
    beak.position.set(0, 0, 0.4);
    g.add(beak);
    const tuft = new T.Mesh(new T.ConeGeometry(0.07, 0.2, 6), mat(cols[0], { roughness: 0.6 }));
    tuft.position.set(0, 0.42, 0);
    tuft.rotation.z = 0.3;
    g.add(tuft);
    const wings = [-1, 1].map((sx) => {
      const piv = new T.Group();
      piv.position.set(sx * 0.32, 0.05, 0);
      const wg = new T.Mesh(new T.BoxGeometry(0.4, 0.06, 0.26), mat(cols[0], { roughness: 0.6 }));
      wg.position.x = sx * 0.2;
      piv.add(wg);
      g.add(piv);
      return piv;
    });
    g.userData = { wings, kind: 'bird' };
    return g;
  };
  function screenFaceTex() {
    const [c, g] = G.makeCanvas(128, 96);
    g.fillStyle = '#1b2440'; G.roundRect(g, 0, 0, 128, 96, 18); g.fill();
    g.fillStyle = '#7dffb0';
    g.beginPath(); g.arc(40, 40, 13, 0, PI * 2); g.arc(88, 40, 13, 0, PI * 2); g.fill();
    g.strokeStyle = '#7dffb0'; g.lineWidth = 6; g.beginPath(); g.arc(64, 54, 22, 0.2 * PI, 0.8 * PI); g.stroke();
    return G.toTexture(c);
  }
  A.ROBOTS = ['#ffcf3d', '#7fd8ff', '#c7ff6b'];
  A.robot = function (col) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(0.66, 0.56, 0.5), mat(col, { roughness: 0.4, metalness: 0.2 }));
    g.add(body);
    const face = new T.Mesh(new T.PlaneGeometry(0.5, 0.38), new T.MeshBasicMaterial({ map: screenFaceTex() }));
    face.position.set(0, 0.02, 0.26);
    g.add(face);
    const stick = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.22, 6), mat('#8a93a8'));
    stick.position.y = 0.38;
    g.add(stick);
    const prop = new T.Group();
    prop.position.y = 0.5;
    for (const r of [0, PI / 2]) {
      const b = new T.Mesh(new T.BoxGeometry(0.7, 0.03, 0.1), mat('#ff3d7f', { roughness: 0.4 }));
      b.rotation.y = r;
      prop.add(b);
    }
    g.add(prop);
    for (const sx of [-1, 1]) {
      const arm = new T.Mesh(new T.BoxGeometry(0.1, 0.3, 0.1), mat('#8a93a8'));
      arm.position.set(sx * 0.4, -0.08, 0);
      arm.rotation.z = sx * 0.5;
      g.add(arm);
      const hand = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), mat('#ff3d7f'));
      hand.position.set(sx * 0.47, -0.22, 0);
      g.add(hand);
    }
    g.userData = { prop, kind: 'robot' };
    return g;
  };
  function coinTex() {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#ffd400'; g.beginPath(); g.arc(64, 64, 62, 0, PI * 2); g.fill();
    g.strokeStyle = '#ffb000'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 52, 0, PI * 2); g.stroke();
    g.fillStyle = '#9a5a00';
    g.beginPath(); g.arc(46, 52, 8, 0, PI * 2); g.arc(82, 52, 8, 0, PI * 2); g.fill();
    g.strokeStyle = '#9a5a00'; g.lineWidth = 6; g.beginPath(); g.arc(64, 66, 22, 0.15 * PI, 0.85 * PI); g.stroke();
    return G.toTexture(c);
  }
  const coinMats = [];
  A.coin = function () {
    if (!coinMats.length) {
      const face = new T.MeshStandardMaterial({ map: coinTex(), roughness: 0.25, metalness: 0.3, emissive: '#5a4000', emissiveIntensity: 0.3 });
      coinMats.push(mat('#ffb000', { roughness: 0.3, metalness: 0.4 }), face, face);
    }
    const m = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.1, 24), coinMats);
    m.rotation.x = PI / 2;
    const g = new T.Group();
    g.add(m);
    return g;
  };
  // the puffy clouds at the top corners the flyers pop out of
  A.cloud = function () {
    const g = new T.Group();
    const m = mat('#ffffff', { roughness: 0.9 });
    [[0, 0, 0.55], [-0.55, -0.1, 0.4], [0.55, -0.1, 0.42], [0.2, 0.3, 0.38]].forEach(([x, y, r]) => {
      const s = new T.Mesh(new T.SphereGeometry(r, 14, 10), m);
      s.position.set(x, y, 0);
      g.add(s);
    });
    eyes(g, 0, 0.02, 0.48, 0.07, 0.14);
    return g;
  };

  // ---------- the wobbly power ball ----------
  function ballTex() {
    const [c, g] = G.makeCanvas(256, 128);
    const cols = ['#ff3d5a', '#ff9f43', '#ffe14a', '#5fe07a', '#4fb3ff', '#a97bff'];
    for (let i = 0; i < 12; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(i * 256 / 12, 0, 256 / 12 + 1, 128); }
    g.fillStyle = '#ffffff'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('★', 64, 64); g.fillText('★', 192, 64);
    return G.toTexture(c);
  }
  A.ball = function () {
    const g = new T.Group();
    const s = new T.Mesh(new T.SphereGeometry(0.42, 24, 16), new T.MeshStandardMaterial({ map: ballTex(), roughness: 0.25, emissive: '#ffffff', emissiveIntensity: 0.15 }));
    g.add(s);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: '#fff2a0' }));
    glow.scale.set(2.2, 2.2, 1);
    g.add(glow);
    g.userData = { s, glow };
    return g;
  };

  // ---------- dizzy stars ----------
  A.stars = function () {
    const g = new T.Group();
    const tex = G.emojiTexture('⭐');
    for (let i = 0; i < 3; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
      s.scale.set(0.38, 0.38, 1);
      s.renderOrder = 6;
      g.add(s);
    }
    return g;
  };

  // ---------- confetti and emoji sprites (from TT Balloon Bump) ----------
  A.confetti = function (scene, max) {
    max = max || 500;
    const geo = new T.PlaneGeometry(0.16, 0.1);
    const im = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ side: T.DoubleSide }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    const ps = [];
    const col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(1, 1, 1), v = new T.Vector3();
    const COLS = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ff8a1f', '#c77dff', '#ffffff'];
    for (let i = 0; i < max; i++) { im.setColorAt(i, col.set(COLS[i % COLS.length])); m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
    let next = 0;
    return {
      burst(x, y, z, n, power, colors, grav) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          const a = Math.random() * PI * 2, sp = (0.4 + Math.random()) * (power || 4);
          ps[k] = { x, y, z: z || 0.5, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 1.5, vz: (Math.random() - 0.3) * 2, rx: Math.random() * 6, ry: Math.random() * 6, life: 1.6 + Math.random() * 1.2, g: grav || 6 };
          im.setColorAt(k, col.set(colors ? colors[i % colors.length] : COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      rain(x0, x1, y, n) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          ps[k] = { x: x0 + Math.random() * (x1 - x0), y: y + Math.random() * 3, z: 0.6 + Math.random(), vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, life: 4 + Math.random() * 2, g: 6 };
          im.setColorAt(k, col.set(COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let k = 0; k < max; k++) {
          const p = ps[k];
          if (!p) continue;
          p.life -= dt;
          if (p.life <= 0) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); continue; }
          p.vy -= p.g * dt;
          p.vx *= 1 - 1.2 * dt;
          p.vy = Math.max(p.vy, -2.2);
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.rx += dt * 7; p.ry += dt * 5;
          q.setFromEuler(e.set(p.rx, p.ry, 0));
          s.setScalar(Math.min(1, p.life * 2));
          m4.compose(v.set(p.x, p.y, p.z), q, s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      clear() { for (let k = 0; k < max; k++) if (ps[k]) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; },
    };
  };
  A.emoji = function (e, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(e), depthTest: false }));
    s.scale.set(size || 0.6, size || 0.6, 1);
    s.renderOrder = 5;
    return s;
  };
})();
