// Headless Chrome test: console errors, autotest win/lose, UI flow, screenshots.
const puppeteer = require("puppeteer-core"), path = require("path");
const FILE = "file://" + path.join(__dirname, "..", "index.html"), SHOTS = path.join(__dirname, "..", "shots");
const sizes = { desktop: { width: 1280, height: 720 }, "phone-landscape": { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  "phone-portrait": { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const errors = [], results = [];
  const open = async (vp, q) => { const p = await browser.newPage(); await p.setViewport(vp);
    p.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); p.on("pageerror", e => errors.push(String(e)));
    await p.goto(FILE + (q || ""), { waitUntil: "load" }); return p; };
  const ok = (name, cond, info) => { results.push((cond ? "PASS " : "FAIL ") + name + (info ? "  " + info : "")); };
  // autotests
  for (const [q, want] of [["?autotest=win&diff=normal&seed=7", "win"], ["?autotest=lose&diff=normal&seed=7", "lose"], ["?autotest=win&diff=hard&seed=4", "win"]]) {
    const p = await open(sizes.desktop, q);
    await p.waitForFunction("window.__AUTOTEST_RESULT", { timeout: 120000 });
    const r = await p.evaluate("window.__AUTOTEST_RESULT");
    await new Promise(r => setTimeout(r, 400));
    const resVisible = await p.evaluate(() => !document.getElementById("results").classList.contains("hidden"));
    ok(`autotest ${q} -> ${want}`, r.result === want && resVisible, JSON.stringify(r));
    if (want === "win" && q.includes("normal")) await p.screenshot({ path: SHOTS + "/desktop-results-win.png" });
    if (want === "lose") await p.screenshot({ path: SHOTS + "/desktop-results-lose.png" });
    await p.close();
  }
  // real UI flow on desktop with mouse
  {
    const p = await open(sizes.desktop, "");
    await p.screenshot({ path: SHOTS + "/desktop-menu.png" });
    await p.click('.diff[data-d="hard"]'); await p.click("#startBtn");
    await new Promise(r => setTimeout(r, 300));
    const st = await p.evaluate(() => ({ mode: !document.getElementById("hud").classList.contains("hidden"), diff: window.__AGE.sim.diffId, gold: window.__AGE.sim.gold }));
    ok("menu -> match (hard) via clicks", st.mode && st.diff === "hard", JSON.stringify(st));
    await p.click("#card-stone_clubber"); await p.click("#card-stone_clubber"); await p.keyboard.press("1");
    const q = await p.evaluate(() => window.__AGE.sim.queue.length + window.__AGE.sim.stats.trained);
    ok("tap/click + hotkey enqueue units", q === 3, "queued+trained=" + q);
    await p.keyboard.press("p"); const paused = await p.evaluate(() => !document.getElementById("pauseScr").classList.contains("hidden"));
    const t1 = await p.evaluate(() => window.__AGE.sim.t); await new Promise(r => setTimeout(r, 500)); const t2 = await p.evaluate(() => window.__AGE.sim.t);
    ok("pause freezes sim", paused && t1 === t2, `t ${t1.toFixed(2)} -> ${t2.toFixed(2)}`);
    await p.click("#resumeBtn"); await new Promise(r => setTimeout(r, 500)); const t3 = await p.evaluate(() => window.__AGE.sim.t);
    ok("resume continues", t3 > t2);
    const disabled = await p.evaluate(() => document.getElementById("card-evolve").classList.contains("locked"));
    ok("evolve locked (Next age in v0.2)", disabled);
    await p.close();
  }
  // touch flow + long-press tooltip on phone
  {
    const p = await open(sizes["phone-landscape"], "");
    await p.tap("#startBtn"); await new Promise(r => setTimeout(r, 300));
    await p.tap("#card-stone_clubber"); const n = await p.evaluate(() => window.__AGE.sim.queue.length);
    ok("touch tap enqueues", n === 1);
    const box = await (await p.$("#card-stone_slinger")).boundingBox();
    await p.touchscreen.touchStart(box.x + 20, box.y + 20); await new Promise(r => setTimeout(r, 650));
    const tip = await p.evaluate(() => !document.getElementById("tip").classList.contains("hidden"));
    await p.touchscreen.touchEnd();
    const n2 = await p.evaluate(() => window.__AGE.sim.queue.length + window.__AGE.sim.stats.trained);
    ok("long-press shows tooltip without buying", tip && n2 === 1, "tip=" + tip + " q=" + n2);
    const small = await p.evaluate(() => [...document.querySelectorAll("#hud button")].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.width < 48 || r.height < 48).length);
    ok("all HUD touch targets >= 48px (phone landscape)", small === 0, small + " small");
    const scroll = await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
    ok("no page overflow/scroll", scroll);
    await p.close();
  }
  // screenshots mid-battle (demo bot fast-forwarded to 150s sim time)
  for (const [name, vp] of Object.entries(sizes)) {
    const p = await open(vp, "?demo&warp=150&seed=3");
    await new Promise(r => setTimeout(r, 1500));
    await p.screenshot({ path: `${SHOTS}/${name}-${vp.width}x${vp.height}.png` });
    if (name === "phone-portrait") { const hint = await p.evaluate(() => getComputedStyle(document.getElementById("rotate")).display); ok("portrait shows rotate hint", hint !== "none", hint); }
    const small = await p.evaluate(() => [...document.querySelectorAll("#hud button")].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.width < 48 || r.height < 48).length);
    ok(`touch targets >= 48px (${name})`, small === 0, small + " small");
    await p.close();
  }
  { const p = await open(sizes["phone-portrait"], ""); await p.screenshot({ path: SHOTS + "/phone-portrait-menu.png" }); await p.close(); }
  ok("no console errors", errors.length === 0, errors.join(" | "));
  console.log(results.join("\n")); await browser.close(); process.exit(results.some(r => r.startsWith("FAIL")) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
