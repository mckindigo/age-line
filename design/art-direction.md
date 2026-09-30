# AGE LINE: Art Direction v0.2 ("Ember Line")

Scope: visual spec for all 5 ages. It extends `STYLE.md` ("Ember Dusk") and does not replace it.
The canvas and coordinate facts below come from `index.html` v0.1 and apply to everything in this file:

- World is **1200 wide** (`DATA.world.width`). Player base x=80, enemy base x=1120, `baseHalfW` 50.
- The lane "block" is **250 world units tall**, and the ground line is **212** units down from the block top. World y is **negative-up**:
  units are drawn with the origin at their feet (`g.translate(x,0)`). `L.sc` is 1.03 at 1280x720 and 0.68 at 844x390 in v0.1.
- The whole game is procedural Canvas 2D (no sprites/fonts). Outline ink and flat fills are the house rules.
  Keep the current code style: `g` context, `fs()`/`st()`/`blob()`/`circ()` helpers, and a draw function per unit taking an `o` options object.
- All sizes below are **world px**. On screen they are multiplied by `L.sc`.

> **Names source.** v0.1's `index.html` only defines `stone / "Stone Age"`. The ages, units, turrets and specials below use the ids and names from the
> v0.2 data drafts in this folder (`ages.json`, `units.json`, `turrets.json`, `specials.json`), so art and data line up 1:1.
> Unit sizes (`radius`, `height`) are taken from `units.json`.

| # | id | Age name | Scene nickname | Base ("ember heart") | Special |
|---|----|----------|----------------|----------------------|---------|
| 1 | stone  | Stone Age  | Ember Dusk (`pal_ember_dusk`)    | Cairn + ember bowl            | Rockslide |
| 2 | kiln   | Kiln Age   | Kiln Glow (`pal_kiln_glow`)      | Kiln Tower + kiln mouth       | Kiln Burst |
| 3 | banner | Banner Age | Banner Field (`pal_banner_field`)| Banner Keep + beacon brazier  | Muster Horn |
| 4 | gear   | Gear Age   | Gear Smog (`pal_gear_smog`)      | Boiler Bastion + firebox      | Steam Vent |
| 5 | spark  | Spark Age  | Spark Night (`pal_spark_night`)  | Storm Spire + caged storm core | Static Surge |

**Throughline:** every base has an *ember heart*, the thing you protect. Its brightness is the base's health.
The heart grows up through the ages: bowl flame → kiln mouth → beacon brazier → boiler firebox → caged storm core. The age-up effect is always
"the heart flares and remakes the base". Because of this, the core fantasy never changes even when the whole palette does.

---

## 0. Global rules (all ages)

### 0.1 Role silhouette grammar (the most important readability rule)
Each role has a **primitive shape** that stays the same across ages. A player learns it once and can read every age's units at 10 px tall.

| Role | Primitive | Footprint (w × h, world px) | `radius` | Signature |
|------|-----------|-----------------------------|----------|-----------|
| Melee  | **Circle** (round body, stubby legs) | ~32 × 44-54 (weapon reaches ~+16) | 14-15 | One oversized melee weapon; head and body are one mass |
| Ranged | **Stick** (tall, thin, vertical) | ~20 × 68-74 | 11 | Long legs, tiny head, one arm always raised with the ranged prop |
| Heavy  | **Block** (wide, flat-topped) | ~2.3×radius wide × 58-84 | 20-26 | Wider than every other role, flat top, a front "wall" shape (slab/helm/shields/boiler/cage) |
| Specialist | **Spike** (asymmetric; a tall prop or a glow above the head) | ~20 × 34-64 (prop to +30) | 9-11 | A glowing element in the age's *specialist glow* color, plus a diamond/zig-zag motif |

- Heavy units walk at 55-70% of melee speed. The bob is slow and heavy (period ×1.6) and every step makes a small dust puff.
- Specialists always carry a **specialist glow** (a small additive radial, r = 10-14) so they pop out of a crowd.
- The **team band rule**: every unit carries team color in two places. **Dark team** goes on the torso/belt (seen against the ground).
  **Light team** goes on something high (headband, plume, pennant, visor) (seen against the sky). This keeps team identity readable in every age.
- Facing: player faces +x, enemy −x (`g.scale(dir,1)`, as now). Silhouettes are identical for both sides (per STYLE.md).
- Optional role pip (for accessibility): a 6 px icon above the HP bar, shown only while the unit is damaged. Circle = melee, bar = ranged,
  square = heavy, diamond = specialist.

### 0.2 Team colors per age (tuned so they stay readable on each background)
The hues are locked (**player = cool teal, enemy = warm vermilion**). Only the value shifts, so the teams keep contrast against each age's sky and ground.
Environment colors are kept at ≤ 45% saturation in the lane band. Team colors are ≥ 60% saturation.

| Age | Player dark | Player light | Enemy dark | Enemy light | Ink outline |
|-----|-------------|--------------|------------|-------------|-------------|
| Stone  | `#2f8f83` | `#5cc0b0` | `#b8432f` | `#e0735c` | `#2a1a10` |
| Kiln   | `#23847f` | `#5ccbc2` | `#b0382c` | `#e8664f` | `#2a1a10` |
| Banner | `#2a9a8c` | `#6fe0cf` | `#c43f2c` | `#ff7a5e` | `#1f1914` |
| Gear   | `#31b3a2` | `#7ff0dc` | `#d24a34` | `#ff8a6a` | `#1d1418` |
| Spark  | `#3fd0bd` | `#9dfff0` | `#ff5a3c` | `#ffa384` | `#120d1e` + rim light (see §5) |

