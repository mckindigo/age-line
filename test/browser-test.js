// Headless Chrome test (v0.2): console errors, autotest win/lose, hotkeys, touch targets, no scroll, screenshots -> shots/v02-*.png
const puppeteer = require("puppeteer-core"), path = require("path");
const FILE = "file://" + path.join(__dirname, "..", "index.html"), SHOTS = path.join(__dirname, "..", "shots");
const VP = { desk: { width: 1280, height: 720 }, phone: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, port: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const errors = [], results = []; let fails = 0;
  const ok = (name, cond, info) => { results.push((cond ? "PASS " : "FAIL ") + name + (info ? "  " + info : "")); if (!cond) fails++; };
  const open = async (vp, q) => { const p = await browser.newPage(); await p.setViewport(vp);
    p.on("console", m => { if (m.type() === "error") errors.push(q + ": " + m.text()); }); p.on("pageerror", e => errors.push(q + ": " + String(e)));
    await p.goto(FILE + (q || ""), { waitUntil: "load" }); return p; };
  const shot = (p, n) => p.screenshot({ path: `${SHOTS}/v02-${n}.png` });
  // autotests
  for (const [q, want] of [["?autotest=win&diff=normal&seed=7", "win"], ["?autotest=lose&diff=normal&seed=7", "lose"]]) {
    const p = await open(VP.desk, q); await p.waitForFunction("window.__AUTOTEST_RESULT", { timeout: 180000 }); const r = await p.evaluate("window.__AUTOTEST_RESULT"); await sleep(500);
    const vis = await p.evaluate(() => !document.getElementById("results").classList.contains("hidden"));
    ok(`autotest ${q} -> ${want}`, r.result === want && vis, JSON.stringify(r)); if (want === "win") await shot(p, "win-1280x720"); else await shot(p, "lose-1280x720"); await p.close(); }
  { const p = await open(VP.phone, "?autotest=win&diff=normal&seed=7"); await p.waitForFunction("window.__AUTOTEST_RESULT", { timeout: 180000 }); await sleep(500); await shot(p, "win-844x390"); await p.close(); }
  for (const [vn, vp] of [["1280x720", VP.desk], ["844x390", VP.phone]]) {
    // menu
    { const p = await open(vp, ""); await sleep(300); await shot(p, "menu-" + vn); await p.close(); }
    // each age mid-match (mixed bot plays, seed 5)
    const ages = [["stone", 110], ["kiln", 280], ["banner", 470], ["gear", 700], ["spark", 930]];
    for (const [id, t] of ages) { const p = await open(vp, `?demo&autoplay&seed=5&warp=${t}`); await sleep(3000);
      const st = await p.evaluate(() => ({ age: __AGE.sim.sides.player.ageIdx, over: __AGE.sim.over, fps: __AGE.fps, pfx: __AGE.pfx,
        sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
      await shot(p, `age-${id}-${vn}`); ok(`${vn} ${id} mid-match (age ${st.age}, fps ${st.fps.toFixed(0)}, pfx ${st.pfx})`, !st.over && st.sw <= st.iw && st.sh <= st.ih);
      if (id === "spark") {
        const small = await p.evaluate(() => [...document.querySelectorAll("#hud button")].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.className, w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.w < 48 || r.h < 48));
        ok(`${vn} all HUD touch targets >= 48px`, small.length === 0, JSON.stringify(small)); }
      await p.close(); }
    // perk pick via V hotkey, then key 1
    { const p = await open(vp, "?demo&seed=5&warp=150"); await p.evaluate(() => { const sd = __AGE.sim.sides.player; sd.xp = 5000; });
      await p.keyboard.press("v"); await sleep(2500); const vis = await p.evaluate(() => !document.getElementById("perkScr").classList.contains("hidden"));
      await shot(p, "perk-" + vn); await p.keyboard.press("1"); await sleep(200);
      const r = await p.evaluate(() => ({ age: __AGE.sim.sides.player.ageIdx, perks: __AGE.sim.sides.player.perkOrder.length, hidden: document.getElementById("perkScr").classList.contains("hidden") }));
      ok(`${vn} V evolves, perk overlay, key 1 picks`, vis && r.age === 1 && r.perks === 1 && r.hidden, JSON.stringify(r)); await p.close(); }
    // special firing (Space) mid-telegraph/impact
    { const p = await open(vp, "?demo&seed=5&warp=150"); const n0 = await p.evaluate(() => { __AGE.sim.sides.player.specialCd = 0; return __AGE.sim.sides.player.stats.specials; }); await sleep(200);
      await p.keyboard.press(" "); await sleep(1350); const n = await p.evaluate(() => __AGE.sim.sides.player.stats.specials);
      await shot(p, "special-" + vn); ok(`${vn} Space fires special`, n === n0 + 1, "specials " + n0 + "->" + n); await p.close(); }
  }
  // hotkeys on desktop: 1-4 units, Q W E R sockets + picker, P pause
  { const p = await open(VP.desk, "?demo&seed=5&warp=30"); await p.evaluate(() => { const sd = __AGE.sim.sides.player; sd.gold = 2000; sd.queue.length = 0; });
    for (const k of ["1", "2", "3", "4"]) await p.keyboard.press(k); await sleep(100);
    const q = await p.evaluate(() => __AGE.sim.sides.player.queue.map(x => x.type).join(","));
    ok("keys 1-4 queue the 4 units", q.split(",").length === 4 && new Set(q.split(",")).size === 4, q);
    let built = [];
    for (const [i, k] of ["q", "w", "e", "r"].entries()) { await p.keyboard.press(k); await sleep(60); const vis = await p.evaluate(() => !document.getElementById("picker").classList.contains("hidden")); await p.keyboard.press(String((i % 3) + 1)); await sleep(60); built.push(vis); }
    const t = await p.evaluate(() => Object.keys(__AGE.sim.sides.player.turrets).length); ok("Q W E R open picker and build in all 4 sockets", built.every(Boolean) && t === 4, "turrets " + t);
    await p.keyboard.press("w"); await sleep(60); await shot(p, "picker-1280x720"); await p.keyboard.press("x"); await sleep(60);
    const t2 = await p.evaluate(() => Object.keys(__AGE.sim.sides.player.turrets).length); ok("picker X sells", t2 === 3);
    await p.keyboard.press("p"); await sleep(100); const pz = await p.evaluate(() => !document.getElementById("pauseScr").classList.contains("hidden")); await shot(p, "pause-1280x720");
    await p.keyboard.press("Escape"); await sleep(100); const un = await p.evaluate(() => document.getElementById("pauseScr").classList.contains("hidden")); ok("P pauses, Esc resumes", pz && un);
    await p.close(); }
  // touch flow on phone: tap start, tap unit card, tap socket, tap option
  { const p = await open(VP.phone, ""); await p.tap("#startBtn"); await sleep(300); await p.evaluate(() => { __AGE.sim.sides.player.gold = 500; });
    await p.tap("#cards .card"); await p.tap("#socks .sock"); await sleep(100); await p.tap("#picker .opt"); await sleep(150);
    const r = await p.evaluate(() => ({ q: __AGE.sim.sides.player.queue.length + __AGE.sim.units.length, t: Object.keys(__AGE.sim.sides.player.turrets).length }));
    ok("phone touch: card + socket picker work", r.q >= 1 && r.t === 1, JSON.stringify(r)); await p.close(); }
  // destroyed base (collapse -> rubble) before the results overlay appears
  { const p = await open(VP.desk, "?demo&autoplay&seed=3&warp=730"); await p.waitForFunction("window.__AGE.sim.over", { timeout: 60000 }); await sleep(1900); await shot(p, "destroyed-1280x720");
    const hp = await p.evaluate(() => Math.min(__AGE.sim.sides.enemy.base.hp, __AGE.sim.sides.player.base.hp)); ok("a base reached 0 HP and was captured destroyed", hp === 0); await p.close(); }
  // portrait sanity
  { const p = await open(VP.port, "?demo&autoplay&seed=5&warp=300"); await sleep(3000); await shot(p, "portrait-390x844");
    const st = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight })); ok("portrait no scroll", st.sw <= st.iw && st.sh <= st.ih, JSON.stringify(st)); await p.close(); }
  ok("no console errors", errors.length === 0, errors.slice(0, 6).join(" | "));
  console.log(results.join("\n")); console.log(fails ? `\n${fails} FAILED` : "\nALL PASS"); await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
