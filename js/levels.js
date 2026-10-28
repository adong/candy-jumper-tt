/* TT Candy Jumper: the four screens as plain data. The field is 20 m wide (x from -10 to 10, candy-cane walls at the sides)
   and 13 m tall (the floor at y = 0, the ceiling at 13). Platforms are { x0, x1, y }, y the top you stand on; you jump up
   through them and land on top, and ↓ drops you through. Each screen has 24 candies, listed in their ORDER: after you grab
   one, the next one along the list (skipping eaten ones, wrapping round) glows. No Three.js here, so node runs it. */
(function (root) {
  'use strict';
  const CJ = (root.CJ = root.CJ || {});
  const HALF = 10, CEIL = 13;
  const row = (y, ...xs) => xs.map((x) => [x, y]);
  const SCREENS = [
    {
      name: 'PYRAMID', sky: 'pyramid',
      plats: [{ x0: -8.5, x1: -4.5, y: 3.2 }, { x0: 4.5, x1: 8.5, y: 3.2 }, { x0: -2.5, x1: 2.5, y: 6 }, { x0: -9.2, x1: -5.6, y: 8.8 }, { x0: 5.6, x1: 9.2, y: 8.8 }],
      candies: [].concat(
        row(0.7, 2.5, 3.5), row(3.9, 5, 6, 7, 8), row(9.5, 8.5, 7.25, 6), row(11.6, 0.6, -0.6),
        row(9.5, -6, -7.25, -8.5), row(3.9, -8, -7, -6, -5), row(0.7, -3.5, -2.5), row(6.7, -1.5, -0.5, 0.5, 1.5)),
    },
    {
      name: 'CASTLE', sky: 'castle',
      plats: [{ x0: -6, x1: -2, y: 2.8 }, { x0: 2, x1: 6, y: 2.8 }, { x0: -9.5, x1: -6.5, y: 5.8 }, { x0: 6.5, x1: 9.5, y: 5.8 }, { x0: -2, x1: 2, y: 8.4 }],
      candies: [].concat(
        row(3.5, 3, 4, 5), [[9.2, 1.2], [9.2, 2.4], [9.2, 3.6]], row(6.5, 7, 8, 9), row(11.8, 4.5, 0, -4.5),
        row(9.1, 1.2, 0, -1.2), row(6.5, -7, -8, -9), [[-9.2, 3.6], [-9.2, 2.4], [-9.2, 1.2]], row(3.5, -3, -4, -5)),
    },
    {
      name: 'CITY AT NIGHT', sky: 'city',
      plats: [{ x0: -9.5, x1: -6, y: 3.5 }, { x0: -3, x1: 3, y: 3.5 }, { x0: 6, x1: 9.5, y: 3.5 }, { x0: -6.5, x1: -3, y: 7 }, { x0: 3, x1: 6.5, y: 7 }, { x0: -2, x1: 2, y: 10.2 }],
      candies: [].concat(
        row(4.2, -1.5, 0, 1.5), row(0.7, 5), row(4.2, 7, 8, 9), [[9, 9.5], [9, 11.5]], row(7.7, 6, 4.75, 3.5),
        row(10.9, 1.2, 0, -1.2), row(7.7, -3.5, -4.75, -6), [[-9, 11.5], [-9, 9.5]], row(4.2, -9, -8, -7), row(0.7, -5)),
    },
    {
      name: 'ROCKET BASE', sky: 'rocket',
      plats: [{ x0: -2, x1: 2, y: 2.2 }, { x0: -8, x1: -3, y: 4.2 }, { x0: 3, x1: 8, y: 4.2 }, { x0: -2.5, x1: 2.5, y: 7.4 }, { x0: -9.5, x1: -6.5, y: 9.6 }, { x0: 6.5, x1: 9.5, y: 9.6 }],
      candies: [].concat(
        row(2.9, -1, 0, 1), row(4.9, 4, 5.5, 7), row(0.7, 7.5, 8.5), row(10.3, 7, 8, 9), row(12, 3, -3),
        row(10.3, -7, -8, -9), row(0.7, -8.5, -7.5), row(4.9, -7, -5.5, -4), row(8.1, -1.5, 0, 1.5)),
    },
  ];
  CJ.levels = {
    HALF, CEIL, SCREENS, SPAWN: { x: 0, y: 0 },
    // every platform of a screen, the floor first (index 0: you can't drop through it)
    plats: (s) => [{ x0: -HALF, x1: HALF, y: 0, floor: true }].concat(SCREENS[s].plats),
    screen: (round) => (round - 1) % SCREENS.length,
    cycle: (round) => Math.floor((round - 1) / SCREENS.length),
  };
})(typeof window !== 'undefined' ? window : globalThis);