Base HP bars in the HUD always use the **light** team color. Unit HP bars use the light team color on a `#3b2819` track.

### 0.3 Shared rendering rules
- **Characters:** flat fills plus an ink outline, as now. The upgrade is **one flat rim-light crescent** (not a gradient) on the side facing the key light,
  plus a soft contact shadow. This respects STYLE.md's "no gradients on characters".
- **Bases, turrets, backgrounds, FX:** gradients are allowed (bases get a vertical 2-stop body gradient and a radial heart glow).
- **Outline widths:** units 3-3.5, bases 3.5, turrets 3, background layers **no outline** (so they recede). The near layer gets a 2 px ink top edge only.
- **Atmospheric depth:** each farther layer is lerped 15-25% toward the horizon sky color (values are pre-mixed in the tables below).
- **Lane band:** units live in world y −90..0. Keep background detail in that band at low contrast (the mid layer sits behind it).
  High-contrast detail goes above y −110 (the sky) or below ground.

### 0.4 Parallax model (same for every age)
The layers render in screen space, as `drawBackground()` does now, but each layer is offset by the camera × factor.
Factor 0 = fixed to the screen, 1 = locked to the world. With `L.pan` false (desktop, whole lane visible) there is no camera motion.
In that case, add a slow **ambient drift** per layer (clouds, smoke, aurora) so the scene still feels alive.

| Layer | Factor | Contents | Cached? |
|-------|--------|----------|---------|
| L0 Sky     | 0.00 | gradient + sun/moon + stars | yes (per age, per resize) |
| L1 Far     | 0.10 | distant landforms/skyline | yes (strip 1.3× lane width) |
| L2 Mid     | 0.30 | mid hills/structures, drifting weather | yes, and the weather is drawn live |
| L3 Near    | 0.60 | near props, behind the lane | yes |
| L4 Ground  | 1.00 | ground plane, lip, pebbles/props (world-locked) | yes |
| L5 Foreground (optional) | 1.25 | 1-2 blurry grass/debris tufts at the very bottom, low alpha | live |

Drift speeds (world px/s at factor 1): clouds 6, smoke 10, aurora 4 (sine), rain 380 (fall, 12° slant).

### 0.5 Damage-state rule for bases (all ages)
| State | HP | Visual |
|-------|----|--------|
| **Intact** | 100-66% | clean silhouette; heart at 100% size/brightness; flag or banner animates |
| **Damaged** | 66-33% | crack set A, one structural element knocked askew (4-6°), heart at 70%, a smoke wisp every 1.5 s, chips fall when hit |
| **Critical** | <33% | crack set B plus missing chunks (subtract shapes with `destination-out` into the cached canvas), heart sputters (random 60 ms dropouts), constant dark smoke, the banner is torn, the base-hit shake is doubled |
| **Destroyed** | 0 | a 1.6-2.0 s destruction sequence (per age), then a rubble silhouette stays. v0.1 currently shows an **intact** cairn at 0 HP (see results screenshot); fix this |

Each state = one cached offscreen canvas per side (6 per age). The heart/flame/smoke/banner are drawn live on top.
State changes fire a one-off "chunk burst" (8 debris + 1 dust ring) so the downgrade is noticed.

---

## 1. Stone Age: "Ember Dusk" (existing; polish pass)

### Palette
| Role | Hex |
|------|-----|
| Sky top / mid / horizon | `#b35f55` / `#d99270` / `#e8c79a` |
| Sun / sun bands | `#f7dc8e` / `#e8966e` @55% |
| Far mesas / mid mesas / near rocks | `#c79a78` / `#a9785a` / `#8a6446` |
| Ground / lip / pebbles / dry grass | `#7a5b3a` / `#5f4329` / `#8c6a46` / `#5d4a2a` |
| Accents: ember / hot / gold | `#ff8a2a` / `#ffe08a` / `#ffd24a` |
| Stone set | `#9a8670` `#86735e` `#a8937a` `#918069` |
| Specialist glow | `#ffb347` |
| Key light (rim) | `#ffe3b0` from the sun (world x≈470, low) |

### Background layers
| Layer | Factor | Spec |
|-------|--------|------|
| L0 | 0.00 | 3-stop dusk gradient; low half-sun at world x 470 with 3 sun bands (existing); add 5 slow **thin cloud streaks** `#e8a07e` @40%, drift 6 px/s |
| L1 | 0.10 | far mesa silhouette (existing points), flat `#c79a78` |
| L2 | 0.30 | mid mesas `#a9785a` + 2 **leaning stone arches** (original landmark) + a dust-haze band `rgba(232,199,154,.18)`, 40 px tall, drift 6 px/s |
| L3 | 0.60 | near rock spires and thorn bushes `#8a6446`, 3-5 per screen, bottoms hidden behind the ground lip |
| L4 | 1.00 | ground (existing) + flint shards, cracked-earth hex lines `#6d5033` |

