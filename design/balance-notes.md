# AGE LINE: 5-age design data (proposal, v0.2 draft)

Files in this folder are **design data only**. `index.html` is unchanged. Nothing here is wired into the game yet.

| File | Contents |
|---|---|
| `ages.json` | 5 ages: `id, name, order, xpToNext, nextAgeNote, baseMaxHp, goldPerSec, palette, units[], turrets[], special` |
| `units.json` | 20 units (4 per age), keyed by id, same shape as `DATA.units` |
| `turrets.json` | 15 turrets (3 per age), keyed by id, same shape as `DATA.turrets` |
| `specials.json` | 5 specials (1 per age) |
| `perks.json` | 16 age-up perks (the player picks 1 of 3 random ones) |
| `tools/build_design.py` | Source tables that generate all 5 JSON files. Edit the numbers here, then re-run it. |
| `tools/validate.py` | Parses the JSON, checks cross-refs and constraints, checks the v0.1 numbers against `index.html` (runs node), and prints the ratio tables below. |

Re-generate and check: `python3 design/tools/build_design.py && python3 design/tools/validate.py`. It exits 1 if any check fails.

## 1. Schema: kept vs added

**Kept exactly** (from `DATA` in index.html): unit `id, name, age, role, cost, hp, dmg, atkInterval (s), range (px), speed (px/s), spawnTime (s), bounty{gold,xp}, radius, height, projectile{kind,speed}|null, blurb`. Turret `id, name, age, cost, dmg, atkInterval, range, projectile, refundRate, blurb`. Age `id, name, order, xpToNext, nextAgeNote, units, turrets, special`.
Thudder, Whirler, and Sling Post match v0.1 field for field. `validate.py` diffs them against the live `DATA`.

**Added fields:**
| Where | Field | Meaning |
|---|---|---|
| unit | `subrole` | `null`, or for specialists `"skirmisher"` or `"support"` |
| unit | `formation` | `"front"` or `"back"`. **Needed**: `updateUnit` hard-codes blocking as `a.role === "melee" \|\| u.role === "ranged"`, so the new roles `heavy` and `specialist` would pass through allies unpredictably. The engine should switch that check to `formation === "front"`. Right now front = melee, heavy, skirmisher and back = ranged, support. |
| unit | `ability` | `null`, or an aura object: `healAura{radius,hps}`, `hasteAura{radius,speedMult}`, `shieldPulse{radius,shield,every}`, `damageReductionAura{radius,mult}`. `affects` is always `"allies"`. |
| turret | `effect` | `null`, or any mix of `splash{radius,falloff}`, `slow{mult,duration}`, `burn{dps,duration}`, `chain{jumps,range,falloff}` |
| age | `baseMaxHp`, `goldPerSec`, `palette` | Per-age values that replace the global `bases.hp` and `economy.goldPerSec`. `palette` is an id for a future PAL table (STYLE.md only defines Ember Dusk). |
| special | whole schema | `id, name, age, cooldown (s), target, hitsBases:false, kind, params{…}, blurb`. `kind` is one of `laneRain`, `buffAndShove`, `groundZone`, `chainStrike`. |
| all files | `schemaVersion: 2` wrapper | `{schemaVersion, units:{…}}` and so on |

## 2. Power metric

**Per-gold power: `P = dps × hp / cost`**, where `dps = dmg / atkInterval`. This is the metric suggested in the brief. It measures how much "damage × survival" one gold buys. Under Lanchester-style mass fights, an army's strength scales with (Σdps × Σhp), and that per-gold product is P × gold. So a P ratio of r means that at equal gold the newer army wins with a large margin.

Scaling recipe, applied with hand jitter per role: **cost ×1.5, hp ×1.8, dps ×1.5 per age**. This gives P ×1.8 per age. dps per gold stays flat and hp per gold rises 1.2x. Gold income also rises ×1.5 per age (2 → 3 → 4.5 → 6.75 → 10), so a player still trains about 8 melee per minute of income in every age. Unit dps grows only ×1.5 while `baseMaxHp` grows ~1.3x, so one melee unit takes 62 s to kill a base in Stone and 40 s in Spark. Late games close a bit faster, which is intended.

Ranged P is lower by design because range isn't in P. Whirler's range of 140 vs 20 lets it hit untouched behind the front line. Support specialists also keep aura value outside P. Their auras scale about 1.8x per age too (heal 3 hps, haste 1.2, shield 70, DR 0.8), but that isn't formally measured.

Turret metric: **adjusted dps / cost**. Splash counts ×1.6, slow ×1.25, chain counts the sum of falloff hits, and burn adds its dps. Enemy hp per gold rises 1.2x per age, so turrets target **~1.2x dps/gold per age** to keep pace with same-age attackers. They don't target 1.8x, because turrets can't be killed and would snowball.

## 3. Computed tables (output of `tools/validate.py`)

