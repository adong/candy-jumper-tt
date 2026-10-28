/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: CJ.TITLE, // the name lives in js/title.js
  keys: [
    ['walk left · right', '← → or A D'],
    ['jump (hold it to jump higher)', 'Space or ↑ W'],
    ['in the air: press jump again to open your cape and float down slowly', 'Space or ↑ W'],
    ['drop down through a platform · stop floating', '↓ or S'],
    ['call your brother: he lights up a power ball (2 players: high five)', 'T'],
    ['pause · sound', 'P or Esc · M'],
    ['title: 1 or 2 players · easy · normal · hero', '1 2 · E · N · C'],
  ],
  note: 'Grab all 24 fizzy candies to finish a screen. The next candy in the order glows: grab the glowing one each time for 300 points instead of 100, and 500 more each at the end (all 24 in order: 10,000 more). The wobbly power ball turns every flyer into a coin for a few seconds. A flyer that bumps you makes you dizzy and costs a life. 2 players take turns: when one gets bumped, the other one plays. Call your brother as often as you like.',
  touch: '◀ ▶ walk, ▼ drops down, the big ⬆ jumps (hold it to go higher, tap it again in the air to float). Your brother\'s face calls him.',
});