### Base: Cairn (existing, upgraded)
- **Intact:** 4 lumpy stones with a vertical gradient (`#a8937a`→`#86735e`) and the existing highlight blob. The **ember bowl** crown has a radial glow `rgba(255,190,90,.55)`. A banner flies on a leaning pole.
- **Damaged (66-33):** crack A (existing), the top stone rotates +5° and slides 3 px, the ember is at 70%, a pebble drops on every hit.
- **Critical (<33):** crack B, a notch bitten out of stone 2, the banner torn to 50% length with a ragged edge, smoke `#6a5a4c` @50%, the ember sputters.
- **Destroyed (1.8 s):** 0.0 the ember flares white `#fff3dc` (120 ms). 0.12 the stones topple top-to-bottom with a 0.15 s stagger (±25° spin, then a bounce). 0.6 a spark fountain (30). 0.9 the ember goes out to one grey smoke column. 1.2 a dust ring r 140. Rest state = a low rubble pile and a stump pole.

### Units
| Role | Name (id) | Size | Look / distinguishing shape |
|------|-----------|------|-----------------------------|
| Melee | **Thudder** (`stone_clubber`) | r14 h44 | existing: round body, zig-zag loincloth (team dark), spiky tuft, one eye, club as big as itself |
| Ranged | **Whirler** (`stone_slinger`) | r11 h68 | existing: stilt legs, hide vest (team dark), headband tail (team light), spinning sling ellipse |
| Heavy | **Boulderback** (`stone_boulderback`) | r20 h58 (≈46 wide) | "A walking landslide": a hunched lumpy-stone back is the whole silhouette (a flat-topped blob wider than tall, with moss-colored `#7c7a4a` specks), tiny head tucked in front. **Two flat rock slabs strapped to the fists** hang low like mittens (rounded rects 16×12). Attack = a double-fist slam (both slabs rise over the head, then drop). Every step raises dust |
| Specialist (skirmisher) | **Skitterling** (`stone_skitter`) | r9 h34 | The smallest unit in the game: a **crouched triangle** (the head is the forward point), all elbows. Knees and elbows stick out as sharp angles. Big round eyes, a team-light feather stuck in the hair. A bone knife is held back like a tail. Runs at 2× melee speed with a low 12° forward lean and very fast leg cycling (`GAIT.spec`, freq 0.34). A faint `#ffb347` glow sits on the knife tip |

### Turrets
| Type | Name (id) | Look |
|------|-----------|------|
| Rapid | **Sling Post** (`stone_rock_sling`) | existing: lashed A-frame, bone X bindings, pivot arm with pouch |
| Splash | **Pitch Pot** (`stone_pitch_pot`) | a 3-leg timber tripod holding a clay pot of **bubbling black pitch** (`#2b2118`, 3 bubbles pop at random with a highlight `#6a5a48`). A ladle arm tips a glob; the glob stretches in flight (squash/stretch) and lands as a dark splat decal that fades over 1.5 s |
| Pierce / long range | **Bone Bolt Rack** (`stone_bone_rack`) | a **bent sapling spring** (a curved trunk pulled back by a rope) with 3 sharpened bones racked beside it. Slow reload is shown as a visible **re-bending** of the sapling over the reload time. Projectile = a spinning bone (`#e8dcc2`) |

### Special: Rockslide (`stone_rockslide`, laneRain: 10 boulders across x 250-1050 over 2.5 s)
- **Pre-telegraph (0.8 s before the first drop):** the far mesa layer (L1) gets a "shrug": it shifts up 3 px and back, while a dust plume puffs off its top edge. The screen rumbles (trauma 0.15), and a low sine tone plays.
- **Per-boulder telegraph (0.6 s before each impact):** a ground shadow grows from 20%→100% (rx = radius 40 × 0.7) and darkens from 10%→45% alpha. Pebbles trickle from the top of the screen above it. The player sees a thin dashed ember ring (r 40 = the hit radius).
- **Impact:** a boulder (`blob`, r 22) drops at 900 px/s; squash 1.3×0.7 (80 ms), a dust ring r 90, 10 debris, trauma 0.2. The boulder rolls 20 px, then fades.
- Needs: the sim should schedule the drops ahead of time (x, t) so the renderer can show the per-boulder shadow. See the constraints note.

---

## 2. Kiln Age: "Kiln Glow"