| Age | melee P (ratio) | ranged P (ratio) | heavy P (ratio) | specialist P (ratio) | age avg ratio | turret avg dps/g (ratio) |
|---|---|---|---|---|---|---|
| Stone Age | 58.7 (—) | 13.3 (—) | 65.9 (—) | 20.4 (—) | — | 0.086 (—) |
| Kiln Age | 110.0 (1.88x) | 23.0 (1.73x) | 115.3 (1.75x) | 36.6 (1.80x) | 1.79x | 0.105 (1.22x) |
| Banner Age | 188.2 (1.71x) | 40.8 (1.77x) | 211.6 (1.84x) | 66.7 (1.82x) | 1.78x | 0.126 (1.20x) |
| Gear Age | 332.2 (1.76x) | 73.1 (1.79x) | 379.3 (1.79x) | 120.9 (1.81x) | 1.79x | 0.152 (1.21x) |
| Spark Age | 610.5 (1.84x) | 131.6 (1.80x) | 678.6 (1.79x) | 218.0 (1.80x) | 1.81x | 0.179 (1.18x) |

| Age | goldPerSec | melee cost | melee/min of income | base HP / melee dps (s) |
|---|---|---|---|---|
| Stone Age | 2.0 | 15 | 8.0 | 62 |
| Kiln Age | 3.0 | 22 | 8.2 | 58 |
| Banner Age | 4.5 | 34 | 7.9 | 53 |
| Gear Age | 6.75 | 51 | 7.9 | 47 |
| Spark Age | 10.0 | 76 | 7.9 | 40 |

| Turret | age | cost | adj dps/gold |
|---|---|---|---|
| Sling Post | stone | 100 | 0.100 |
| Pitch Pot | stone | 160 | 0.070 |
| Bone Bolt Rack | stone | 140 | 0.089 |
| Bronze Dart Frame | kiln | 180 | 0.125 |
| Clay Mortar | kiln | 260 | 0.095 |
| Firebrick Oven | kiln | 220 | 0.095 |
| Spire Bow | banner | 320 | 0.165 |
| Oil Cauldron | banner | 420 | 0.111 |
| Warning Bell | banner | 360 | 0.101 |
| Rivet Gun | gear | 560 | 0.186 |
| Steam Mortar | gear | 720 | 0.139 |
| Magnet Coil | gear | 620 | 0.130 |
| Arc Pylon | spark | 960 | 0.236 |
| Prism Lens | spark | 1100 | 0.136 |
| Hush Drum | spark | 1040 | 0.165 |

All 16 unit ratios (4 roles × 4 transitions) fall in **1.71x–1.88x**, and every age-average is ~1.8x. The validator fails if any role ratio leaves [1.6, 2.0] or any turret ratio leaves [1.15, 1.5].

## 4. Roles and counters

