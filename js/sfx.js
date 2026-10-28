/* TT Candy Jumper: sound effects, all synth through Kit.sound (so the page's one mute switch covers them).
   CJ.sfx.log counts every effect played, so tests can check sound in code while muted. */
(function () {
  'use strict';
  const S = Kit.sound;
  const log = {};
  const note = (name, fn) => (...a) => { log[name] = (log[name] || 0) + 1; fn(...a); };
  CJ.sfx = {
    log,
    jump: note('jump', () => S.tone({ type: 'square', f: 300, to: 900, dur: 0.16, vol: 0.06, lp: 2200 })),
    float: note('float', () => { S.hiss({ filter: 'bandpass', f: 700, to: 300, q: 1.5, dur: 0.35, vol: 0.08 }); S.tone({ type: 'sine', f: 660, to: 520, dur: 0.3, vol: 0.05 }); }),
    land: note('land', () => S.tone({ f: 170, to: 90, dur: 0.07, vol: 0.09 })),
    drop: note('drop', () => S.tone({ type: 'sine', f: 500, to: 220, dur: 0.12, vol: 0.06 })),
    candy: note('candy', (n) => { S.hiss({ filter: 'highpass', f: 4000, to: 9000, dur: 0.12, vol: 0.06 }); S.tone({ type: 'triangle', f: 700 + (n % 12) * 40, to: 1100 + (n % 12) * 40, dur: 0.09, vol: 0.1 }); }),
    glow: note('glow', (n) => { [0, 4, 7, 12].forEach((k, i) => S.tone({ type: 'triangle', f: 523 * 2 ** ((k + (n % 6)) / 12), dur: 0.1, vol: 0.1, at: i * 0.055 })); S.hiss({ filter: 'highpass', f: 5000, dur: 0.2, vol: 0.05 }); }),
    ball: note('ball', () => [0, 0.1, 0.2].forEach((at, i) => S.tone({ type: 'sine', f: 400 + i * 200, to: 600 + i * 200, dur: 0.12, vol: 0.07, at }))),
    power: note('power', () => S.powerup()),
    coin: note('coin', (n) => S.coin(n || 0)),
    unCoin: note('unCoin', () => S.tone({ type: 'sine', f: 600, to: 250, dur: 0.25, vol: 0.08 })),
    flyerIn: note('flyerIn', () => S.tone({ type: 'sine', f: 260, to: 520, dur: 0.14, vol: 0.06 })),
    bump: note('bump', () => { S.tone({ type: 'triangle', f: 340, to: 160, dur: 0.12, vol: 0.14 }); S.tone({ type: 'sine', f: 1200, to: 300, dur: 0.7, vol: 0.06, at: 0.1 }); }),
    puff: note('puff', () => S.hiss({ f: 1800, to: 500, dur: 0.25, vol: 0.08 })),
    clear: note('clear', () => [523, 659, 784, 1047].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.22, vol: 0.13, at: i * 0.12 }))),
    perfect: note('perfect', () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.26, vol: 0.13, at: i * 0.12 }))),
    go: note('go', () => { S.tone({ type: 'square', f: 660, dur: 0.1, vol: 0.06, lp: 2500 }); S.tone({ type: 'square', f: 990, dur: 0.16, vol: 0.06, at: 0.12, lp: 2500 }); }),
    buddy: note('buddy', () => { S.tone({ f: 400, to: 900, dur: 0.15, vol: 0.12 }); S.hiss({ f: 2000, to: 500, dur: 0.25, vol: 0.08 }); }),
    treat: note('treat', () => S.coin(4)),
    helper: note('helper', () => [784, 988, 1175].forEach((f, i) => S.tone({ type: 'sine', f, dur: 0.12, vol: 0.08, at: i * 0.07 }))),
    hi5: note('hi5', () => { S.hiss({ filter: 'bandpass', f: 1800, dur: 0.08, vol: 0.25, q: 1 }); S.tone({ f: 880, to: 1320, dur: 0.15, vol: 0.08, at: 0.05 }); }),
    turn: note('turn', () => [660, 880].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.14, vol: 0.1, at: i * 0.12 }))),
    life: note('life', () => [784, 988, 1175, 1568].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.1, vol: 0.06, at: i * 0.09 }))),
    gameOver: note('gameOver', () => [523, 440, 392, 523].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.25, vol: 0.12, at: i * 0.2 }))),
    click: note('click', () => S.click()),
  };
})();
