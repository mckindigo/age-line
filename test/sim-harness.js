// Node harness: extracts the inline <script id="game"> from index.html and runs the pure sim headless.
const fs = require("fs"), vm = require("vm"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const src = html.match(/<script id="game">([\s\S]*?)<\/script>/)[1];
const ctx = { console, Math, Map, JSON }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const A = ctx.AGELINE;
const rows = []; let fail = 0;
const check = (name, ok, info) => { rows.push((ok ? "PASS " : "FAIL ") + name + (info ? "  " + info : "")); if (!ok) fail++; };
const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const summary = {};
for (const diff of ["normal", "hard", "impossible"]) for (const bot of ["smart", "rush", "idle"]) {
  const rs = seeds.map(seed => A.runHeadless({ seed, difficulty: diff, bot, maxT: 1200 }));
  const wins = rs.filter(r => r.result === "win").length, times = rs.map(r => r.time);
  summary[diff + "/" + bot] = { wins: wins + "/" + rs.length, avgTime: +(times.reduce((a, b) => a + b, 0) / rs.length).toFixed(1), min: Math.min(...times), max: Math.max(...times), results: rs.map(r => r.result[0]).join("") };
}
console.table(summary);
const n = summary["normal/smart"], idle = summary["normal/idle"];
check("normal: smart bot wins every seed", n.wins === "10/10", JSON.stringify(n));
check("normal: smart win time in 3-6 min", n.min >= 170 && n.max <= 380, `min ${n.min}s max ${n.max}s`);
check("normal: idle player loses every seed", idle.results === "llllllllll", JSON.stringify(idle));
check("hard: smart bot can win (winnable)", parseInt(summary["hard/smart"].wins) > 0, JSON.stringify(summary["hard/smart"]));
check("normal: clubber-spam rush is not a guaranteed win", parseInt(summary["normal/rush"].wins) < 10 || summary["normal/rush"].avgTime > n.avgTime, JSON.stringify(summary["normal/rush"]));
check("impossible harder than normal (smart)", summary["impossible/smart"].avgTime > n.avgTime || parseInt(summary["impossible/smart"].wins) < 10, JSON.stringify(summary["impossible/smart"]));
const a = A.runHeadless({ seed: 42, difficulty: "hard", bot: "smart" }), b = A.runHeadless({ seed: 42, difficulty: "hard", bot: "smart" });
check("deterministic (same seed -> same hash)", a.hash === b.hash && a.time === b.time, a.hash + " vs " + b.hash);
// rules sanity
const s = A.createSim({ seed: 1 });
check("start gold 60", s.gold === 60);
for (let i = 0; i < 4; i++) A.simEnqueue(s, "stone_clubber");
check("queue enqueue & gold deducted", s.queue.length === 4 && s.gold === 0);
s.gold = 1000; A.simEnqueue(s, "stone_clubber"); check("queue max 5", A.simEnqueue(s, "stone_clubber") === "full" && s.queue.length === 5);
A.simCancel(s, 4); check("cancel refunds", s.gold === 1000 - 15 + 15 - 0 && s.queue.length === 4, "gold " + s.gold);
for (let i = 0; i < 31; i++) A.simStep(s, A.TICK);
check("one unit builds at a time (1.0s)", s.stats.trained === 1 && s.queue.length === 3, "trained " + s.stats.trained);
check("gold trickle +2/s", Math.abs(s.gold - (1000 + 2 * 31 * A.TICK)) < 1e-6, s.gold.toFixed(2));
check("turret build", A.simBuildTurret(s, "slot1", "stone_rock_sling") === "ok" && s.gold < 1000);
const g0 = s.gold; check("turret sell refunds 25%", A.simSellTurret(s, "slot1") === 25 && s.gold === g0 + 25);
console.log(rows.join("\n")); console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