### Palette
| Role | Hex |
|------|-----|
| Sky top / mid / horizon | `#7fb4bf` / `#c8dccb` / `#f3e7c4` (hazy noon, low saturation so teal units still read) |
| Sun (high, small, white-gold) | `#fff6d8`, halo `rgba(255,246,216,.35)` |
| Far terraced hills / mid ridge / near reeds | `#b6ae8a` / `#978a60` / `#6f7440` |
| Ground (sun-baked clay) / lip / dots / cracks | `#a07a4a` / `#7a5a34` / `#b58d5a` / `#86633a` |
| Accents: bronze / bronze hi / kiln glow | `#c8893a` / `#f0c070` / `#ff9a3c` |
| Clay (desaturated so it's never confused with the enemy) | `#a8805e`, dark `#7e5c40` |
| Specialist glow | `#ffc861` |
| Key light (rim) | `#fff2c8` from above (rim on the top edges) |

### Background layers
| Layer | Factor | Spec |
|-------|--------|------|
| L0 | 0.00 | gradient + a small high sun at world x 760, y −200 + 3 puffy **flat-bottom clouds** drifting at 6 px/s |
| L1 | 0.10 | **stepped terraced hills** (horizontal stripes 12 px, alternating `#b6ae8a` / `#aca47f`) |
| L2 | 0.30 | ridge `#978a60` dotted with **beehive kiln silhouettes** (domes 30-50 px); thin smoke lines `#d9ccb0` @50% rise from them |
| L3 | 0.60 | reed beds (clusters of tall strokes swaying at sin 0.8 Hz, ±2°) + a slow river strip `#9fc2b6` with sparkle dashes |
| L4 | 1.00 | clay ground with a **polygon mud-crack** pattern `#86633a` and a few broken pot shards |

### Base: Kiln Tower
- **Intact:** a 2-tier beehive kiln (bottom dome 110×70, top dome 70×50) in clay (gradient `#b89070`→`#8a6648`), bound by 3 bronze hoops `#c8893a`.
  The front has an arched **kiln mouth** that glows (radial `#ffd27a`→`#ff7a2a`, flicker) and is the heart. A chimney stub on top gives off sparks. A tall team pennant flies above.
  The team mark is a stamped ring-and-dot row on the lower dome.
- **Damaged:** crack A down the lower dome, one hoop snapped and hanging loose (it swings on hits), the kiln mouth at 70%.
- **Critical:** a breach hole in the top dome with fire visible inside, soot streaks `#3a2a20` @60% above the mouth, the pennant shredded.
- **Destroyed (1.8 s):** the top dome caves in (scaleY 1→0.2, 0.4 s) → the lower dome splits into 5 clay shards that fly out → a glowing ember puddle spreads across the ground (radial, fades over 2 s) → rubble plus one bronze hoop rolling away.

### Units
| Role | Name (id) | Size | Look / distinguishing shape |
|------|-----------|------|-----------------------------|
| Melee | **Clanger** (`kiln_clanger`) | r14 h46 | Round body in a clay-bead apron (team dark), topknot with a team-light ribbon. Carries a **fire-hardened clay maul**: a fat barrel head with 2 bronze bands on a short haft. On impact a **ring line** (2 concentric arcs) pops off the maul ("rings like a pot") |
| Ranged | **Shardpelter** (`kiln_pelter`) | r11 h70 | Stick figure in a long linen kilt with a team-dark hem, and a leather **cup-sling on a short stick** (a hinged arm). A small **glowing shard pouch** hangs at the hip (`#ff9a3c`), so it reads "warm". The shot is an orange shard with a spark trail |
| Heavy | **Anvilhorn** (`kiln_anvilhorn`) | r21 h62 (≈48 wide) | A broad torso under a **baked-clay helm with an anvil-shaped brow** that overhangs the face: a flat top and a forward "horn" point, wider than the shoulders. This is the unmistakable silhouette. Short pillar legs. Attack = a headbutt (the whole body tilts forward 20° and snaps back) |
| Specialist (support) | **Hearthkeeper** (`kiln_hearth`) | r11 h56, pole to +26 | A small robed elder holding a **pole taller than itself with a coal pot** at the top (glow `#ffc861`) that gives off rising heat-shimmer rings. Heal aura (r 90) visual: a faint warm ground ellipse r 90 (`rgba(255,200,97,.10)`), plus tiny `+` motes rising from healed allies |

### Turrets
| Type | Name (id) | Look |
|------|-----------|------|
| Rapid | **Bronze Dart Frame** (`kiln_dart_frame`) | a clay pedestal and a bronze frame with a **clacking shuttle** (it slides back and forth per dart); darts are thin bronze lines |
| Splash | **Clay Mortar** (`kiln_mortar`) | a squat kiln-fired tube angled 50°, bound with rope; coughs a smoke puff plus a glowing shard cluster that bursts on landing |
| Burn (short range) | **Firebrick Oven** (`kiln_brick_oven`) | a small brick oven with an arched mouth facing the lane; spits a spray of embers (pooled sparks) and a heat shimmer above. Burning targets get 2 small flame licks on top for the burn duration |

### Special: Kiln Burst (`kiln_ember_burst`, laneRain: 12 shards + burn, over 2.5 s)
- **Telegraph (0.9 s):** every kiln silhouette in L2 **lights up** (its door glows `#ffd27a`) one by one from your side toward the enemy (0.05 s stagger), and the sky's horizon warms (a `#ff9a3c` @0-20% overlay).
  Per shard (0.5 s before impact): a flickering orange ground ring (r 45) with an ember dot falling slowly (drifting side to side, like "clouds of glowing shards drift down").
- **Impact:** a shard cluster bursts (6 sparks + an ember splat that burns 3 s: small flame licks on the ground), trauma 0.12.

---

## 3. Banner Age: "Banner Field"

### Palette
| Role | Hex |
|------|-----|
| Sky top / mid / horizon | `#7f93ad` / `#bcc6cc` / `#efe4c8` (breezy, desaturated morning) |
| Cloud tops / cloud shade | `#f6f1e4` / `#a9b4bf` |
| Far hills / mid hedgerow fields / near stone walls and fence | `#9aa37a` / `#6f7a4a` / `#6e6656` |
| Ground (trampled path) / lip / grass edge / dots | `#6a5a3e` / `#4c3f2a` / `#7c8448` / `#7d6b4c` |
| Accents: timber / iron / beacon fire | `#7a5a3a` / `#6b7078`, hi `#aab2bb` / `#ff8a2a` |
| Neutral banner cloth (non-team decor) | `#d9c89a` (cream, never team colored) |
| Specialist glow | `#ffe066` (pennant gold) |
| Key light (rim) | `#fff4dc`, from the upper left |

### Background layers
| Layer | Factor | Spec |
|-------|--------|------|
| L0 | 0.00 | gradient + 2 decks of big rounded clouds (flat shade bottoms) drifting at 8 px/s |
| L1 | 0.10 | rolling far hills `#9aa37a` with 3 tiny hill-forts (a square + pennant pole) |
| L2 | 0.30 | hedgerow fields in patchwork stripes (`#6f7a4a` / `#77804f`) + a windmill whose sails turn at 0.2 rev/s |
| L3 | 0.60 | dry-stone walls and fence posts `#6e6656`, cream pennants on poles that **flap in the wind** (sin-displaced quad strip) |
| L4 | 1.00 | trampled dirt path + a grass fringe along the lip (tufts that sway ±3°) |
| Weather | live | **wind**: drifting seed fluff (30 motes, `#f6f1e4` @60%, 20-40 px/s rightward with sine bob), occasional gusts that lift the grass and pennants together |

### Base: Banner Keep
- **Intact:** a squat square tower of dressed stone blocks (a jittered-edge grid; gradient `#8a8a86`→`#62625e`) on a wider plinth. On top is a timber **hoarding** (an overhanging gallery, planks `#7a5a3a`, iron bands).
  On the roof, the heart is a **beacon brazier** (an iron basket with a big flame). A **tall team war-banner** hangs from the hoarding down the front (a long vertical cloth in team dark with a team-light emblem: an original chevron-and-sun device).
- **Damaged:** 3 hoarding planks gone, an iron band bent, crack A across the blocks, the brazier at 70%, the banner's bottom corner ripped.
- **Critical:** a front corner of the parapet collapsed (a stepped hole), fire flickering in the arrow slit, the brazier tilted and spilling sparks, the banner hanging by one hook (swings).
- **Destroyed (2.0 s):** the hoarding collapses (planks fall with rotation) → the tower **slumps in 2 steps** (drop 30%, 0.2 s pause, drop 60%) with a dust burst each time → the brazier falls and scatters embers → the banner drifts down last and lands on the rubble.

### Units
| Role | Name (id) | Size | Look / distinguishing shape |
|------|-----------|------|-----------------------------|
| Melee | **Brambleguard** (`banner_hedgeman`) | r15 h50 | Round body almost completely covered by a **thorn-wrapped round shield** (a circle with a bramble zig-zag rim and thorn spikes), with a hooked spear poking over the top. A kettle helm with a team-light plume. It reads as a "spiky circle" |
| Ranged | **Quillwright** (`banner_quill`) | r11 h70 | Stick figure in a tall hood (the pointed hood tip is the silhouette tell) and a team-dark tabard. Carries a **squat wooden bolt-bow** held at the hip and cranks it (a winding arm circle). Bolt fletching is team light |
| Heavy | **Wallwalker** (`banner_wallwalker`) | r23 h70 (≈54 wide) | "A stack of shields on legs": **3 overlapping kite shields** stacked vertically (team dark fields, iron rims), with 2 small legs at the bottom and **one tired pair of eyes** peeking through a gap between the shields. Sways side to side while walking (lean ±0.06) |
| Specialist (skirmisher, haste aura) | **Pennant Runner** (`banner_runner`) | r10 h54, pole to +30 | A lean sprinter carrying a **long pole with a big trailing pennant** (team light, 3× body length, rippling). The pennant is the spike. Haste aura (r 100): allies inside get faint speed lines behind their feet, and the pennant tip has a gold glint `#ffe066` |

### Turrets
| Type | Name (id) | Look |
|------|-----------|------|
| Long range | **Spire Bow** (`banner_spire_bow`) | a great bolt-bow mounted **high on a banner pole** (the tallest turret; the pole has a cream pennant). A slow draw animation (the bow bends over 0.6 s), then a snap |
| Splash | **Oil Cauldron** (`banner_cauldron`) | a hanging iron pot on a **swing-arm**; it tips and pours a stream of glossy amber oil `#c99a3a` that splashes into a steaming puddle |
| Slow | **Warning Bell** (`banner_bell`) | a bronze bell in a timber frame; on each clang it swings and **3 expanding shock-ring arcs** travel down the lane. Slowed units get a wobble (±2° lean oscillation) |

### Special: Muster Horn (`banner_charge_horn`, buffAndShove: 8 s ally buff + enemy knockback 60)
- **Telegraph (0.8 s):** a big curled horn rises out of the Banner Keep's hoarding (scale 0→1, ease-out-back, 0.3 s). Every banner and pennant in L3 **snaps straight toward the enemy** (the wind flips direction) over 0.5 s, and the camera pushes 2% zoom-in.
- **Impact:** one long blast: a **sound-wave wall** (3 tall translucent cream arcs, 40 px apart) rolls down the lane at 900 px/s. As it passes, the enemy front is shoved (a squash + dust at their feet) and your units flash team light.
- **Buff (8 s):** allies get a team-light chevron over their heads and faint speed lines. The HUD special button shows the 8 s buff timer as an inner ring.

---

## 4. Gear Age: "Gear Smog"

### Palette
| Role | Hex |
|------|-----|
| Sky top / mid / horizon | `#3b2d4a` / `#7a4d5c` / `#e0935a` (amber-violet smog evening) |
| Far skyline / lit windows | `#4a3a4e` / `#ffc46b` |
| Mid gantries / near pipes and boilers | `#5b4448` / `#6e5245` |
| Ground (cinder brick) / lip / dots / rail | `#4a3a33` / `#332620` / `#5e4a3f` / `#8a7a6e` |
| Accents: copper / brass / steam / gauge red | `#b86b3a` / `#d4a54a` / `#efe6dc` / `#e0443a` (on bases only, never on units) |
| Specialist glow | `#c6ff6b` (acid lime, unique to this age) |
| Key light (rim) | `#ffb870`, a low warm rim on the back edges from the furnace-lit horizon |

### Background layers
| Layer | Factor | Spec |
|-------|--------|------|
| L0 | 0.00 | smog gradient + a big hazy low sun `#ffcf8a` behind the smog (radial only, no disc) + 2 smog bands drifting at 8 px/s |
| L1 | 0.10 | far factory skyline `#4a3a4e`: saw-tooth roofs, 6 chimneys, lit windows (tiny `#ffc46b` rects; 10% of them blink off every few s) |
| L2 | 0.30 | gantry cranes and a water tower `#5b4448`; **smoke plumes** from the chimneys (a pooled particle ribbon, 10 px/s, scaling up as it fades) |
| L3 | 0.60 | near pipes on stilts (horizontal cylinders with copper flanges) and a **giant slowly turning cog** (0.05 rev/s) half-sunk behind the lip |
| L4 | 1.00 | cinder-brick ground (running-bond lines `#3e302a`) + one rail track along the lip |

### Base: Boiler Bastion
- **Intact:** a riveted copper **boiler dome** (ellipse 120×90, gradient `#d08850`→`#8e4f2a`, rivet dots along the seams) on a brick plinth, with 2 smokestacks
  (a team-light band near their tops). The front **firebox door** with a slotted grille glows and is the heart. A pressure gauge (needle in the green), and side pistons pumping at sin 0.5 Hz.
- **Damaged:** a steam leak jet from 1 seam (pooled particles `#efe6dc`), the needle in yellow, one stack dented, the firebox at 70%.
- **Critical:** 3 leaks, popped rivets (missing dots + holes), a red warning lamp on top blinking at 2 Hz `#e0443a`, the needle quivering in red, the pistons stuttering.
- **Destroyed (1.8 s):** **pressure blast**: 0.0-0.3 the dome swells (scale 1→1.12, shaking), the gauge spins → 0.3 white flash + burst → 6 copper plates fly with spin and bounce → a big steam cloud (20 puffs) lingers for 2 s → a gutted plinth with bent stacks remains.

### Units
| Role | Name (id) | Size | Look / distinguishing shape |
|------|-----------|------|-----------------------------|
| Melee | **Cogbiter** (`gear_cogbiter`) | r15 h52 | Round body in a leather apron (team dark), goggles pushed up, a team-light neckerchief. **One arm ends in a big spinning toothed wheel** (a circle r11 with 10 teeth, rotating at 6 rad/s idle and 20 while attacking). It throws sparks on contact |
| Ranged | **Pipesnap** (`gear_pipesnap`) | r11 h72 | Stick figure in a long duster (team dark) and a **tall stovepipe hat** with a team-light band (the hat is the tell). Carries a long **brass air-pipe rifle** with a pressure bulb; each shot gives a white puff ring and a hot rivet (orange streak) |
| Heavy | **Boilerhulk** (`gear_boilerhulk`) | r25 h78 (≈58 wide) | A **walking boiler**: a barrel body, a porthole face with one eye, and thick piston legs that **vent steam from the knees** on each step. A team-dark stripe on the barrel and a team-light chimney cap. The punch = a pressure-valve fist that extends on a piston |
| Specialist (support, shield pulse) | **Tinker Wisp** (`gear_wisp`) | r10 h60, kite to +24 | A **diamond-shaped clockwork kite** (brass frame, cream sail, a spinning propeller) floating above, with a small tinkerer **dangling below** on a harness. The kite diamond is the spike. Shield pulse every 6 s: a lime `#c6ff6b` ring expands to r 80, and shielded allies get small brass plates clipped to their fronts (a curved rect that flashes and pops off when the shield breaks) |

### Turrets
| Type | Name (id) | Look |
|------|-----------|------|
| Rapid | **Rivet Gun** (`gear_rivet_gun`) | a brass box with a hand crank and a chain feed of glowing hot rivets; the crank spins while firing, and rattle-shake the housing ±0.5 px |
| Splash | **Steam Mortar** (`gear_steam_mortar`) | a squat kettle-shaped mortar whose lid rattles; it lobs a **tiny overheated boiler** (a mini barrel with a whistle) that bursts into a scalding cloud |
| Slow | **Magnet Coil** (`gear_magnet_coil`) | a copper coil on an insulator post with a blue-white hum glow on its rings; field lines (3 dashed arcs) reach toward slowed targets, and their buckles/gears get small sparkles |

### Special: Steam Vent (`gear_steam_vent`, groundZone 260 wide at the enemy front, 6 s)
- **Telegraph (1.0 s):** a hiss from your base. A line of **ground cracks with steam puffs travels out** along the lane from your front to the zone (the crack front moves at 600 px/s, with a puff every 20 px).
  Then 0.6-1.0: 4 round **vent grates** glow lime-white across the 260 px zone and the ground shakes (trauma 0.1).
- **Active (6 s):** a scalding cloud: 25 pooled steam puffs cycling inside the zone (alpha .5, rising 30 px/s), a hot orange underglow on the ground, and units inside get a red tint flicker every 0.5 s (the DoT tick) plus slowed walk cycles. It fades out over 0.5 s at the end.

---

## 5. Spark Age: "Spark Night"

### Palette
| Role | Hex |
|------|-----|
| Sky top / mid / horizon | `#120f2e` / `#2b2260` / `#6a4a9c` (violet, so the teal player never merges with the sky) |
| Stars / storm clouds / cloud rim | `#e9e4ff` / `#2a2450` / `#8c7bff` |
| Lightning (always white-violet, **never cyan**) | core `#ffffff`, glow `#cfc4ff` |
| Far mesas at night / mid copper lightning rods / spire highlight | `#2a2550` / `#3d3478` / `#b7a8ff` |
| Near glass dunes / ground / lip / glimmer dots | `#2c2a4a` / `#25223d` / `#17152a` / `#d9d2ff` |
| Accents: copper / crystal / core gold | `#c07a48` / `#b7a8ff` / `#ffd98a` |
| Specialist glow | `#ffffff` with a team-tinted halo |
| **Rim light (required this age)** | `#b7a8ff` on the top-left edges + a ground-bounce `#6a4a9c` on the bottom edges |

The ink outline vanishes on a night sky, so Spark units get: (1) the rim-light crescent, (2) **emissive seams** in the team light color (2 px strokes, `lighter` blend),
and (3) a 12 px team-colored ground glow under their feet instead of a dark shadow.

### Background layers
| Layer | Factor | Spec |
|-------|--------|------|
| L0 | 0.00 | night gradient + 160 stars (3 sizes, 5% twinkle) + slow storm-cloud masses with violet rims (drift 4 px/s). **Sheet lightning** inside the clouds every 5-9 s (the cloud rim flashes 80 ms) |
| L1 | 0.10 | the Stone Age mesas returned at night (`#2a2550`), a callback to the dusk opening, now with tiny copper rods on top |
| L2 | 0.30 | tall copper **lightning rods and crystal spires** `#3d3478`; now and then (every 7-12 s) a thin forked bolt strikes a rod (a 2-frame polyline, white core + `#cfc4ff` glow) and lights L2 for 60 ms |
| L3 | 0.60 | near glass dunes with star reflections (dots that shift at factor 0.4 against the dunes for a glassy feel) |
| L4 | 1.00 | dark ground + a faint etched hex-lattice `#2f2b52` + glimmer dots |

### Base: Storm Spire
- **Intact:** a faceted crystal-and-copper obelisk (a tall hexagon prism; facets gradient `#5a4aa8`→`#2a2458`, copper ribs `#c07a48`) on a ring plinth.
  The heart is a **caged storm core**: a copper cage near the top with a tiny crackling thundercloud inside (a gray-violet puff with 1-2 mini bolts flickering). A holo-flat team pennant sits on the tip.
- **Damaged:** crack A that glows team light, 1 cage bar bent, the core at 70% with fewer bolts, a stray arc jumping to the ground every 2 s.
- **Critical:** the spire tilts 7°, **glitch slices** (every 0.8 s, 2 horizontal bands of the cached image offset ±4 px for 60 ms), the core flickers, and constant stray arcs.
- **Destroyed (2.0 s):** **implosion then shatter**. 0.0-0.4 everything is pulled toward the core (scale 1→0.85) and the sky dims 20% → 0.4 white flash + a ring shock r 200 → the spire breaks into 12 faceted shards → 0.8-2.0 the storm escapes as a rising bolt column that fades → the plinth ring remains, dark.

### Units
| Role | Name (id) | Size | Look / distinguishing shape |
|------|-----------|------|-----------------------------|
| Melee | **Arcfencer** (`spark_arcblade`) | r15 h54 | Round, smooth egg-shell body (team-dark band + emissive seam), a visor slit glowing team light. Wields a **humming wire-whip**: a sin-wave polyline 50 px long that crackles white-violet at the tip on each hit |
| Ranged | **Glintcaster** (`spark_lancer`) | r11 h74 | The tallest stick: a thin robed figure with a halo ring (team light) and a **crystal staff** taller than itself with a faceted tip. Shots are bright white darts with a 1-frame lens flare at the tip |
| Heavy | **Stormcradle** (`spark_cradle`) | r26 h84 (≈60 wide) | The biggest unit in the game: a **copper cage body on stomping stilt-legs** with a trapped thundercloud churning inside (a gray-violet cloud blob with mini bolts). The flat cage top reads as a block. Each stomp gives a little lightning arc into the ground |
| Specialist (support, damage-reduction aura) | **Pulse Warden** (`spark_warden`) | r11 h64, mast to +28 | A slim figure carrying a **tuning-fork mast** (a two-pronged tall fork = the spike). Visible sound pulses: a concentric ring (team light, alpha .25) leaves the fork every 1 s and expands to r 95. Allies in the aura show a thin hex-shimmer outline when they're hit |

### Turrets
| Type | Name (id) | Look |
|------|-----------|------|
| Chain | **Arc Pylon** (`spark_arc_pylon`) | a lightning rod on insulator discs with a crackling ball tip; fires jagged polyline bolts that jump between targets (regenerate the polyline each frame for 3 frames) |
| Long beam | **Prism Lens** (`spark_prism`) | a tilting crystal lens on a copper yoke; fires a continuous white-gold beam (additive, with a 6 px core and a 16 px glow) with sparkles along it |
| Slow splash | **Hush Drum** (`spark_gravity_drum`) | a huge taut drum on a frame; each beat makes the skin dip (squash) and sends a **dark heavy ring** (inverted: a `multiply` darkening wave) along the ground. Slowed units sink 2 px and walk with a heavy bob |

### Special: Static Surge (`spark_static_surge`, chainStrike: 3 strikes 0.6 s apart, each jumping 6 times)
- **Telegraph (1.2 s):** the sky dims 30% (a multiply overlay) and the storm clouds above the lane churn faster. 3 **target runes** (2 counter-rotating rings with tick marks, team light) appear under the 3 chosen enemies,
  and **faint chain previews** (dotted white-violet lines) flicker between likely jump targets. At 0.9-1.2 the runes contract and a whine rises.
- **Impact:** each strike is a thick forked bolt from the top of the screen (a white core with a `#cfc4ff` glow, 3 frames), a flash, trauma 0.3, and then 6 fast jump arcs rival-to-rival (0.05 s each).
  Stunned units get twitch jitter (±1.5 px) and small sparks for 1 s. The sky returns over 0.4 s.

---

## 6. Age-up transition: shared sequence (2.4 s, does not pause the sim)
Triggered on the player's side only (the enemy AI advances ages too; the enemy uses the same sequence **mirrored and at half intensity**, with no HUD banner).

| t (s) | Beat | Visual |
|-------|------|--------|
| 0.00-0.30 | **Flare** | The heart flashes to 160% size and white-hot; an additive radial r 120 builds; time dilation 0.85× on the render clock only (FX), not on the sim |
| 0.30-0.70 | **Column** | A light column (w 60, full height) rises from the heart in the *new* age's accent color; a ring shock r 0→220 on the ground; shake 5 |
| 0.50-1.10 | **Remake** | The age-specific morph for the old base → new base (see each age). It uses the two cached base canvases, and the morph is a clip-mask wipe driven by `p` |
| 0.70-1.60 | **World crossfade** | Background layers crossfade old → new (draw old cache at `1-p`, new at `p`). Farther layers change first: L0 starts at 0.7, L1 at 0.8, L2 at 0.9, L3 at 1.0, L4 at 1.1, and each lasts 0.5 s. This makes a "wave" rolling out from the horizon |
| 1.20-2.20 | **Banner** | HUD center stamp: age name (48 px, weight 900, `#ffd27a`) drops in with squash (1.3×0.7 → 1), 0.8 s hold, then fades. Beneath it, 4 new unit portraits pop in left-to-right at 0.08 s each |
| 1.60-2.40 | **Settle** | Heart settles to 100%; a burst of 24 age-accent sparks; the unit buy bar icons flip (Y-scale 1→0→1 per card, 0.1 s stagger) to the new age's units |

**Per-age "Remake" morphs (the 0.50-1.10 s beat):**
| Transition | Remake visual |
|------------|---------------|
| Match start (Stone) | "Heart ignite" only: the ember bowl lights from a single spark (0.6 s); no remake |
| Stone → Kiln | the cairn stones **melt into clay** (lerp the stone `blob` vertices toward the dome outline over 0.5 s, and crossfade the fill to the clay gradient), then the bronze hoops clang on one per 0.12 s |
| Kiln → Banner | the domes **cool to stone** with a grey wipe from the bottom up (`source-atop`, 0.4 s); block rows slam in from above (4 rows × 0.1 s); the hoarding unfolds like a hinged frame (rotate −90°→0, 0.3 s); the war-banner unrolls downward |
| Banner → Gear | copper plates **wrap** the keep (a diagonal clip-mask wipe, 0.5 s) → rivets pop in along the seams (20 rivets over 0.3 s) → the stacks telescope up → the first whistle blast ring |
| Gear → Spark | the boiler **dissolves into light** with a horizontal scanline wipe (8 bands × 0.05 s, each band slides and fades) → the spire assembles from 12 shards flying in (ease-out-back, 0.6 s) → the storm core sparks alive with the first bolt. The night-sky crossfade gets 0.8 s here because it is the biggest palette change |

Units already on the field keep their old-age look (they are old-age types). This is intended and reads as progression.

---

## 7. Quick asset checklist per age (for the coder)
- `PAL_<age>` object: the same keys as the current `PAL` + `specGlow`, `rim`, `ink`, and `teamP/teamPL/teamE/teamEL`.
- `drawBase_<age>(state)` → static into cache; `drawBaseLive_<age>(t, frac)` → heart, smoke, flag.
- `draw<Unit>(o)` × 4, following the `o = {team, teamL, flash, moving, walk, swing, id}` contract (+ `o.hitT` for squash, `o.age`).
- `drawTurret_<type>(t, lastShot, dir)` × 3, the same signature as `drawSlingPost`.
- `bgLayers_<age>` = array of `{ f, draw(ctx, w, h) }` (see techniques.md §8/§9).
- Special: `{ telegraph: seconds, draw(p, zone), impact(zone) }`.
