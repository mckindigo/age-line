# AGE LINE v0.1 (Stone Age vertical slice)

Open `index.html` in any modern browser. It is a single file with no build step. It works on phone (touch) and PC (mouse/keyboard).

- `index.html`: the game. `DATA` at the top of the script holds every tunable (units / turrets / ages / difficulty / enemyAI).
- `test/sim-harness.js`: headless Node harness for the pure sim (balance matrix, determinism, rule checks). Run with `node test/sim-harness.js`.
- `test/browser-test.js`: headless Chrome (puppeteer-core) test for console errors, autotest win/lose, UI flow, touch and long-press, and screenshots.
- URL params: `?autotest=win|lose&diff=normal|hard|impossible&seed=N` runs a bot at high speed, then logs `AUTOTEST_RESULT {...}`.
  `?demo&warp=150` lets a bot play and fast-forwards 150 s.
- `STYLE.md`: the art direction.
