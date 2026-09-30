# AGE LINE: Canvas 2D Techniques for the Art Upgrade

These snippets drop into `boot()` in `index.html`. They use the existing conventions:
`g` is the current context, `fs(c)`/`st(w)`/`circ()`/`blob()` are the helpers, `PAL`/`OUT` are the palette, and `clock` is the render time.
World y is **negative-up** with the origin at the unit's feet. The unit draw functions receive
`o = { team, teamL, flash, moving, walk, swing, id }`. `render()` sets `g.setTransform(dpr*sc,0,0,dpr*sc, dpr*(ox+shx), dpr*(gy+shy))`.

Contents: 1 gradients · 2 rim light · 3 contact shadows · 4 procedural limbs (idle/walk) · 5 hit flash + squash/stretch ·
6 pooled particles (dust, sparks, muzzle flash, debris) · 7 screen shake (trauma) · 8 parallax · 9 offscreen caching · 10 devicePixelRatio · 11 perf budget.

---

## 1. Linear and radial gradients (bases, backgrounds, FX; not character bodies)
Creating gradients every frame is cheap but not free. Create them **once in local coordinates** and reuse them under `translate` (gradients follow the transform).

```js
const GRAD = {};                         // cache keyed by name; rebuild on age change
function grad(key, make) { return GRAD[key] || (GRAD[key] = make()); }

// vertical body gradient for a base stone/tier (local coords: y from -h to 0)
function stoneFill(i, h) {
  return grad("stone" + i + ":" + h, () => {
    const lg = g.createLinearGradient(0, -h, 0, 0);
    lg.addColorStop(0, PAL.stone[i]);
    lg.addColorStop(1, shade(PAL.stone[i], -0.18));   // 18% darker toward the ground
    return lg;
  });
}
// radial heart glow: draw additive
function heartGlow(x, y, r, k) {
  g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = k;
  const rg = grad("heart" + r, () => { const q = g.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
    q.addColorStop(0, "rgba(255,226,154,.85)"); q.addColorStop(0.4, "rgba(255,138,42,.45)"); q.addColorStop(1, "rgba(255,120,40,0)"); return q; });
  g.translate(x, y); g.fillStyle = rg; g.fillRect(-r, -r, r * 2, r * 2); g.restore();
}
// tiny hex shade helper (amt -1..1)
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  return "#" + ((f(n >> 16) << 16) | (f(n >> 8 & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0");
}
```

## 2. Rim light (a flat crescent, in keeping with STYLE.md)
Clip to the shape and fill it with the rim color. Then fill the **same shape in the body color, shifted away from the light** by the rim width.
Only a crisp crescent on the lit edge stays uncovered. There is no gradient and no compositing trick, so it works on the main canvas.

```js
// pathFn builds the shape path (e.g. () => circ(0, by, 16)); (lx,ly) = unit vector toward the light (y negative = up)
function rimLight(pathFn, bodyCol, rimCol, lx, ly, width) {
  g.save();
  pathFn(); g.clip();
  pathFn(); g.fillStyle = rimCol; g.fill();                       // whole shape in rim color…
  g.translate(-lx * width, -ly * width); pathFn(); g.fillStyle = bodyCol; g.fill();  // …covered by the body, offset away from the light
  g.restore();
}
// Use it INSTEAD of the body fill, then stroke the ink on top. In drawThudder:
//   if (o.flash) { circ(0, by, 16); fs("#fff4e0"); } else rimLight(() => circ(0, by, 16), PAL.skin, PAL.rim || "#ffe3b0", -0.6, -0.8, 3);
//   circ(0, by, 16); st(3.2);
```
A cheaper option for round bodies is an arc stroke just inside the silhouette:
```js
function rimArc(x, y, r, a0, a1, col, w) {   // for round bodies: an arc stroke just inside the silhouette
  g.beginPath(); g.arc(x, y, r - w * 0.5 - 1.5, a0, a1);
  g.lineWidth = w; g.strokeStyle = col; g.lineCap = "round"; g.stroke();
}
// Thudder, light from upper-left (facing +x after scale): rimArc(0, by, 16, Math.PI * 1.05, Math.PI * 1.55, "#ffe3b0", 2.5);
```
Because the team is mirrored with `g.scale(dir,1)`, a rim drawn at "upper-left" is at upper-left for the player and upper-right for the enemy.
If the key light is fixed in the world (the sun), flip the angle with `dir`: `const a0 = dir > 0 ? Math.PI*1.05 : Math.PI*1.45`.