| Role | Job | Beats | Loses to |
|---|---|---|---|
| melee (Thudder, Clanger, Brambleguard, Cogbiter, Arcfencer) | Cheap front line, best dps/gold | skirmishers, ranged that get reached | heavy (can't out-trade its hp), splash turrets |
| ranged (Whirler, Shardpelter, Quillwright, Pipesnap, Glintcaster) | Back-line damage, range 140→185 | heavy (slow, eats free volleys), melee behind a front line | skirmishers diving past the front, specials (low hp) |
| heavy (Boulderback, Anvilhorn, Wallwalker, Boilerhulk, Stormcradle) | Tank: highest P, slow (24–28), long spawnTime (2.5–3.2 s) | melee spam | ranged focus, single-target turrets (Bone Bolt Rack, Spire Bow, Prism Lens) |
| specialist: skirmisher (Skitterling, Pennant Runner) | Fast (78–82), reaches enemy ranged early | ranged | melee, rapid turrets |
| specialist: support (Hearthkeeper, Tinker Wisp, Pulse Warden) | Back-line aura that multiplies the blob | long fights (turns them) | burst specials, splash turrets |

Each age has 3 turrets with different jobs: **single-target long range** (anti-heavy), **splash** (anti-blob/melee), and **utility** (fast-fire, burn, slow, or chain). Sling Post is the Stone generalist. Turrets don't die, have no upkeep, and refund 25%, so their dps/gold stays below a unit's dps/gold by the same age. They're defence multipliers and can't push. One Stone Sling Post (8.3 dps) kills a Thudder in ~6.6 s. One Spark Prism Lens (150 dps) kills an Arcfencer in ~3.9 s, so turrets grow a little stronger against same-age units. A turret from a previous age falls off fast (Sling Post vs Arcfencer takes ~70 s), which pushes the player to rebuild after aging up.

## 5. Specials (units only, `hitsBases:false`)
| Age | Special | Cooldown | Effect | vs same-age melee hp |
|---|---|---|---|---|
| Stone | Rockslide | 50 s | 10 rocks × 35 dmg, r40, over 2.5 s, x 250–1050 | 35 vs 55 hp (2 hits kills) |
| Kiln | Kiln Burst | 52 s | 12 × 55 dmg, r45, plus burn 6 dps for 3 s | ~73 vs 100 |
| Banner | Muster Horn | 55 s | allies ×1.3 dmg, ×1.25 speed for 8 s. Enemies take 40 dmg and 60 px knockback. | utility, not a nuke |
| Gear | Steam Vent | 55 s | 260 px zone at enemy front: 55 dps, ×0.6 slow for 6 s | 330 vs 320 (kills if they stand in it) |
| Spark | Static Surge | 60 s | 3 strikes × 320 dmg, chains 6 jumps (×0.8 each), 1 s stun | 320 vs 580 |
Engine note: projectile/zone damage must skip `damage(s, side, "base", …)`. Treat base as immune in the special resolver.

## 6. Perks (`perks.json`)
16 perks, 2 per target and covering all 8 targets. Each gives about +10–25% to its slice. Stacks are capped at 2 (3 for the two cheap melee perks).
| id | name | target | stat | value | max |
|---|---|---|---|---|---|
| perk_thick_hides | Thick Hides | role:melee | hp | ×1.15 | 3 |
| perk_heavy_swing | Heavy Swing | role:melee | dmg | ×1.12 | 3 |
| perk_steady_hands | Steady Hands | role:ranged | attackInterval | ×0.9 | 2 |
| perk_long_eye | Long Eye | role:ranged | range | +20 | 2 |
| perk_bedrock | Bedrock Bones | role:heavy | hp | ×1.18 | 2 |
| perk_cheap_bulk | Bulk Discount | role:heavy | cost | ×0.88 | 2 |
| perk_quickfeet | Quick Feet | role:specialist | moveSpeed | ×1.2 | 2 |
| perk_sharp_tricks | Sharp Tricks | role:specialist | dmg | ×1.2 | 2 |
| perk_oiled_arms | Oiled Arms | turrets | attackInterval | ×0.88 | 2 |
| perk_high_perch | High Perch | turrets | range | +30 | 2 |
| perk_tithe | Tribute Tithe | economy | goldPerSec | ×1.12 | 2 |
| perk_scavengers | Scavengers | economy | bounty | ×1.2 | 2 |
| perk_old_songs | Old Songs | special | cooldown | ×0.85 | 2 |
| perk_loud_sky | Loud Sky | special | dmg | ×1.2 | 2 |
| perk_deep_roots | Deep Roots | base | maxHp | ×1.12 | 2 |
| perk_mortar_mix | Mortar Mix | base | maxHp | +150 | 2 |
Power check: a role perk is ≤ +20% P for one role out of 4, so about +5% army power. Economy perks give +12% income or +20% bounty, and at 2 stacks that's +25% or +44% of a minor income source. `Long Eye` / `High Perch` (+20 / +30 range) are additive so they don't compound with the range growth per age. The most dangerous stack is 2× `Old Songs`: cooldown ×0.72, so 50 s → 36 s. That's why specials can't hit bases. **Stat-name note:** the perk schema uses `attackInterval` / `moveSpeed`, while unit/turret fields are `atkInterval` / `speed`. The perk resolver needs that mapping, or the names could be unified later. `attackInterval` mult < 1 means faster. For `special`, `dmg` scales every damage param in the special.

## 7. Open questions / concerns
1. **xpToNext mismatch**: v0.1 code has Stone `xpToNext: 4000`. The brief asked for 1000, and the JSON uses 1000. XP bounties here are about 1–2.3× cost, so Stone needs ~50–65 kills and Gear→Spark needs ~140+ same-age kills. The kill counts or the XP curve may need a pass with the sim harness.
2. **Enemy AI is Stone-only** (`aiStep` and `makeBot` hard-code `stone_clubber` / `stone_slinger`). It needs an AI age track (e.g. the enemy ages on a timer, or mirrors the player) before any of this is playable.
3. **Formation/blocking**: see `formation` above. Without it, heavies and specialists interact oddly with the ally-spacing rule.
4. **Turret projectile kind** is hard-coded to `"rock"` in the turret loop, and the renderer only draws `rock`. New kinds (`pitch, bone, dart, clayshot, ember, bolt, oil, ring, pellet, boiler, coil, spark, beam, pulse`) need art. There's only one `turretSlots` entry, so specials/turret choice is a single pick per age. More slots may be wanted.
5. **Cross-age matchups**: at 1.8x per gold, a one-age lead is decisive and a two-age lead (~3.2x) is crushing. That's intended for a tug-of-war, but the enemy AI's aging pace sets the difficulty.
6. Arc Pylon (0.236 adj dps/g) is the turret outlier because the chain factor may be too generous. Watch it in the sim. Pitch Pot (0.070) is weakest if splash isn't worth 1.6x.
7. Aura and special values are hand-scaled and not in P. They should be tuned with the headless harness once the engine supports them.
8. Palettes `pal_kiln_glow`, `pal_banner_field`, `pal_gear_smog`, and `pal_spark_night` are placeholders with no hex values yet (STYLE.md work).
