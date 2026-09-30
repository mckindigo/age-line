// Sanity test: node design/ai.test.js  — mock 5-age roster, mini economy, validates every action.
"use strict";
const { createEnemyAI, PROFILES } = require("./ai.js");
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const AGES = ["stone", "bronze", "iron", "gunpowder", "future"], ROLES = ["melee", "ranged", "tank", "siege"];
const unitDefs = {}, ages = AGES.map((a, i) => {
  const m = Math.pow(2.2, i);
  const units = ROLES.map((r, j) => { const d = { id: `${a}_u${j}`, age: a, role: r, cost: Math.round([15, 25, 45, 60][j] * m),
    hp: Math.round([55, 40, 140, 70][j] * m), dmg: [16, 10, 8, 30][j] * m, atkInterval: [1, 1.2, 1.3, 2][j], range: [20, 140, 20, 180][j] }; unitDefs[d.id] = d; return d; });
  const turrets = [0, 1, 2].map(k => ({ id: `${a}_t${k}`, age: a, cost: Math.round([100, 160, 240][k] * m), dmg: [12, 20, 30][k] * m, atkInterval: 1.2, range: [260, 220, 300][k] }));
  return { id: a, xpToNext: i < 4 ? 4000 * (i + 1) : null, units, turrets, special: { id: `${a}_sp`, cooldown: 60, radius: 90 } };
});
const PERKS = [
  { id: "eco_income", category: "economy", stat: "goldPerSec", value: 0.15 },
  { id: "eco_bounty", category: "economy", stat: "bountyGold", value: 0.1 },
  { id: "melee_hp", category: "role", target: "melee", stat: "hp", value: 0.1 },
  { id: "ranged_dmg", category: "role", target: "ranged", stat: "dmg", value: 0.1 },
  { id: "tank_hp", category: "role", target: "tank", stat: "hp", value: 0.15 },
  { id: "turret_dmg", category: "turret", target: null, stat: "dmg", value: 0.15 },
  { id: "special_cd", category: "special", stat: "cooldown", value: -0.2 }];
const SLOTS = ["e_slot1", "e_slot2", "e_slot3"];
let errors = 0, counts = {}; const err = m => { if (errors++ < 20) console.error("FAIL:", m); };

