// Renders unit frame strips (idle / walk / attack across one attack interval) at 3x into shots/anim/<tag>-*.png
//   node test/anim-frames.js [tag=after]
const puppeteer = require("puppeteer-core"), path = require("path"), fs = require("fs");
const FILE = "file://" + path.join(__dirname, "..", "index.html"), OUT = path.join(__dirname, "..", "shots", "anim"), tag = process.argv[2] || "after";
(async () => { fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] }), p = await b.newPage(); await p.goto(FILE, { waitUntil: "load" });
  const types = process.argv[3] ? process.argv[3].split(",") : await p.evaluate(() => Object.keys(DATA.units));
  for (const t of types) for (const side of ["player", "enemy"]) {
    const url = await p.evaluate((t, side) => { const U = DATA.units[t], f = [];
      for (let i = 0; i < 4; i++) f.push({ clock: i * 0.15, label: "idle" });
      for (let i = 0; i < 6; i++) f.push({ moving: true, walk: i * 5, clock: i * 0.1, label: "walk" });
      const mz = U.muzzle || [8, U.height - 6];
      if (U.projectile) for (const w of [0.2, 0.45, 0.7, 0.85, 1]) f.push({ windup: w, clock: 10, label: "wind " + w, proj: w === 1 ? mz : null });
      const n = 8; for (let i = 0; i < n; i++) { const sw = i / n; f.push({ swing: sw, clock: 10 + sw * 0.5, label: (U.projectile ? "rel " : "atk ") + sw.toFixed(2), proj: U.projectile && i <= 1 ? [mz[0] + i * 10, mz[1]] : null }); }
      return __ART.strip(t, side, f, 3); }, t, side);
    fs.writeFileSync(path.join(OUT, `${tag}-${t}-${side}.png`), Buffer.from(url.split(",")[1], "base64")); }
  console.log("wrote", types.length * 2, "strips to", OUT); await b.close(); })();
