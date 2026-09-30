# AGE LINE: Enemy AI (design/ai.js)

The AI is a pure module with no dependencies. It is deterministic when you give it a seeded `rng`. It plays by the same rules as the player: it spends only its own gold and XP, picks only from its current-age roster, and reads only what is visible on the board.

## Contract
```js
const { createEnemyAI, PROFILES } = require('./design/ai.js'); // Node
// Browser: include ai.js as a classic <script> BEFORE the game script → globalThis.AGELINE_AI / globalThis.createEnemyAI
const ai = createEnemyAI('hard', mulberry32(seed ^ 0xA1));      // profile name or a full/partial numbers object
const actions = ai.tick(state, dt);                               // call every sim tick (it throttles itself)
const perkId  = ai.choosePerk(options, state);                    // also usable directly
```
`tick` returns an array (often empty) containing:
| action | meaning | integrator applies via |
|---|---|---|
| `{type:'queue', unitId}` | train one unit | enemy version of `simEnqueue` (deduct cost, push to the enemy queue) |
| `{type:'turret', slot, turretId}` | build in an EMPTY enemy slot | enemy version of `simBuildTurret` |
| `{type:'evolve'}` | advance one age | spend XP (and `evolveGoldCost` if any), switch roster, then offer perks |
| `{type:'special', x}` | fire the age Special centered at lane x (world coords, clamped to [playerBaseX, enemyBaseX]) | apply the effect and start the cooldown |
| `{type:'perk', perkId}` | pick from `state.enemy.pendingPerk.options` | apply the perk and clear `pendingPerk` |

Each action is valid when the AI emits it. Within one tick the AI tracks its own spending, so a batch never costs more than `enemy.gold`. The integrator should still re-check every action (cost, queue length, empty slot) and drop any that fail. `tick` never throws. On bad input it returns `[]`.

## State the AI expects (integrator maps sim → this)
```js
{
  t,                                   // sim seconds
  over,                                // truthy → AI does nothing
  world:  { playerBaseX, enemyBaseX }, // lane ends (DATA.world). Player is on the low-x side.
  enemy: {
    gold, xp, ageIndex,                // own resources, 0-based age
    xpToNext,                          // XP needed to evolve; null/undefined in the last age
    canEvolve,                         // optional; false blocks evolve
    queue: [unitId...], queueMax,      // own training queue (length is enough), DATA.economy.queueMax
    turrets: { [slotId]: turretId|null }, turretSlots: [slotId...],  // enemy-side slots only
    specialCooldown, specialReady,     // seconds remaining (0 = ready); specialReady optional
    baseHp, baseMax,
    pendingPerk: { options:[perk,perk,perk] } | null
  },
  player: { ageIndex, units: [{ type, role, x, hp, maxHp, cost? }] },  // visible player units ONLY
  roster: {                            // the ENEMY's CURRENT age
    units:   [unitDef...],             // {id, role, cost, hp, dmg, atkInterval, range, counters?, weakTo?}
    turrets: [turretDef...],           // {id, cost, dmg, atkInterval, range}
    special: { id, radius, cooldown, cost? } | null,
    evolveGoldCost                     // optional, default 0
  },
  unitDefs: DATA.units                 // optional lookup, used for the cost/role of player units
}
```
The roster is passed in on every tick, so the AI contains no hardcoded unit or turret ids.

## Layers (run once per think, not every frame)
- **Think interval.** The AI makes a decision every `thinkInterval × (1 ± thinkJitter)` seconds. It records observations on every tick, but reads them back through a **reaction delay**: the counter layer sees the player's composition as it was `reactionDelay` seconds ago.
- **(a) Spend policy.**
  - Reserve = `reservePct` of gold. When pressure is high (> 0.6), reserve drops to `pressureReservePct`. If an evolve gold cost exists and XP is ≥ 80% of the target, the AI also saves for it.
  - Turrets: an empty slot gets the best affordable current-age turret once `t ≥ turretMinTime` or pressure > 0.8.
    - Budget is `turretShare` of spendable gold, plus a bonus when gold is piling up (> 8 × average unit cost).
    - If an eligible slot is empty and nothing is affordable, unit spending holds back `min(1, 2 × turretShare)` × the cheapest turret's cost, so a turret fund builds up (even under pressure).
    - Turrets are scored by dps × √range / √cost. Under pressure the score is raw dps / √cost.
  - Units: up to `maxBuysPerThink` per think, while own queue length < `min(queueCap, queueMax)`.
  - *Pressure* = player value in the enemy half, weighted by how close it is to the enemy base and normalized by average unit cost, plus a term for lost base HP.
