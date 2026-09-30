/* AGE LINE — enemy opponent AI (design/ai.js)
 * Pure, dependency-free. UMD: module.exports in Node, globalThis/window.AGELINE_AI in the browser
 * (index.html is a single inline classic <script>, so no ES `export`).
 *
 *   const ai = createEnemyAI('hard', rng);      // or createEnemyAI({ ...customNumbers }, rng)
 *   const actions = ai.tick(state, dt);          // see ai.md for the state contract
 *   ai.choosePerk(options, state) -> perkId
 *
 * Actions: {type:'queue',unitId} {type:'turret',slot,turretId} {type:'evolve'} {type:'special',x} {type:'perk',perkId}
 * Never hardcodes unit/turret ids: everything comes from state.roster (the enemy's CURRENT age).
 * Uses only the enemy's own gold/xp plus observable board state. No resource bonuses (see goldIncomeMult knob, default 1 = off).
 */
(function (root) {
  "use strict";

  /* ------------------------------------------------------------------
   * PROFILES — the ONLY place difficulty lives. Same logic, different numbers.
   * ------------------------------------------------------------------ */
  var PROFILES = {
    normal: {
      thinkInterval: 1.2,      // s between decisions
      thinkJitter: 0.35,       // +/- fraction random on thinkInterval
      reactionDelay: 3.0,      // s: AI reads the player's composition as it was this long ago
      scoutRange: 0.55,        // fraction of lane (from enemy base) the AI "watches" for counters
      reservePct: 0.30,        // fraction of gold banked when there is no pressure
      pressureReservePct: 0.05,// reserve when under pressure (spend down)
      turretShare: 0.25,       // fraction of spendable gold allowed to go to turrets per think
      turretMinTime: 60,       // s: earliest turret build unless under pressure
      queueCap: 3,             // max own queue length the AI keeps (<= state.enemy.queueMax)
      maxBuysPerThink: 1,      // units queued per think
      counterAccuracy: 0.55,   // P(pick best-scoring counter) vs weighted-random among candidates
      mistakeRate: 0.15,       // P(a think makes a random/suboptimal pick or skips)
      evolveBankFactor: 0.5,   // evolve when gold >= this * avg unit cost of NEXT-age-equivalent (proxy: current avg * 1.5)
      evolveAggression: 0.35,  // 0..1: willingness to evolve while under pressure / before player
      evolveDelay: 12,         // s it waits after XP allows before evolving (if not forced)
      specialClusterUnits: 4,  // min player units in blast window
      specialClusterValue: 3.0,// min cluster value, in multiples of current-age avg unit cost
      specialPanicHpPct: 0.35, // fire special at any cluster >=2 when own base HP below this
      specialAimError: 40,     // px random aim error
      perkRandomness: 0.35,    // noise added to perk scores (0 = pure argmax)
      perkMistakeRate: 0.15,   // P(pick a random perk)
      saveChance: 0.35,        // [integration v0.2] P(wait for the best-scoring counter when it is not affordable yet)
      saveHorizon: 8,          // [integration v0.2] only wait if income covers the gap within this many seconds
      goldIncomeMult: 1.0      // OPTIONAL CHEAT KNOB (integrator applies it to enemy income). 1 = off. Default off in all profiles.
    },
    hard: {
      thinkInterval: 0.7, thinkJitter: 0.25, reactionDelay: 1.5, scoutRange: 0.7,
      reservePct: 0.20, pressureReservePct: 0.0, turretShare: 0.30, turretMinTime: 40,
      queueCap: 4, maxBuysPerThink: 2, counterAccuracy: 0.8, mistakeRate: 0.06,
      evolveBankFactor: 0.8, evolveAggression: 0.6, evolveDelay: 5,
      specialClusterUnits: 3, specialClusterValue: 2.5, specialPanicHpPct: 0.45, specialAimError: 20,
      perkRandomness: 0.15, perkMistakeRate: 0.05, saveChance: 0.6, saveHorizon: 10, goldIncomeMult: 1.0
    },
    impossible: {
      thinkInterval: 0.35, thinkJitter: 0.1, reactionDelay: 0.4, scoutRange: 0.9,
      reservePct: 0.12, pressureReservePct: 0.0, turretShare: 0.50, turretMinTime: 15,
      queueCap: 5, maxBuysPerThink: 3, counterAccuracy: 0.95, mistakeRate: 0.01,
      evolveBankFactor: 1.0, evolveAggression: 0.85, evolveDelay: 1,
      specialClusterUnits: 3, specialClusterValue: 2.0, specialPanicHpPct: 0.55, specialAimError: 6,
      perkRandomness: 0.05, perkMistakeRate: 0.0, saveChance: 0.85, saveHorizon: 12, goldIncomeMult: 1.0
    }
  };

  /* Default role counter table, used when a unit def has no explicit `counters` field.
   * DEFAULT_COUNTERS[theirRole] = { myRole: weight }  (higher = better answer). Unknown roles fall back to stats. */
  var DEFAULT_COUNTERS = {
    melee:   { ranged: 1.0, tank: 0.8, melee: 0.5, siege: 0.3, support: 0.2 },
    ranged:  { tank: 1.0, melee: 0.8, siege: 0.4, ranged: 0.5, support: 0.2 },
    tank:    { siege: 1.0, ranged: 0.7, melee: 0.3, tank: 0.5, support: 0.2 },
    siege:   { melee: 1.0, tank: 0.6, ranged: 0.6, siege: 0.4, support: 0.3 },
    support: { ranged: 0.8, melee: 0.8, siege: 0.6, tank: 0.5, support: 0.3 }
  };

  function num(v, d) { return typeof v === "number" && isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function asArray(x) { if (!x) return []; if (Array.isArray(x)) return x; return Object.keys(x).map(function (k) { return x[k]; }); }

  function createEnemyAI(profile, rng) {
    var P = {};
    var base = PROFILES.normal;
    var src = typeof profile === "string" ? (PROFILES[profile] || base) : (profile || base);
    for (var k in base) P[k] = src[k] != null ? src[k] : base[k];
    if (typeof rng !== "function") throw new Error("createEnemyAI: rng function required");
    var R = function () { var v = rng(); return v >= 0 && v < 1 ? v : 0; };

    var mem = {
      thinkIn: 0.5 + R() * 0.5,    // first think shortly after start
      history: [],                  // [{t, comp}] player composition snapshots (for reaction delay)
      evolveReadyAt: null,          // t when XP first allowed evolve
      lastAge: null,
      built: {},                    // role -> count queued by us (for perk choice)
      specialsFired: 0,
      turretsBuilt: 0,
      lastPerkKey: null
    };

    /* ---------------- observation helpers ---------------- */
    function lane(state) {
      var w = state.world || {};
      return { pb: num(w.playerBaseX, 80), eb: num(w.enemyBaseX, 1120) };
    }
    var SAVE = { save: true };
    function unitDefs(state) { return asArray(state.roster && state.roster.units); }
    function turretDefs(state) { return asArray(state.roster && state.roster.turrets); }
    function avgCost(defs) { if (!defs.length) return 20; var s = 0; defs.forEach(function (d) { s += num(d.cost, 0); }); return Math.max(1, s / defs.length); }
    function playerUnits(state) { return asArray(state.player && state.player.units).filter(function (u) { return u && num(u.hp, 1) > 0 && typeof u.x === "number"; }); }
    function unitValue(u, state) {
      // value of a visible player unit: cost (if given or known from state.unitDefs) scaled by remaining HP
      var d = state.unitDefs && state.unitDefs[u.type];
      var c = num(u.cost, d ? num(d.cost, 20) : 20);
      var frac = u.maxHp ? clamp(num(u.hp, u.maxHp) / u.maxHp, 0, 1) : 1;
      return c * (0.35 + 0.65 * frac);
    }
    function roleOf(u, state) { var d = state.unitDefs && state.unitDefs[u.type]; return u.role || (d && d.role) || "melee"; }

    // Pressure: how much player value is on our half, weighted by closeness to our base. 0..~3
    function pressure(state) {
      var L = lane(state), span = Math.max(1, L.eb - L.pb), ac = avgCost(unitDefs(state)), p = 0;
      playerUnits(state).forEach(function (u) {
        var prog = clamp((u.x - L.pb) / span, 0, 1); // 0 at player base, 1 at our base
        if (prog > 0.45) p += unitValue(u, state) * (prog - 0.45) * 2 / ac;
      });
      var e = state.enemy || {};
      var hpFrac = e.baseMax ? clamp(num(e.baseHp, e.baseMax) / e.baseMax, 0, 1) : 1;
      return p / 3 + (1 - hpFrac) * 0.8;
    }
    function composition(state) {
      var L = lane(state), span = Math.max(1, L.eb - L.pb), comp = {}, total = 0;
      playerUnits(state).forEach(function (u) {
        var prog = (u.x - L.pb) / span;
        if (prog < 1 - P.scoutRange) return; // only what's near our side
        var r = roleOf(u, state), v = unitValue(u, state);
        comp[r] = (comp[r] || 0) + v; total += v;
      });
      return { comp: comp, total: total };
    }
    function delayedComposition(state, t) {
      mem.history.push({ t: t, c: composition(state) });
      var cut = t - P.reactionDelay, pick = mem.history[0];
      while (mem.history.length > 1 && mem.history[1].t <= cut) { mem.history.shift(); pick = mem.history[0]; }
      if (mem.history.length > 400) mem.history.splice(0, mem.history.length - 400);
      return pick.t <= cut ? pick.c : { comp: {}, total: 0 }; // before delay elapses the AI hasn't "seen" anything
    }

    /* ---------------- (b) counter policy ---------------- */
    function counterScore(def, comp, state) {
      var total = comp.total, s = 0;
      var myRole = def.role || "melee";
      if (total > 0) {
        for (var r in comp.comp) {
          var share = comp.comp[r] / total, w;
          if (Array.isArray(def.counters)) w = def.counters.indexOf(r) >= 0 ? 1.0 : 0.35; // explicit schema field wins
          else w = (DEFAULT_COUNTERS[r] && DEFAULT_COUNTERS[r][myRole] != null) ? DEFAULT_COUNTERS[r][myRole] : 0.5;
          if (Array.isArray(def.weakTo) && def.weakTo.indexOf(r) >= 0) w *= 0.5;
          s += share * w;
        }
      } else {
        // no threat seen: build a sensible front line — melee/tank first, ranged behind
        s = myRole === "melee" || myRole === "tank" ? 0.8 : myRole === "ranged" ? 0.6 : 0.4;
      }
      // stat efficiency tiebreak: (dps * hp) per cost^2, normalised softly
      var cost = Math.max(1, num(def.cost, 20));
      var dps = num(def.dmg, 10) / Math.max(0.1, num(def.atkInterval, 1));
      var eff = Math.sqrt(dps * num(def.hp, 50)) / cost;
      return s + 0.15 * Math.min(2, eff);
    }
    function pickUnit(state, comp, budget) {
      // [integration v0.2] saving: if the best counter overall is not affordable yet but income covers the gap soon,
      // sometimes wait for it instead of buying the cheapest thing (otherwise the AI only ever spams its cheapest unit).
      var allDefs = unitDefs(state).filter(function (d) { return d && d.id && isFinite(num(d.cost, Infinity)); });
      var income = num(state.enemy && state.enemy.goldPerSec, 0);
      if (allDefs.length && income > 0 && P.saveChance > 0) {
        var bestAll = allDefs.map(function (d) { return { d: d, s: counterScore(d, comp, state) }; }).sort(function (a, b) { return b.s - a.s; })[0].d;
        var gap = num(bestAll.cost, 0) - budget;
        if (gap > 0 && gap / income <= P.saveHorizon && R() < P.saveChance) return SAVE;
      }
      var defs = allDefs.filter(function (d) { return num(d.cost, Infinity) <= budget; });
      if (!defs.length) return null;
      if (R() < P.mistakeRate) return defs[Math.floor(R() * defs.length)]; // mistake: random affordable unit
      var scored = defs.map(function (d) { return { d: d, s: counterScore(d, comp, state) }; })
                       .sort(function (a, b) { return b.s - a.s; });
      if (R() < P.counterAccuracy) return scored[0].d;
      var tot = 0; scored.forEach(function (x) { tot += Math.max(0.01, x.s); });
      var roll = R() * tot;
      for (var i = 0; i < scored.length; i++) { roll -= Math.max(0.01, scored[i].s); if (roll <= 0) return scored[i].d; }
      return scored[scored.length - 1].d;
    }

    /* ---------------- (c) age timing ---------------- */
    function wantEvolve(state, t, press) {
      var e = state.enemy || {};
      var need = e.xpToNext;
      if (need == null || !isFinite(need) || e.canEvolve === false) return false; // last age / blocked
      if (num(e.xp, 0) < need) { mem.evolveReadyAt = null; return false; }
      var goldCost = num(state.roster && state.roster.evolveGoldCost, 0);
      if (num(e.gold, 0) < goldCost) return false;
      if (mem.evolveReadyAt == null) mem.evolveReadyAt = t;
      var waited = t - mem.evolveReadyAt;
      var myAge = num(e.ageIndex, 0), theirAge = num(state.player && state.player.ageIndex, 0);
      if (theirAge > myAge) return waited >= P.evolveDelay * 0.25;               // behind: catch up fast
      if (press > 1.2 && R() > P.evolveAggression) return false;                // under heavy pressure: usually spend gold defending first
      var bankOk = num(e.gold, 0) - goldCost >= P.evolveBankFactor * avgCost(unitDefs(state)) * 1.5;
      if (waited >= P.evolveDelay && (bankOk || R() < P.evolveAggression)) return true;
      return waited >= P.evolveDelay * 3; // don't sit on XP forever
    }

    /* ---------------- (d) special timing ---------------- */
    function specialAction(state, press) {
      var e = state.enemy || {}, sp = state.roster && state.roster.special;
      if (!sp) return null;
      if (e.specialReady === false || num(e.specialCooldown, 0) > 0) return null;
      var spCost = num(sp.cost, 0); if (num(e.gold, 0) < spCost) return null;
      var units = playerUnits(state); if (!units.length) return null;
      var L = lane(state), rad = Math.max(10, num(sp.radius, 80));
      units = units.slice().sort(function (a, b) { return a.x - b.x; });
      var best = null, j = 0, val = 0;
      for (var i = 0; i < units.length; i++) {  // sliding window of width 2*rad
        val += unitValue(units[i], state);
        while (units[i].x - units[j].x > 2 * rad) { val -= unitValue(units[j], state); j++; }
        var n = i - j + 1;
        if (!best || val > best.val) best = { val: val, n: n, x: (units[i].x + units[j].x) / 2 };
      }
      var hpFrac = e.baseMax ? num(e.baseHp, e.baseMax) / e.baseMax : 1;
      var need = P.specialClusterValue * avgCost(unitDefs(state));
      var ok = (best.n >= P.specialClusterUnits && best.val >= need) || (hpFrac < P.specialPanicHpPct && best.n >= 2 && press > 0.5);
      if (!ok) return null;
      var x = best.x + (R() * 2 - 1) * P.specialAimError;
      return { type: "special", x: clamp(x, L.pb, L.eb) };
    }

    /* ---------------- perks ---------------- */
    function choosePerk(options, state) {
      options = asArray(options).filter(function (o) { return o && o.id; });
      if (!options.length) return null;
      if (R() < P.perkMistakeRate) return options[Math.floor(R() * options.length)].id;
      state = state || {};
      var e = state.enemy || {}, ageIdx = num(e.ageIndex, 0);
      var totalBuilt = 0, topRole = null, topN = -1;
      for (var r in mem.built) { totalBuilt += mem.built[r]; if (mem.built[r] > topN) { topN = mem.built[r]; topRole = r; } }
      var ownTurrets = asArray(e.turrets).filter(Boolean).length;
      var slots = asArray(e.turretSlots).length || 1;
      var turtling = ownTurrets / slots >= 0.5 || mem.turretsBuilt >= 2;
      var specialUser = mem.specialsFired >= 2 || !!(state.roster && state.roster.special);
      var best = null;
      options.forEach(function (o) {
        var cat = o.category, s = 0.3;
        if (cat === "economy") s = ageIdx <= 1 ? 1.0 : 0.45 - 0.05 * ageIdx;
        else if (cat === "role") s = o.target && mem.built[o.target] ? 0.4 + 0.7 * (mem.built[o.target] / Math.max(1, totalBuilt)) + (o.target === topRole ? 0.15 : 0) : 0.2;
        else if (cat === "turret") s = turtling ? 0.85 : 0.25 + 0.1 * ownTurrets;
        else if (cat === "special") s = specialUser ? 0.5 + 0.12 * Math.min(4, mem.specialsFired) : 0.2;
        s *= 1 + clamp(num(o.value, 0), -1, 1) * 0.2; // slightly prefer bigger magnitudes
        s += (R() * 2 - 1) * P.perkRandomness;
        if (!best || s > best.s) best = { s: s, id: o.id };
      });
      return best.id;
    }

    /* ---------------- (a) spend policy + main tick ---------------- */
    function tick(state, dt) {
      var out = [];
      try {
        if (!state || !state.enemy || state.over) return out;
        var e = state.enemy, t = num(state.t, 0);
        if (mem.lastAge !== e.ageIndex) { mem.lastAge = e.ageIndex; mem.evolveReadyAt = null; }
        var comp = delayedComposition(state, t); // always record observations, even between thinks
        mem.thinkIn -= num(dt, 0);
        if (mem.thinkIn > 0) return out;
        mem.thinkIn = P.thinkInterval * (1 + (R() * 2 - 1) * P.thinkJitter);

        // pending perk choice takes priority
        var pp = e.pendingPerk;
        var popts = pp && (Array.isArray(pp) ? pp : pp.options);
        if (popts && popts.length) {
          var pid = choosePerk(popts, state);
          if (pid) { out.push({ type: "perk", perkId: pid }); }
        }

        if (R() < P.mistakeRate * 0.5) return out; // "distracted" think: does nothing

        var gold = num(e.gold, 0), press = pressure(state);

        // (c) evolve
        if (wantEvolve(state, t, press)) {
          out.push({ type: "evolve" });
          return out; // roster changes next frame; re-plan then
        }
        // (d) special
        var sa = specialAction(state, press);
        if (sa) { out.push(sa); gold -= num(state.roster.special.cost, 0); }

        // (a) spend: reserve, then unit/turret split
        var reserve = gold * (press > 0.6 ? P.pressureReservePct : P.reservePct);
        // if evolve is close, save a bit more (only if a gold cost exists)
        var evoGold = num(state.roster && state.roster.evolveGoldCost, 0);
        if (evoGold > 0 && e.xpToNext && num(e.xp, 0) >= 0.8 * e.xpToNext) reserve = Math.max(reserve, Math.min(gold, evoGold));
        var spendable = Math.max(0, gold - reserve);

        // turrets: fill empty slots with the best current-age turret we can afford within turretShare
        var slots = asArray(e.turretSlots), tdefs = turretDefs(state).filter(function (d) { return d && d.id; });
        var tur = e.turrets || {};
        var emptySlots = slots.filter(function (sl) { return !tur[sl]; });
        if (emptySlots.length && tdefs.length && (t >= P.turretMinTime || press > 0.8)) {
          var tBudget = press > 0.8 ? spendable : spendable * P.turretShare + (gold > avgCost(unitDefs(state)) * 8 ? spendable * 0.5 : 0);
          var aff = tdefs.filter(function (d) { return num(d.cost, Infinity) <= tBudget; });
          if (aff.length) {
            var pick;
            if (R() < P.mistakeRate) pick = aff[Math.floor(R() * aff.length)];
            else {
              // prefer higher dps*range per cost; under pressure prefer raw dps
              aff.sort(function (a, b) {
                function sc(d) { var dps = num(d.dmg, 10) / Math.max(0.1, num(d.atkInterval, 1)); return (press > 0.8 ? dps : dps * Math.sqrt(num(d.range, 200))) / Math.sqrt(Math.max(1, num(d.cost, 100))); }
                return sc(b) - sc(a);
              });
              pick = aff[0];
            }
            out.push({ type: "turret", slot: emptySlots[0], turretId: pick.id });
            gold -= pick.cost; spendable -= pick.cost; mem.turretsBuilt++;
          }
        }

        // save toward a turret: if an eligible slot is empty but nothing was affordable,
        // hold back (turretShare*2) x the cheapest turret's cost from unit spending so a fund builds up
        if (emptySlots.length && tdefs.length && (t >= P.turretMinTime || press > 0.8) && !out.some(function (a) { return a.type === "turret"; })) {
          var cheapT = Math.min.apply(null, tdefs.map(function (d) { return num(d.cost, Infinity); }));
          if (isFinite(cheapT)) spendable = Math.max(0, spendable - cheapT * Math.min(1, P.turretShare * 2));
        }

        // units
        var qMax = Math.min(P.queueCap, num(e.queueMax, 5));
        var qLen = asArray(e.queue).length;
        var buys = 0;
        while (buys < P.maxBuysPerThink && qLen < qMax) {
          var u = pickUnit(state, comp, Math.min(spendable, gold));
          if (!u || u === SAVE) break;
          out.push({ type: "queue", unitId: u.id });
          gold -= u.cost; spendable -= u.cost; qLen++; buys++;
          var role = u.role || "melee"; mem.built[role] = (mem.built[role] || 0) + 1;
        }
        if (sa) mem.specialsFired++;
      } catch (err) {
        // never throw into the game loop
        return out.filter(function (a) { return a && a.type; });
      }
      return out;
    }

    return { tick: tick, choosePerk: choosePerk, profile: P, _mem: mem };
  }

  var api = { createEnemyAI: createEnemyAI, PROFILES: PROFILES, DEFAULT_COUNTERS: DEFAULT_COUNTERS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.AGELINE_AI = api; root.createEnemyAI = createEnemyAI; }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
