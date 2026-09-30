// Node harness (v0.2): extracts the inline <script id="game"> from index.html and runs the pure sim headless.
//   node test/sim-harness.js [seeds=10]
const fs = require("fs"), vm = require("vm"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const src = html.match(/<script id="game">([\s\S]*?)<\/script>/)[1];
const ctx = { console, Math, Map, JSON, Object, Array }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const A = ctx.AGELINE, D = A.DATA, N = +(process.argv[2] || 10);
const rows = []; let fail = 0;
const check = (name, ok, info) => { rows.push((ok ? "PASS " : "FAIL ") + name + (info ? "  " + info : "")); if (!ok) fail++; };
const summary = {}, runs = {};
for (const diff of ["normal", "hard", "impossible"]) for (const bot of ["mixed", "rush", "idle"]) {
  if (bot !== "mixed" && diff !== "normal") continue;
  const rs = []; for (let seed = 1; seed <= N; seed++) rs.push(A.runHeadless({ seed, difficulty: diff, bot, maxT: 2400 }));
  runs[diff + "/" + bot] = rs; const w = rs.filter(r => r.result === "win"), tm = rs.map(r => r.time / 60);
  summary[diff + "/" + bot] = { wins: w.length, of: N, avgMin: +(tm.reduce((a, b) => a + b, 0) / N).toFixed(1), minMin: +Math.min(...tm).toFixed(1), maxMin: +Math.max(...tm).toFixed(1),
    winAvgMin: w.length ? +(w.reduce((a, r) => a + r.time, 0) / w.length / 60).toFixed(1) : null, maxAge: Math.max(...rs.map(r => r.pAge)) + 1, rejected: rs.reduce((a, r) => a + r.aiRejected, 0) };
}
console.table(summary);
const n = summary["normal/mixed"], h = summary["hard/mixed"], im = summary["impossible/mixed"];
check("normal: mixed bot reaches all 5 ages", runs["normal/mixed"].some(r => r.pAge === 4), "max age " + n.maxAge);
check("enemy AI reaches all 5 ages", runs["hard/mixed"].some(r => r.eAge === 4));
check("normal: mixed bot wins >= 8/10", n.wins >= Math.ceil(N * 0.8), JSON.stringify(n));
check("normal: win length 10-25 min", runs["normal/mixed"].filter(r => r.result === "win").every(r => r.time >= 600 && r.time <= 1500), `win avg ${n.winAvgMin}m (${n.minMin}-${n.maxMin})`);
check("hard harder than normal", h.wins < n.wins, `${h.wins} vs ${n.wins}`);
check("impossible very hard (<= 2/10)", im.wins <= Math.ceil(N * 0.2) && im.wins <= h.wins, `${im.wins}/${N}`);
check("idle player loses every seed", summary["normal/idle"].wins === 0);
check("AI actions all valid (0 rejected)", Object.values(summary).every(s => s.rejected === 0));
const a = A.runHeadless({ seed: 42, difficulty: "hard" }), b = A.runHeadless({ seed: 42, difficulty: "hard" });
check("deterministic (same seed -> same hash)", a.hash === b.hash && a.time === b.time, a.hash + " vs " + b.hash);
// ---- rules ----
const s = A.createSim({ seed: 1 }), sd = s.sides.player;
check("4 turret slots", D.turretSlots.length === 4);
check("start gold 60", s.gold === 60);
for (let i = 0; i < 4; i++) A.simEnqueue(s, "stone_clubber");
check("enqueue deducts gold", s.queue.length === 4 && s.gold === 0);
s.gold = 1000; A.simEnqueue(s, "stone_clubber"); check("queue max 5", A.simEnqueue(s, "stone_clubber") === "full" && s.queue.length === 5);
check("off-roster unit rejected", A.simEnqueue(s, "kiln_clanger") !== "ok");
A.simCancel(s, 4); check("cancel refunds", s.gold === 1000 && s.queue.length === 4, "gold " + s.gold);
s.gold = 1000;
check("build turret in 4th slot", A.simBuildTurret(s, "slot3", "stone_rock_sling") === "ok" && sd.turrets.slot3);
const T1 = D.turrets.stone_rock_sling, T2 = D.turrets.stone_bone_rack, g1 = s.gold;
check("replace refunds 25% of old", A.simBuildTurret(s, "slot3", "stone_bone_rack") === "ok" && Math.abs(s.gold - (g1 - T2.cost + Math.floor(T1.cost * 0.25))) < 1e-9);
const g2 = s.gold; check("sell refunds 25%", A.simSellTurret(s, "slot3") === Math.floor(T2.cost * 0.25) && s.gold === g2 + Math.floor(T2.cost * 0.25));
check("evolve blocked without XP", A.simEvolve(s) === false);
sd.xp = D.ages[0].xpToNext + 100; const hpFrac = sd.base.hp / sd.base.max;
check("evolve -> kiln, perk offer of 3", A.simEvolve(s) && sd.ageIdx === 1 && sd.pendingPerk && sd.pendingPerk.options.length === 3);
check("evolve keeps base HP %", Math.abs(sd.base.hp / sd.base.max - hpFrac) < 1e-9 && sd.base.max === D.ages[1].baseMaxHp);
check("leftover XP carried (capped)", sd.xp > 0 && sd.xp <= D.ages[1].xpToNext * D.economy.carryXpFrac);
const pid = sd.pendingPerk.options[0]; check("pick perk", A.simPickPerk(s, pid) && sd.perks[pid] === 1 && !sd.pendingPerk);
check("pick perk twice rejected", A.simPickPerk(s, pid) === false);
// specials never damage bases
{ const t = A.createSim({ seed: 3 }); const P = t.sides.player, E = t.sides.enemy; let ok = true;
  for (let ai = 0; ai < 5; ai++) { P.ageIdx = ai; E.ageIdx = ai; P.specialCd = 0; t.units.length = 0; const hp0 = E.base.hp; A.simFireSpecial(t, 1000);
    for (let i = 0; i < 300; i++) { t.enemyAI = { tick() { return []; } }; A.simStep(t, A.TICK); } if (E.base.hp < hp0 - 1e-6 && !t.overtime) ok = false; }
  check("specials never damage bases (all 5 ages)", ok); }
// special telegraph drops scheduled ahead
{ const t = A.createSim({ seed: 9 }); t.sides.player.specialCd = 0; A.simFireSpecial(t, 600); const e = t.events.find(x => x.type === "special");
  check("laneRain drops pre-rolled with times >= telegraph", e && e.drops && e.drops.length === D.specials.stone_rockslide.params.projectiles && e.drops.every(d => d.at >= e.tele && isFinite(d.x))); }
// shoot events carry x/y
{ const t = A.createSim({ seed: 2 }); t.sides.player.gold = 999; A.simBuildTurret(t, "slot0", "stone_rock_sling"); let shot = null;
  for (let i = 0; i < 30 * 60 && !shot; i++) { A.simStep(t, A.TICK); shot = t.events.find(x => x.type === "shoot"); }
  check("shoot events carry x/y", shot && isFinite(shot.x) && isFinite(shot.y), JSON.stringify(shot)); }
console.log(rows.join("\n")); console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
fs.writeFileSync(path.join(__dirname, "sim-results.json"), JSON.stringify(summary, null, 1));
process.exit(fail ? 1 : 0);