- **(b) Counter policy.**
  - Takes the player units within `scoutRange` (fraction of the lane, measured from the enemy base) and sums their value (cost × HP fraction) by role.
  - Scores each affordable unit as Σ(role share × counter weight). If a unit def has a `counters: [roles]` array, that is used; `weakTo` halves the weight. Otherwise the fallback is `DEFAULT_COUNTERS`: melee→ranged/tank, ranged→tank/melee, tank→siege/ranged, siege→melee.
  - A small stat-efficiency tiebreak (√(dps·hp)/cost) is added.
  - With no visible threat it builds a front line (melee/tank first, then ranged).
  - Picks the top unit with probability `counterAccuracy`. Otherwise it makes a weighted-random pick. With probability `mistakeRate` it picks a random affordable unit.
- **(c) Age timing.** This runs only when `xp ≥ xpToNext`, starting a timer.
  - If the player is a higher age, it evolves after `0.25 × evolveDelay`.
  - Under heavy pressure (> 1.2) it usually holds off to defend: it proceeds only with probability `evolveAggression`.
  - Otherwise it evolves after `evolveDelay` if its gold bank ≥ `evolveBankFactor × 1.5 × avgUnitCost`, or on an `evolveAggression` roll.
  - Hard cap: it always evolves by `3 × evolveDelay`.
  - An evolve ends that think, so it re-plans with the new roster.
- **(d) Special timing.** Only fires when the cooldown is 0 (and gold ≥ `special.cost`, if a cost exists).
  - Slides a window of width 2 × `radius` over the player units and finds the one with the most value.
  - Fires when there are ≥ `specialClusterUnits` units AND the value is ≥ `specialClusterValue × avgUnitCost`. Panic mode also fires it: base HP < `specialPanicHpPct`, ≥ 2 units, and pressure > 0.5.
  - Aims at the cluster center ± `specialAimError`.
- **Perks.** `choosePerk(options, state)` scores each option by category:
  - economy: high in ages 0–1, then decays
  - role: proportional to how much of that role the AI has queued (bonus for its most-built role)
  - turret: high if it is turtling (≥ 50% of slots filled or ≥ 2 turrets built)
  - special: rises with the number of specials fired
  - Bigger `|value|` gets a slight bonus. `± perkRandomness` noise is added, and with probability `perkMistakeRate` it picks a random option.
  - `tick` emits `{type:'perk'}` on the next think whenever `enemy.pendingPerk.options` is non-empty.

