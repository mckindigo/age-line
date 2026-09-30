# AGE LINE — House Style: "Ember Dusk"

Everything in the game is drawn procedurally with Canvas 2D paths at runtime. No sprites, fonts or icons are imported.
All names, shapes, layouts and iconography are original to AGE LINE.

## Mood
Late-afternoon desert dusk at the end of the Stone Age: a huge low sun sits on the horizon behind layered mesas,
and two stone cairns face each other across one dusty lane. It should feel warm, a bit goofy, and chunky.

## Palette (Stone age)
| Role | Hex |
|---|---|
| Sky (horizon, required) | `#e8c79a` |
| Sky mid / top (dusk gradient) | `#d99270` / `#b35f55` |
| Sun | `#f7dc8e` |
| Mesas far / mid | `#c79a78` / `#a9785a` |
| Ground (required) / lip / pebbles | `#7a5b3a` / `#5f4329` / `#8c6a46` |
| Outline ink (used everywhere) | `#2a1a10` |
| Stones | `#9a8670` `#86735e` `#a8937a` `#918069` |
| Skin / shade | `#c98a5a` / `#a86d44` |
| Wood / knots | `#8a5a33` / `#6a4225` |
| Player tribe (teal war paint) | `#2f8f83`, light `#5cc0b0` |
| Rival tribe (rust ochre) | `#b8432f`, light `#e0735c` |
| Ember | `#ff8a2a`, hot `#ffe08a`; gold `#ffd24a` |

## Shape language
- **Bold flat vector.** Solid flat fills, one highlight at most, and a thick dark-brown ink outline (3–3.5 world px) with round joins. No gradients on characters.
- **Exaggerated silhouettes you can read at 10 px tall:**
  - **Thudder** (melee): nearly a perfect circle of a body with stubby block legs, a tribe-colored zig-zag loincloth band,
    a spiky hair tuft, one big eye under a heavy brow, and a **club almost as big as itself**. The club winds back, then slams forward.
  - **Whirler** (ranged): **lanky**: stilt legs, a tall narrow hide vest with fringe, a tiny head on a long neck, a pointy nose,
    and a headband tail blowing in the wind. One arm is always raised with a **sling that keeps spinning** in an ellipse. It spins faster when attacking.
  - **Sling Post** (turret): a lashed timber A-frame with bone-colored X bindings and a pivoting throwing arm with a pouch.
- **Bases: stacked-stone cairns.** Four lumpy stones get smaller toward the top, painted with the tribe's spiral and dot marks.
  A hide banner on a leaning pole sits at the back. On top is a **bowl-shaped ember crown**: flickering layered flames with an additive glow.
  The ember shrinks and dims as the cairn loses HP, and cracks show up at 66% and 33%.
- Team identity comes only from accent color (war paint, vests, banners, HP bars) and facing direction. The silhouettes stay the same for both sides.

## UI: stone-slab kit
- Panels, pills and buttons are **stone slabs**: a warm gray-brown vertical gradient, asymmetric rounded corners (every slab looks a little hand-chipped),
  a thick ink border, an inner top highlight and bottom shade, and a hard 4 px drop "ledge" that squashes when pressed.
- Primary actions are **ember slabs** (orange gradient). The selected difficulty glows ember too.
- Icons are drawn in canvas with the same outline rules: an amber nugget (gold), an ember spiral (XP), mini portraits of the units and turret,
  and a stacked-stone arrow for Evolve. Locked items are shown desaturated.
- Text is heavy (800–900 weight) and light cream `#fff3dc` with a 2 px ink drop shadow.
- Touch first: every interactive target is at least 48 px. Stats are printed on the cards, and long-press opens a slab tooltip, so no info is hover-only.
- Portrait and narrow screens zoom in to about half the lane. The camera follows the front line, and you can drag to look around.

## Juice
White hit-flash (90 ms). A death pop with a ring shock, a burst of team-colored chunks that bounce, and dust puffs.
Floating gold `+N` text on kills. A light screen shake on base hits (stronger when your own cairn is hit). Dust puffs on spawn.
The sling arm recoils, and the banners and flames animate.