function run(profile, seed, startAge, steps) {
  const rng = mulberry32(seed), wr = mulberry32(seed ^ 0x9e37);
  const ai = createEnemyAI(profile, rng);
  const st = { t: 0, over: null, world: { width: 1200, playerBaseX: 80, enemyBaseX: 1120 }, unitDefs,
    enemy: { gold: 60 + wr() * 400 * Math.pow(2.2, startAge), xp: 0, ageIndex: startAge, xpToNext: ages[startAge].xpToNext, queue: [], queueMax: 5,
      turrets: {}, turretSlots: SLOTS, specialCooldown: 0, baseHp: 1000, baseMax: 1000, pendingPerk: null },
    player: { ageIndex: startAge, baseHp: 1000, baseMax: 1000, units: [] }, roster: null };
  const dt = 1 / 30;
  for (let i = 0; i < steps; i++) {
    const E = st.enemy, age = ages[E.ageIndex];
    st.roster = { units: age.units, turrets: age.turrets, special: age.special, evolveGoldCost: 0 };
    E.xpToNext = age.xpToNext;
    st.t += dt; E.gold += 2 * dt * Math.pow(1.6, E.ageIndex); E.xp += wr() < 0.02 ? 25 * (E.ageIndex + 1) * 10 : 0;
    E.specialCooldown = Math.max(0, E.specialCooldown - dt);
    if (E.queue.length && wr() < dt / 1.5) E.queue.shift();
    // random-walk player units; occasionally spawn/kill; player age sometimes ahead
    if (wr() < 0.03 && st.player.units.length < 25) { const pa = Math.min(4, E.ageIndex + (wr() < 0.2 ? 1 : 0)); st.player.ageIndex = pa;
      const d = ages[pa].units[Math.floor(wr() * 4)]; st.player.units.push({ type: d.id, role: d.role, x: 130 + wr() * 950, hp: d.hp, maxHp: d.hp }); }
    for (const u of st.player.units) { u.x = Math.min(1070, u.x + 40 * dt); if (wr() < 0.003) u.hp = 0; }
    st.player.units = st.player.units.filter(u => u.hp > 0);
    if (wr() < 0.001) E.baseHp = Math.max(100, E.baseHp - 200);
    let acts;
    try { acts = ai.tick(st, dt); } catch (e) { err(`${profile} threw: ${e.stack}`); return; }
    if (!Array.isArray(acts)) { err("non-array"); return; }
    for (const a of acts) {
      counts[a.type] = (counts[a.type] || 0) + 1;
      const R = st.roster;
      if (a.type === "queue") {
        const d = R.units.find(u => u.id === a.unitId);
        if (!d) err(`bad unitId ${a.unitId} age ${E.ageIndex}`);
        else if (E.gold < d.cost - 1e-9) err(`unaffordable ${a.unitId} ${E.gold}<${d.cost}`);
        else if (E.queue.length >= E.queueMax) err("queue overflow");
        else { E.gold -= d.cost; E.queue.push(a.unitId); }
      } else if (a.type === "turret") {
        const d = R.turrets.find(u => u.id === a.turretId);
        if (!d) err(`bad turretId ${a.turretId}`); else if (!SLOTS.includes(a.slot)) err(`bad slot ${a.slot}`);
        else if (E.turrets[a.slot]) err("slot occupied"); else if (E.gold < d.cost - 1e-9) err("turret unaffordable");
        else { E.gold -= d.cost; E.turrets[a.slot] = a.turretId; }
      } else if (a.type === "evolve") {
        if (E.xpToNext == null || E.xp < E.xpToNext) err("evolve not allowed");
        else { E.ageIndex++; E.xp = 0; E.pendingPerk = { options: pick3(wr) }; }
      } else if (a.type === "special") {
        if (E.specialCooldown > 0) err("special on cooldown");
        if (!(a.x >= 80 && a.x <= 1120)) err(`special x out of lane ${a.x}`);
        E.specialCooldown = R.special.cooldown;
        st.player.units = st.player.units.filter(u => Math.abs(u.x - a.x) > R.special.radius);
      } else if (a.type === "perk") {
        if (!E.pendingPerk || !E.pendingPerk.options.some(o => o.id === a.perkId)) err(`bad perk ${a.perkId}`);
        E.pendingPerk = null;
      } else err(`unknown action ${JSON.stringify(a)}`);
    }
    if (E.gold < -1e-9) err("negative gold");
  }
  return st;
}
function pick3(r) { const p = PERKS.slice(); const o = []; while (o.length < 3) o.push(p.splice(Math.floor(r() * p.length), 1)[0]); return o; }

let runs = 0;
for (const prof of Object.keys(PROFILES)) {
  const before = JSON.stringify(counts); counts = {};
  let finalAges = [];
  for (let age = 0; age < 5; age++) for (let seed = 1; seed <= 4; seed++) { const s = run(prof, seed * 7 + age, age, 30 * 120); runs++; if (s) finalAges.push(s.enemy.ageIndex); }
  console.log(prof.padEnd(10), JSON.stringify(counts), "finalAges:", finalAges.join(""));
}
// direct choosePerk checks
const ai = createEnemyAI("hard", mulberry32(5));
const early = { enemy: { ageIndex: 0, turrets: {}, turretSlots: SLOTS } };
const tally = {}; for (let i = 0; i < 200; i++) { const id = ai.choosePerk(pick3(mulberry32(i)), early); if (!PERKS.some(p => p.id === id)) err("choosePerk bad id"); tally[id] = (tally[id] || 0) + 1; }
console.log("choosePerk early-game tally:", JSON.stringify(tally));
if (ai.choosePerk([], early) !== null) err("choosePerk empty should be null");
// garbage input must not throw
try { ai.tick(null, 0.1); ai.tick({}, 0.1); ai.tick({ enemy: {} , t: 5}, 5); ai.tick({ enemy: { gold: 1e6 }, roster: {}, t: 9 }, 5); } catch (e) { err("garbage threw " + e); }
console.log(`${runs} runs x 3600 ticks. errors: ${errors}`);
process.exit(errors ? 1 : 0);