## Profiles (only numbers differ)
| knob | normal | hard | impossible | meaning |
|---|---|---|---|---|
| thinkInterval | 1.2 | 0.7 | 0.35 | seconds between decisions |
| thinkJitter | 0.35 | 0.25 | 0.1 | ± random fraction on the interval |
| reactionDelay | 3.0 | 1.5 | 0.4 | age (s) of the player-composition snapshot used for counters |
| scoutRange | 0.55 | 0.7 | 0.9 | how far up the lane (from own base) it looks |
| reservePct | 0.30 | 0.20 | 0.12 | gold held back when calm |
| pressureReservePct | 0.05 | 0 | 0 | gold held back under pressure |
| turretShare | 0.25 | 0.30 | 0.50 | share of spendable gold for turrets per think |
| turretMinTime | 60 | 40 | 25 | earliest turret (s) unless pressured |
| queueCap | 3 | 4 | 5 | own queue length it maintains (≤ queueMax) |
| maxBuysPerThink | 1 | 2 | 3 | units queued per think |
| counterAccuracy | 0.55 | 0.8 | 0.95 | P(best counter) vs weighted random |
| mistakeRate | 0.15 | 0.06 | 0.01 | P(random unit/turret pick); half of it = P(idle think) |
| evolveBankFactor | 0.5 | 0.8 | 1.0 | gold bank wanted before evolving (× 1.5 × avg unit cost) |
| evolveAggression | 0.35 | 0.6 | 0.85 | willingness to evolve early or under pressure |
| evolveDelay | 12 | 5 | 1 | s it sits on enough XP before evolving |
| specialClusterUnits | 4 | 3 | 3 | min units in blast window |
| specialClusterValue | 3.0 | 2.5 | 2.0 | min cluster value (× avg unit cost) |
| specialPanicHpPct | 0.35 | 0.45 | 0.55 | base-HP fraction that allows panic specials |
| specialAimError | 40 | 20 | 6 | px aim noise |
| perkRandomness | 0.35 | 0.15 | 0.05 | noise on perk scores |
| perkMistakeRate | 0.15 | 0.05 | 0 | P(random perk) |
| goldIncomeMult | 1 | 1 | 1 | **optional cheat knob, off (1) everywhere.** The AI never reads it. The integrator may multiply enemy income by it. |

The existing `DATA.difficulty` enemyHp/enemyDmg/spawnRate multipliers are resource/stat cheats. To keep the AI "fair", set them to 1.0 and let these profiles carry the difficulty. Keeping them is a separate balance decision.

## Schema assumptions (design/units.json and perks.json did not exist when this was written)
- **Roles.** Assumed `melee | ranged | tank | siege | support`. Unknown roles still work: the counter weight defaults to 0.5 and stats decide. If units.json uses `counters: [role...]` / `weakTo: [role...]`, those override the table. If it uses id-based counters, the integrator should map ids to roles, or the module should be extended.
- **Turret slots.** Assumed per side (enemy slot ids passed in `enemy.turretSlots`). v0.1 only has `slot1` on the player side.
- **Evolve.** Costs XP (`xpToNext`) and optionally gold (`roster.evolveGoldCost`).
- **Special.** Assumed `{id, radius, cooldown, cost?}`. The integrator tracks the enemy's cooldown and passes `specialCooldown`.
- **Perks.** Assumed `{id, name?, category:'economy'|'role'|'turret'|'special', target: role|turretId|null, stat, value}` (value is a fraction, e.g. 0.1 = +10%; negative for cooldown reduction).
- **Replacing turrets.** The AI never sells or replaces an old-age turret. It only fills empty slots. Adding replacement would need a `sell` action.

## Integration (replacing DATA.enemyAI / aiStep)
1. Load ai.js before the game script (or inline it). In `createSim`, set `s.enemyAI = createEnemyAI(diffId, mulberry32(seed ^ 0xA11CE))` so the AI's rng is separate from the combat rng. Give the enemy its own `gold/xp/queue/turrets/ageIndex/specialCooldown`, using the same `economy.goldPerSec` and bounties as the player. Enemy bounty comes from killing player units.
2. In `simStep`, replace `aiStep(s, dt)` with:
   `for (const a of s.enemyAI.tick(buildAIState(s), dt)) applyEnemyAction(s, a);`
   Here `applyEnemyAction` mirrors `simEnqueue` / `simBuildTurret` for the enemy side and validates again. Production then runs the enemy queue exactly like the player queue.
3. `buildAIState(s)` is a cheap mapping: player units = `s.units.filter(u => u.side==='player')`, and the roster = the enemy's current `DATA.ages[i]` ids resolved through `DATA.units` / `DATA.turrets`.
4. After an evolve, set `enemy.pendingPerk = {options: 3 random perks}` using the sim rng. The AI answers with a `perk` action on its next think.
5. Delete `DATA.enemyAI` (the timer/rally dummy) and `aiStep`. Optionally keep "rally" as flavor by letting the AI lower its reserve when base HP drops, which pressure already does.
6. Tests: `node design/ai.test.js`.