## 3. Soft contact shadows
v0.1 uses a flat `rgba(42,26,16,.25)` ellipse. Use a radial gradient squashed by `scale`. It is soft-edged and cheap, and it can **shrink when the unit is airborne**
(Muster Horn shove, Tinker Wisp's hover height, death pops).

```js
const SHADOW = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, "rgba(42,26,16,.42)"); rg.addColorStop(0.6, "rgba(42,26,16,.22)"); rg.addColorStop(1, "rgba(42,26,16,0)");
  x.fillStyle = rg; x.fillRect(0, 0, 64, 64); return c; })();
function contactShadow(rx, airborne) {      // airborne: height above ground in world px
  const k = 1 / (1 + (airborne || 0) / 40);
  g.globalAlpha = k; g.drawImage(SHADOW, -rx * k, -rx * 0.28 * k, rx * 2 * k, rx * 0.56 * k); g.globalAlpha = 1;
}
// in drawThudder: replace the first ellipse with   contactShadow(17, 0);
// Spark age: draw a team-tinted glow instead (same sprite, tinted once via 'source-atop' into a second cached canvas).
```

## 4. Procedural idle and walk (sin-based limb swing)
There is one shared gait function. Distance-based phase (`o.walk`, which already exists) keeps feet from sliding. Time-based idle is used when the unit is standing.

```js
// Gait presets per role, all in world px / radians
const GAIT = {
  melee:  { stride: 5,  bob: 3,   lean: 0.06, arm: 0.35, freq: 0.22, idleBob: 1.2, idleHz: 2.2 },
  ranged: { stride: 7,  bob: 2,   lean: 0.03, arm: 0.25, freq: 0.20, idleBob: 0.8, idleHz: 1.6 },
  heavy:  { stride: 4,  bob: 4.5, lean: 0.10, arm: 0.15, freq: 0.14, idleBob: 1.6, idleHz: 1.3 },
  spec:   { stride: 5,  bob: 2.5, lean: 0.05, arm: 0.30, freq: 0.24, idleBob: 1.0, idleHz: 1.9 }
};
function gait(o, G) {
  if (o.moving) {
    const ph = o.walk * G.freq;                           // one full cycle ≈ 2π/freq world px walked
    return { ph, legA: Math.sin(ph) * G.stride, legB: -Math.sin(ph) * G.stride,
      bob: Math.abs(Math.sin(ph)) * G.bob,                // two bobs per cycle (one per footfall)
      lean: G.lean, armA: Math.sin(ph + Math.PI) * G.arm, // arms swing opposite to legs
      footLift: Math.max(0, Math.cos(ph)) * 3 };
  }
  const t = clock * G.idleHz * Math.PI * 2 + o.id * 1.7;  // per-unit offset so the crowd doesn't breathe in sync
  return { ph: 0, legA: 0, legB: 0, bob: (Math.sin(t) * 0.5 + 0.5) * G.idleBob, lean: Math.sin(t * 0.5) * 0.015, armA: Math.sin(t) * 0.05, footLift: 0 };
}
// Two-segment leg with a knee (good for Whirler/ranged stilt legs)
function leg(hipX, hipY, footX, lift, len, col, w) {
  const fx = footX, fy = -lift, dx = fx - hipX, dy = fy - hipY, d = Math.hypot(dx, dy);
  const bend = Math.sqrt(Math.max(0, len * len - d * d / 4));      // knee offset from the midpoint
  const kx = hipX + dx / 2 + (dy / d) * bend * -1, ky = hipY + dy / 2 + (dx / d) * bend;  // knee bends forward (+x)
  g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(kx, ky); g.lineTo(fx, fy);
  g.lineWidth = w + 4; g.strokeStyle = OUT; g.stroke(); g.lineWidth = w; g.strokeStyle = col; g.stroke();
}
// Usage in a draw fn:
//   const A = gait(o, GAIT.heavy); g.rotate(A.lean);           // lean into the walk
//   leg(-5, -26 - A.bob, -6 + A.legA, A.footLift, 15, PAL.skinD, 4);
//   leg( 5, -26 - A.bob,  6 + A.legB, 0,          15, PAL.skin,  4);
```
Parameter tips: heavy units need `bob > stride` (weighty). For ranged, keep `bob` low so the aim stays steady. Emit a dust puff when `sin(ph)` crosses 0
(footfall) for heavy units: `if (Math.sign(Math.sin(ph)) !== Math.sign(Math.sin(prevPh))) P.dust(x, 2, 1)`.

## 5. Hit flash + squash/stretch
v0.1 already has `flashes` (a 90 ms white via `C()`). Add a **hit squash** and a 2 px **knockback** from the same timestamp, so hits feel like impacts.

```js
// in handleEvents 'hit': flashes.set(e.id, clock + 0.09); hitT.set(e.id, clock);
const hitT = new Map();
function squash(id) {                         // returns [sx, sy, dx] for this frame
  const t0 = hitT.get(id); if (t0 == null) return [1, 1, 0];
  const p = (clock - t0) / 0.16; if (p >= 1) { hitT.delete(id); return [1, 1, 0]; }
  const e = Math.sin(p * Math.PI) * (1 - p);  // quick up, decaying
  return [1 + 0.14 * e, 1 - 0.12 * e, -2.5 * e]; // wider+shorter, nudged backward
}
// in render(), per unit, right after g.scale(dir, 1):
//   const [sx, sy, kx] = squash(u.id); g.translate(kx, 0); g.scale(sx, sy);   // origin = feet, so it squashes onto the ground
// Anticipation/stretch for attacks: in drawThudder use o.swing (0..1):
//   const stretch = o.swing >= 0 && o.swing < 0.3 ? 1 + o.swing * 0.25 : o.swing < 0.5 ? 0.92 : 1;
//   g.scale(1 / Math.sqrt(stretch), stretch);   // preserve area
// Spawn pop: scale from 0.6→1 with overshoot over 0.25s using (s.t - u.born).
function easeOutBack(p) { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
```
The flash color should come from the age palette (`"#fff4e0"` Stone). For the Spark Age use `"#ffffff"` plus a 1-frame additive team glow.

## 6. Small pooled particle system (replaces the `fx` array splices)
v0.1 pushes object literals into `fx` and uses `splice` on death, which makes garbage every hit. Here is a fixed pool with swap-remove and typed behavior.

```js
const P = (() => {
  const MAX = 600, pool = [];
  for (let i = 0; i < MAX; i++) pool.push({ k: 0, x: 0, y: 0, vx: 0, vy: 0, r: 0, life: 0, max: 1, col: "", seed: 0, grav: 0, drag: 0, add: false, rot: 0, vr: 0 });
  let n = 0;
  function emit(k, x, y, vx, vy, r, life, col, o) {
    if (n >= MAX) return null;                               // drop silently when full
    const p = pool[n++]; p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.r = r; p.life = p.max = life; p.col = col;
    p.seed = (Math.random() * 100) | 0; p.grav = o && o.grav || 0; p.drag = o && o.drag || 0; p.add = !!(o && o.add);
    p.rot = Math.random() * 6.28; p.vr = o && o.vr || 0; return p;
  }
  function step(dt) {
    for (let i = n - 1; i >= 0; i--) {
      const p = pool[i]; p.life -= dt;
      if (p.life <= 0) { const last = pool[--n]; pool[n] = p; pool[i] = last; continue; }  // swap-remove, no GC
      p.vy -= p.grav * dt; const d = 1 - p.drag * dt; p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.grav && p.y < 1) { p.y = 1; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }       // bounce on ground (y up)
    }
  }
  function draw() {                                          // world transform already set; y is up → use -p.y
    for (let pass = 0; pass < 2; pass++) {                   // normal first, then additive (one state switch)
      if (pass) { g.save(); g.globalCompositeOperation = "lighter"; }
      for (let i = 0; i < n; i++) {
        const p = pool[i]; if (p.add !== !!pass) continue;
        const k = p.life / p.max;
        if (p.k === 1) {        // DUST: grows, fades, no outline
          g.globalAlpha = k * 0.7; blob(p.x, -p.y, p.r * (1.6 - k * 0.6), p.r * (1.4 - k * 0.5), p.seed); fs(p.col);
        } else if (p.k === 2) { // SPARK: velocity-aligned streak
          g.globalAlpha = Math.min(1, k * 2); g.beginPath(); g.moveTo(p.x, -p.y); g.lineTo(p.x - p.vx * 0.03, -p.y + p.vy * 0.03);
          g.lineWidth = p.r * k + 0.5; g.strokeStyle = p.col; g.lineCap = "round"; g.stroke();
        } else if (p.k === 3) { // MUZZLE FLASH: 2-frame star + disc
          g.globalAlpha = k; g.save(); g.translate(p.x, -p.y); g.rotate(p.rot);
          g.beginPath(); for (let j = 0; j < 10; j++) { const a = j / 10 * 6.283, rr = j % 2 ? p.r * 0.45 : p.r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          g.closePath(); g.fillStyle = p.col; g.fill(); g.restore();
        } else if (p.k === 4) { // DEBRIS: tumbling outlined chunk (team colors, stone, wood)
          g.globalAlpha = Math.min(1, k * 1.5); g.save(); g.translate(p.x, -p.y); g.rotate(p.rot);
          blob(0, 0, p.r, p.r * 0.8, p.seed); fs(p.col); st(1.5); g.restore();
        } else if (p.k === 5) { // RING shock
          circ(p.x, -p.y, p.r * (1.6 - k)); g.globalAlpha = 1; g.lineWidth = 4 * k; g.strokeStyle = p.col; g.stroke();
        }
      }
      if (pass) g.restore();
    }
    g.globalAlpha = 1;
  }
  const R = (a, b) => a + Math.random() * (b - a);
  return {
    step, draw, emit, get count() { return n; }, clear() { n = 0; },
    dust(x, y, m)   { for (let i = 0; i < 3 * m; i++) emit(1, x + R(-8, 8), y, R(-30, 30), R(8, 26), R(5, 9), R(0.4, 0.7), "rgba(200,170,130,.8)", { drag: 2 }); },
    sparks(x, y, m, col) { for (let i = 0; i < 6 * m; i++) { const a = R(0.2, 2.9), s = R(140, 320); emit(2, x, y, Math.cos(a) * s, Math.sin(a) * s, R(1.5, 2.5), R(0.18, 0.4), col || PAL.emberHi, { grav: 600, add: true }); } },
    muzzle(x, y, dir, col) { emit(3, x, y, dir * 20, 0, 9, 0.07, col || "#fff3dc", { add: true }); emit(1, x + dir * 6, y, dir * 40, 10, 4, 0.35, "rgba(239,230,220,.8)", { drag: 3 }); },
    debris(x, y, m, cols) { for (let i = 0; i < 8 * m; i++) { const a = R(0.3, 2.8), s = R(120, 320); emit(4, x, y, Math.cos(a) * s, Math.sin(a) * s, R(2.5, 6), R(0.7, 1.2), cols[i % cols.length], { grav: 520, vr: R(-12, 12) }); } },
    ring(x, y, r, col) { emit(5, x, y, 0, 0, r, 0.35, col || "rgba(255,243,220,1)"); }
  };
})();
// Wiring: stepFx(dt) → P.step(dt); render() → replace the `for (const f of fx)` loop with P.draw();
// handleEvents 'death' → P.ring(e.x, y, 26); P.debris(e.x, y, 1.5, [teamC(e.side), PAL.skin, PAL.wood, teamL(e.side)]); P.dust(e.x, 6, 2);
// 'shoot' needs the shooter's x,y in the event (see constraints) → P.muzzle(x, y, dirOf(e.side));
// 'baseHit' → P.sparks(bx, 60, 1); P.debris(bx, 50, 0.5, PAL.stone);
```
The ring uses `globalAlpha = 1` and an alpha-in-color stroke. Pre-build ring colors per team, e.g. `"rgba(255,243,220,1)"`, or scale alpha via `g.globalAlpha = k`.

## 7. Screen shake (trauma model)
v0.1 uses `shake` in px with uniform random jitter. That feels buzzy. A trauma model gives a nicer falloff (squared), smooth noise, and a tiny rotation.

```js
let trauma = 0;                                   // 0..1
function addTrauma(a) { trauma = Math.min(1, trauma + a); }   // base hit: player 0.45, enemy 0.25; special impact 0.6
function shakeOffset() {
  const s = trauma * trauma, t = clock * 38;      // squared = small hits stay subtle
  const n = (a, b) => Math.sin(t * a + b) * 0.6 + Math.sin(t * a * 2.3 + b * 1.7) * 0.4; // cheap smooth noise
  return { x: 10 * s * n(1.0, 0.3), y: 8 * s * n(1.3, 2.1), r: 0.012 * s * n(0.7, 4.2) };
}
// stepFx: trauma = Math.max(0, trauma - dt * 1.6);
// render(): const S = shakeOffset(); use S.x/S.y where shx/shy are used today, and apply the rotation around the screen center:
//   g.translate(CW / 2, CH / 2); g.rotate(S.r); g.translate(-CW / 2, -CH / 2);
// Accessibility: multiply by a user setting (Pause screen: "Screen shake: On/Low/Off").
```

## 8. Parallax rendering
`drawBackground()` currently draws every layer with the same `ox` (factor 1). Each layer should use its own factor.
With `L.pan` (the camera moves), a layer at factor `f` shifts by `camX * sc * f`. Without pan, only the ambient drift moves.

```js
// layers: [{ f, img (cached canvas, see §9), wWorld, yWorld, drift }]
function drawParallax(layers) {
  const { sc, gy } = L;
  for (const Ly of layers) {
    const off = -(L.pan ? camX : 0) * sc * Ly.f + (Ly.drift ? (clock * Ly.drift * sc) % (Ly.img.width / dpr) : 0);
    const base = L.pan ? 0 : L.ox * Ly.f;        // keep the centered-lane composition on desktop
    const w = Ly.img.width / dpr, y = gy - Ly.yWorld * sc;   // yWorld = layer bottom above the ground line
    let x = ((base + off) % w + w) % w - w;       // wrap for seamless tiling
    for (; x < CW; x += w) g.drawImage(Ly.img, 0, 0, Ly.img.width, Ly.img.height, x, y - Ly.img.height / dpr, w, Ly.img.height / dpr);
  }
}
```
Rules: tile widths must wrap seamlessly (make the first and last profile points identical). Factors: sky 0, far 0.1, mid 0.3, near 0.6, ground 1.0 (drawn in world space as now).
The ground stays world-locked, otherwise units would appear to slide.

## 9. Offscreen canvas caching (backgrounds, bases)
Anything static goes into an offscreen canvas at **device resolution** (`sc * dpr`) once, and is re-rendered only on resize, age change or damage-state change.
Per frame this turns ~200 path ops into a single `drawImage`.

```js
function makeCache(wCss, hCss, paint) {           // paint(ctx) draws in CSS-px units
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
  c.width = Math.ceil(wCss * dpr); c.height = Math.ceil(hCss * dpr);
  const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.lineJoin = "round"; x.lineCap = "round";
  const prev = g; g = x; try { paint(x); } finally { g = prev; }   // reuse all helpers (same trick drawIcon uses)
  return c;
}
// Bases: cache per (age, side, damageState). World size ≈ 220×260; render at world scale sc.
const baseCache = new Map();
function dmgState(frac) { return frac > 0.66 ? 0 : frac > 0.33 ? 1 : frac > 0 ? 2 : 3; }
function baseImg(age, side, stIdx) {
  const key = age + side + stIdx + "@" + L.sc.toFixed(3) + "x" + dpr;
  let c = baseCache.get(key);
  if (!c) { c = makeCache(220 * L.sc, 260 * L.sc, () => { g.scale(L.sc, L.sc); g.translate(110, 250);   // feet at bottom center
      drawBaseStatic(age, side, stIdx); }); baseCache.set(key, c); }
  return c;
}
// render(), in world space: draw the cached image back at world scale (undo sc since it's baked in)
function drawBaseCached(x, side, frac, age) {
  const img = baseImg(age, side, dmgState(frac)), dir = dirOf(side);
  g.save(); g.translate(x, 0); g.scale(dir / L.sc, 1 / L.sc);   // cache already has sc baked in; world transform supplies dpr
  g.drawImage(img, -110 * L.sc, -250 * L.sc, img.width / dpr, img.height / dpr);
  g.restore();
  drawBaseLive(age, x, side, frac, clock);        // flames, heart glow, banner, smoke: live every frame
}
// Invalidate on resize(): baseCache.clear(); bgCache = null;  (and on age-up)
```
Notes:
- Bake the mirrored enemy version by using `scale(-1,1)` at draw time (as above); one cache per side is only needed if marks differ (v0.1 uses a different `blob` seed per side, so keep `side` in the key).
- Background layers: `makeCache(tileW * sc, layerH * sc, ...)`, one per layer per age. At 1280×720 @2× that is roughly 6 canvases of ≤ 3000×600, which is fine.
  On memory-limited phones cap `dpr` for caches at 2.
- Chunk "damage" into a cached base with `g.globalCompositeOperation = "destination-out"` blobs when baking state 1/2 (clean bites, no redraw per frame).
- Age-up crossfades: keep the previous age's layer caches alive until the transition ends, then drop them.

## 10. devicePixelRatio handling
v0.1 already does the core correctly (`cv.width = CW*dpr`, cap 2.5, `setTransform(dpr...)`). Improvements:

```js
function resize() {
  const want = Math.min(window.devicePixelRatio || 1, 2.5);
  // adaptive: drop to ≤2 on big phones / low FPS (see §11), keep integer-ish ratios for crisp lines
  dpr = perfLow ? Math.min(want, 1.5) : want;
  CW = window.innerWidth; CH = window.innerHeight;
  const w = Math.round(CW * dpr), h = Math.round(CH * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; baseCache.clear(); bgCache = null; }
  // …layout as before…
}
// DPR can change without a resize event (moving a window to another monitor, browser zoom):
function watchDpr() { const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mq.addEventListener("change", () => { resize(); paintIcons(); watchDpr(); }, { once: true }); }
watchDpr();
```
- Draw 1-px hairlines at `0.5 / (sc*dpr)` offsets only if they look blurry. At our 3 px ink widths this isn't needed.
- `drawIcon()` uses its own `d = min(3, dpr)`. Keep it, but repaint icons on DPR change (above).
- Text on canvas (`+N`, HP numbers) is set in world units, so it scales automatically. Keep font sizes ≥ 14 world px for phones.

## 11. Performance budget and toggles
- Target: 60 fps on a mid phone at dpr 2 with 40 units + 300 particles.
- `perfLow` auto-switch: if the average frame time is > 22 ms over 2 s, set `perfLow = true`. This halves particle counts, drops rain to 40 streaks, uses dpr ≤ 1.5 and turns off additive glows on units.
- Avoid `shadowBlur` in the per-frame path (it is slow on mobile Safari). Bake glows into caches or use radial gradients with `lighter`.
- Sort once: the current `s.units.slice().sort(...)` per frame is fine at this scale.
- Batch state changes: set `lineJoin/lineCap` once per frame, not per unit (v0.1 sets them in each draw fn).
