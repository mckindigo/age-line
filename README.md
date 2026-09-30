# AGE LINE v0.2 (five ages)

Open `index.html` in any modern browser. The shipped game is one self-contained file with no network requests. It works on phone (touch) and PC (mouse/keyboard).

## Build
`index.html` is **generated**. Edit the sources, then run `node tools/build.js` (or `npm run build`).

| Source | Role |
|---|---|
| `design/*.json` | units, turrets, ages, specials, perks (design-owned, untouched by the build) |
| `design/ai.js` | enemy AI (inlined verbatim; see the patch note below) |
| `tools/tuning.json` | integration-owned overrides layered over the design JSON (listed below) |
| `src/template.html` | HTML/CSS/DOM (HUD per `design/hud.md`, adapted to 4 turret sockets) |
| `src/sim.js` | pure deterministic sim (both sides symmetric), bots, headless runner |
| `src/art1-core.js` … `art6-fx.js` | procedural art per `design/art-direction.md` + `design/techniques.md` (palettes, units, turrets/projectiles, bases with damage states + rubble, parallax world, pooled particles, trauma shake, icons) |
| `src/ui.js` | render loop (fixed 30 Hz sim + interpolation), HUD, input, audio, flow |

## Tests
- `node test/sim-harness.js [seeds]`: balance matrix, 5 ages reached, win rates and lengths per difficulty, determinism, and rule checks (4 slots, 25% replace/sell refund, evolve/perks, specials never hit bases, pre-rolled special drops, shoot x/y). Writes `test/sim-results.json`.
- `node test/browser-test.js`: headless Chrome (puppeteer-core). Checks autotest win/lose, hotkeys, touch flow, 48 px targets, no scroll, and no console errors. Writes `shots/v02-*.png` at 1280×720 and 844×390.
- `node test/anim-frames.js [tag]`: renders idle / walk / wind-up / release frame strips for every unit and both teams at 3× into `shots/anim/`.
- `node tools/balance.js 10`: per-seed balance detail. `node design/ai.test.js`: the AI's own test.

## Controls
Tap/click the cards. Long-press (or hover) shows details. PC: **1-4** units, **Q W E R** turret sockets (then 1-3 picks, X sells), **V** evolve, **Space** special, **P/Esc** pause.
The first special tap arms it: tap the lane to aim (Rockslide / Kiln Burst / Static Surge), or tap the button again to auto-aim.

## URL params
- `?autotest=win|lose&diff=normal|hard|impossible&seed=N` runs a bot at high speed, then logs `AUTOTEST_RESULT {...}` and sets `window.__AUTOTEST_RESULT`.
- `?demo&seed=N&warp=T[&autoplay][&age=K]` fast-forwards T seconds with the mixed bot. `autoplay` keeps the bot playing afterwards; `age` forces the player's age.
- `window.__AGE` exposes `sim`, `warp`, `forceAge`, `openPerks`, `fireSpecial`, `fps`, and `pfx` for tests.

## Difficulty decision (approved)
`DATA.difficulty` enemyHp / enemyDmg / spawnRate are all **1.0**. Difficulty comes only from the AI profiles (`normal` / `hard` / `impossible` in `design/ai.js`) plus the integration income overrides below.

## tools/tuning.json overrides
- world: width 1200, 30 Hz, bases at x 80 / 1120, baseHalfW 50.
- economy: start gold 60, queue 5, unit cap 20, XP trickle [2,3,4,6,0]/s, 25% XP carry-over on evolve, and max-age surge every 5000 XP (a free special recharge).
- ages xpToNext: stone 1100, kiln 2000, banner 3600, gear 5500.
- turretSlots: **4** stacked sockets (y 58/96/134/172) on a scaffold tower behind each base.
- specialTargeting (aim mode, width, and telegraph time per special kind), specialStartCdFrac 0.6, perkOffer 3, perkSlowMo 0.25.
- aiOverrides goldIncomeMult: hard 1.4, impossible 3.2.
- aiRoles (counter vocabulary), rally (free defenders at 50% / 25% enemy base HP), aiFormation guard.
- overtime "Dusk Wane" from 20:00: both bases lose 0.4% max HP per second.

## design/ai.js patch ([integration v0.2])
Adds the profile knobs `saveChance` (0.35 / 0.6 / 0.85) and `saveHorizon` (8 / 10 / 12 s). `pickUnit` can return a SAVE sentinel, so the AI waits for its best counter when income covers the gap. `design/ai.test.js` still passes. The original is in `archive/ai.js.orig`.

v0.1 is archived in `archive/v0.1/`.
