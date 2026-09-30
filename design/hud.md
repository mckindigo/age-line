# AGE LINE: HUD Redesign v0.2 ("Basalt & Ember")

All coordinates are **CSS px** in the layout viewport (the canvas is also CSS-px based in `render()`, scaled by `dpr`).
Rects are `x, y, w, h` from the top-left. Keep the HUD as **DOM buttons** (as v0.1 does). This keeps `bindPress()` long-press tooltips,
keyboard focus and screen-reader labels. Position them with `position:absolute` using the numbers below. Put one layout class on
`#hud` (`.L-desk` / `.L-phone`) chosen in `resize()`, and between the two anchor points scale with `left/right` anchoring as noted.

What changes vs v0.1 (from the screenshots):
- Base HP moves from in-world bars (they overlap the ember crown and turret slot on the player cairn) to **top HUD bars**. The in-world bars shrink to a 60×6 sliver shown only for 2 s after a hit.
- Gold, the buy bar, turrets, evolve and special are consolidated into **one bottom dock**. The training queue floats above the dock on the empty dirt band.
- The turret card (key 3) is replaced by **3 turret sockets**. Evolve becomes a real XP-bar-plus-button block. A new **Special** round button with a cooldown ring is added.
- On phone landscape the v0.1 cards were 88 px wide with 10 px stat text, and the lane was only 170 px tall. The redesign shrinks cards to icon + cost (stats move to long-press) and gives the lane more height.

---

## 1. Visual kit

### 1.1 Fonts
- Stack (no imports, same as v0.1): `"Trebuchet MS","Segoe UI",system-ui,sans-serif`. Use `font-variant-numeric: tabular-nums` on every number so the digits don't jitter.
- Text color `#fff3dc` with a `0 2px 0 #2a1a10` ink drop shadow (the house rule).

| Token | Desktop | Phone | Weight |
|-------|---------|-------|--------|
| Gold value | 30 px | 20 px | 900 |
| Timer | 22 px | 17 px | 900 |
| HP number | 16 px | 13 px | 900 |
| Card cost | 17 px | 15 px | 900 |
| Card name | 13 px | hidden (long-press) | 800 |
| Hotkey chip | 11 px | hidden | 800 |
| Labels (TRAINING, XP) | 11 px, uppercase, `letter-spacing:.08em` | 10 px | 800 |
| Age-up banner | 48 px | 34 px | 900 |

### 1.2 Colors
| Token | Hex | Use |
|-------|-----|-----|
| `--ink` | `#2a1a10` | borders, text shadow, ledges |
| `--cream` | `#fff3dc` | text |
| `--gold` | `#ffd24a` / cost text `#ffe29a` | gold, costs |
| `--deny` | `#ff9b85` | unaffordable cost text |
| `--ember` | `#ff8a2a` / `--ember2` `#ffd27a` | primary buttons, ready glows |
| `--slab1` / `--slab2` | `#a8957d` / `#7c6a56` | card faces (the existing slab) |
| `--basalt1/2/3` | `#5a4330` / `#3a2a1d` / `#2a1d14` | dock and top panels |
| `--track` | `#2b1d13` | bar tracks |
| `--p` / `--pL` | per age (art-direction §0.2) | player HP |
| `--e` / `--eL` | per age | enemy HP |
| `--age-accent` | stone `#ff8a2a`, kiln `#f0c070`, banner `#ffe066`, gear `#d4a54a`, spark `#b7a8ff` | dock rim line, evolve shimmer, banner |

### 1.3 Panel styling (CSS)
```css
/* Dock + top panels: carved basalt plate, chipped corners, rim light, ledge + soft shadow */
.plate{
  background:linear-gradient(180deg,var(--basalt1) 0%,var(--basalt2) 55%,var(--basalt3) 100%);
  border:3px solid var(--ink);
  border-radius:22px 26px 18px 24px/24px 18px 26px 22px;           /* hand-chipped asymmetry */
  box-shadow:
    inset 0 2px 0 rgba(255,226,170,.28),                          /* top rim highlight */
    inset 0 -4px 0 rgba(0,0,0,.35),                               /* bottom shade */
    0 4px 0 var(--ink),                                           /* hard ledge (house style) */
    0 12px 24px rgba(20,10,4,.45);                                /* soft drop shadow */
  position:absolute;
}
.plate::before{ /* thin age-accent rim line, 6px inside the top edge */
  content:"";position:absolute;left:14px;right:14px;top:5px;height:1px;border-radius:1px;
  background:linear-gradient(90deg,transparent,var(--age-accent),transparent);opacity:.45;
}
.socket{ /* recessed seat under each card */
  position:absolute;border-radius:16px;background:rgba(0,0,0,.28);
  box-shadow:inset 0 3px 6px rgba(0,0,0,.45),inset 0 -1px 0 rgba(255,226,170,.12);
}
/* Cards = existing .slab, plus: */
.card{transition:transform .08s, filter .15s}
.card:hover{transform:translateY(-1px);filter:brightness(1.06)}          /* desktop only */
.card.down{transform:translateY(3px);box-shadow:inset 0 3px 0 rgba(255,240,210,.2),inset 0 -2px 0 rgba(0,0,0,.2),0 1px 0 var(--ink)}
.card.off{filter:saturate(.35) brightness(.78)} .card.off .cv{color:var(--deny)}
.card .fill{position:absolute;left:3px;right:3px;bottom:3px;border-radius:0 0 12px 12px;
  background:linear-gradient(0deg,rgba(255,210,74,.28),rgba(255,210,74,.08));height:0} /* "saving up" fill = gold/cost */
.card.locked{filter:grayscale(1) brightness(.6)}
.ready{animation:glow 1.2s ease-in-out infinite}
@keyframes glow{0%,100%{box-shadow:0 0 0 3px var(--ember2),0 0 10px 2px rgba(255,138,42,.45),0 4px 0 var(--ink)}
                50%{box-shadow:0 0 0 3px var(--ember2),0 0 22px 6px rgba(255,138,42,.85),0 4px 0 var(--ink)}}
```

### 1.4 Shared states (every interactive element)
| State | Trigger | Visual |
|-------|---------|--------|
| **Affordable / idle** | gold ≥ cost | full slab color, cost `#ffe29a`, ledge 4 px |
| **Unaffordable** | gold < cost | `saturate(.35) brightness(.78)`, cost `#ff9b85`, **saving-up fill** rises from the bottom to `gold/cost` (so you can see how close you are). When it reaches 100%: a 150 ms white flash, then the card goes to affordable |
| **Pressed** | pointerdown | translateY 3 px, ledge 4→1 px, 80 ms, and `SND.ui` |
| **Denied** | tap while unaffordable/full | 160 ms horizontal shake (±4 px, 3 cycles), the cost text flashes `#ff9b85`→cream, and `SND.deny` (toast is optional; the shake replaces most toasts) |
| **Queued badge** | this unit is in the queue | a round badge at the top-right corner, 20×20 (phone 18), `#ff8a2a` with an ink border, text "×N" |
| **Queue full** | 5/5 | all unit cards get a 14 px "FULL" ink strip across the bottom |
| **Cooldown** | special/evolve recharging | a dark wedge `rgba(20,12,8,.62)` sweeps clockwise (conic-gradient) + seconds left in the center |
| **Ready glow** | special ready / evolve available | `.ready` pulsing glow (1.2 s) + a spark dot orbiting the ring every 2 s |
| **Locked** | unit/turret from a future age | grayscale, a small stone padlock glyph, and the tooltip explains which age unlocks it |
| **Focus (keyboard)** | `:focus-visible` | 3 px `#ffd27a` outline, offset 2 |

---

## 2. Desktop 1280 × 720

### 2.1 Layout table
| Element | x | y | w | h | Notes |
|---------|---|---|---|---|-------|
| **Player base HP panel** (`.plate`) | 16 | 12 | 420 | 56 | anchored left |
| · crest (mini base icon, canvas) | 22 | 16 | 48 | 48 | shakes on hit, red tint <33% |
| · label "YOUR CAIRN" (per-age base name: Cairn / Kiln Tower / Banner Keep / Boiler Bastion / Storm Spire) | 78 | 17 | 200 | 14 | 11 px label |
| · HP bar | 78 | 34 | 300 | 20 | fills left→right |
| · HP number | 384 | 31 | 46 | 24 | right-aligned |
| **Timer** (`.plate`) | 590 | 16 | 100 | 40 | centered; `m:ss` |
| **Age chip** (non-interactive) | 565 | 60 | 150 | 22 | "STONE AGE" in `--age-accent` |
| **Enemy base HP panel** | 772 | 12 | 420 | 56 | mirrored |
| · HP number | 778 | 31 | 46 | 24 | left-aligned |
| · HP bar | 830 | 34 | 300 | 20 | fills **right→left** |
| · label "RIVAL CAIRN" | 930 | 17 | 200 | 14 | right-aligned |
| · crest | 1138 | 16 | 48 | 48 | |
| **Pause button** | 1208 | 12 | 56 | 56 | anchored right; icon 28×28 |
| **Training queue panel** (`.plate`, 90% opacity) | 16 | 508 | 296 | 60 | floats over the dirt band |
| · tab label "TRAINING 2/5" | 24 | 492 | 120 | 18 | sits on the top edge of the panel |
| · queue slots ×5 | 24 + i·56 | 514 | 48 | 48 | i = 0..4 → x 24, 80, 136, 192, 248; tap = cancel/refund |
| · active slot progress | slot 0 | | | | 4 px conic ring around the slot + a bottom bar 5 px `#ffd27a` |
| **Toast / info line** | 440 | 470 | 400 | 36 | centered; auto-hide 1.1 s |
| **Bottom dock** (`.plate`) | 16 | 576 | 1248 | 132 | bottom margin 12 |
| · **Gold block** | 28 | 588 | 160 | 108 | not a button |
| ·· nugget icon | 36 | 598 | 36 | 36 | bounces on `+N` |
| ·· gold value | 80 | 598 | 100 | 36 | 30 px |
| ·· income line "+2.0/s" | 36 | 644 | 144 | 18 | 13 px, `#ffe29a` |
| ·· army line "ARMY 7 · KILLS 12" | 36 | 666 | 144 | 18 | 11 px label |
| · **Unit cards** ×4 (sockets same rect +4) | 200 / 316 / 432 / 548 | 588 | 108 | 108 | gap 8; hotkeys **1 2 3 4** |
| ·· hotkey chip | +6 | +6 | 18 | 18 | top-left |
| ·· portrait canvas | +24 | +8 | 60 | 52 | idle animation is optional (redraw at 10 fps) |
| ·· name | +4 | +62 | 100 | 16 | |
| ·· cost (nugget 16 + value) | +4 | +80 | 100 | 22 | |
| ·· queued badge | +84 | −6 | 22 | 22 | overhangs the corner |
| · divider groove | 666 | 596 | 2 | 92 | `rgba(0,0,0,.35)` + 1 px highlight right |
| · **Turret sockets** ×3 | 676 / 772 / 868 | 588 | 88 | 108 | gap 8; hotkeys **Q W E** |
| ·· empty state | | | | | dashed ring 40 px + "+" and "SLOT 1" label; glows gently if you can afford any turret |
| ·· built state | | | | | turret portrait, name, a 3-pip level row (reserved), a small "SELL +25" strip at the bottom |
| · divider groove | 966 | 596 | 2 | 92 | |
| · **Evolve block** | 976 | 588 | 168 | 108 | |
| ·· XP label "XP 575 / 4000" | 986 | 592 | 148 | 14 | |
| ·· XP bar | 986 | 608 | 148 | 16 | ember gradient fill; shimmer sweep when full |
| ·· **Evolve button** | 986 | 630 | 148 | 58 | hotkey **V**; shows the next age icon + "EVOLVE"; `.ready` when XP ≥ need |
| · **Special button** (circle) | 1156 | 592 | 100 | 100 | hotkey **Space**; icon 56; cooldown ring r=46, 8 px |

**Turret picker popover** (opens on tapping an empty socket): `.plate`, w 300, h 124, 3 options of 92×104 (gap 8, pad 6).
It is anchored above the socket: `x = clamp(socketX + 44 − 150, 16, 1264 − 300)`, `y = 448`. For socket 1: 570, 448. Options take keys 1/2/3 while it is open.
Tapping outside or pressing Esc closes it.
**Sell flow:** tapping a built socket arms "SELL +25?" (the socket turns to the existing `.sell` teal slab) for 2 s. A second tap sells. This prevents accidental sells.

**Lane fit (desktop).** Replace the `topH/botH` math in `resize()` so the ground line sits above the queue panel:
`topH = 88; groundMaxY = 500; sc = Math.min(CW / 1240, (groundMaxY - topH) / 212); gy = groundMaxY - 30` → at 1280×720, sc = 1.03 and gy = 470.
Units stand at y 470. The dirt below the ground (38 world px) runs under the queue panel, which is fine because nothing is drawn there.

### 2.2 ASCII mockup (1280 × 720, 1 char ≈ 16 px)
```
 0         160       320       480       640       800       960      1120     1280
 +--------------------------------------------------------------------------------+
 |[@]YOUR CAIRN            1000|        [ 2:31 ]        |RIVAL CAIRN          [@]|[||]|  y12-68
 | [####################-----]        STONE AGE         [-------########]     332 |
 |                                                                                |
 |        ~ sky / sun / clouds (L0)          ~ far mesas (L1) ~                   |
 |   ~~~ mid mesas + arches (L2) ~~~            ~~~ near rock spires (L3) ~~~      |
 |  _^_                                                                     _^_   |
 | (ember)  o  |  o  |                               o  o |      O   o     (ember)|
 | [CAIRN] /|\ | /|\ |  -> -> ->      <FRONT>       <- <- <-     [Bould]  [CAIRN] |  gy≈470
 |================================================================================|
 |  TRAINING 2/5                         .: Not enough gold :.                    |  toast y470
 | +------------------------+                                                     |
 | |[T*][W ][  ][  ][  ]    |   <- queue y508-568, slot 48x48, tap = cancel        |
 | +------------------------+                                                     |
 | +----------------------------------------------------------------------------+ |  dock y576
 | | (o) 1234 |[1 Thud ][2 Whir ][3 Bould][4 Skitt]|[Q + ][W Sli][E + ]| XP ####--| | |
 | | +2.0/s   |[ o 15  ][ o 25  ][ o 45  ][ o 20 x2]|[SLOT][ SELL][SLOT]|[EVOLVE >]|(*)| |
 | | ARMY 7   |[      ][       ][ ~~~~~~][ ~~~~~ ]|[    ][ +25 ][    ]|[        ]|8s | |
 | +----------------------------------------------------------------------------+ |  y708
 +--------------------------------------------------------------------------------+
   gold 28-188   cards 200-656 (4×108)   turrets 676-956   evolve 976-1144  special 1156-1256
```
(`~~~` = the saving-up fill on unaffordable cards; `x2` = queued badge; `(*)` = the special with its cooldown ring.)

---

## 3. Phone landscape 844 × 390

### 3.1 Safe areas
- Use `env(safe-area-inset-*)` with fallbacks. Reference device (844×390, notch phones): **left/right 47 px, bottom 21 px, top 0**.
  The notch can be on either side, so both sides get 47. Formula: `padL = max(12px, env(safe-area-inset-left))`, etc.
  The numbers below assume 47/47/21. On devices without a notch they shift outward by `47−12`. Anchor left groups to `padL`, right groups to `CW − padR`, and center groups to `CW/2`.
- Interactive targets are **≥ 56 px** in their short dimension, except queue slots (44, a secondary action) and the pause button (56).

### 3.2 Layout table
| Element | x | y | w | h | Notes |
|---------|---|---|---|---|-------|
| **Player base HP panel** | 47 | 8 | 260 | 44 | |
| · crest | 51 | 12 | 36 | 36 | |
| · HP bar | 93 | 24 | 168 | 16 | no label on phone |
| · HP number | 265 | 20 | 38 | 22 | 13 px |
| **Timer** | 384 | 12 | 76 | 36 | center 422 |
| · age chip | 384 | 50 | 76 | 16 | 10 px, `--age-accent`, can be hidden |
| **Enemy base HP panel** | 473 | 8 | 260 | 44 | mirrored: crest x 693 y 12 36×36; bar x 519 y 24 w 168 (right→left); number x 477 y 20 w 38 |
| **Pause button** | 741 | 8 | 56 | 56 | |
| **Training queue strip** (`.plate` 90%) | 47 | 236 | 244 | 50 | |
| · slots ×5 | 51 + i·48 | 239 | 44 | 44 | x 51, 99, 147, 195, 243 |
| **Toast** | 272 | 196 | 300 | 30 | centered |
| **Bottom dock** | 47 | 290 | 750 | 79 | ends at y 369 (= 390 − 21 home-indicator inset) |
| · **Gold block** | 55 | 296 | 84 | 68 | nugget 20 at (59,302); value 20 px at (83,300); income 11 px at (59,330) |
| · **Unit cards** ×4 | 147 / 215 / 283 / 351 | 296 | 64 | 68 | gap 4; portrait 40×36 at +12,+4; cost at +4,+44 (w56 h20); queued badge 18 at +50,−6 |
| · **Turret sockets** ×3 | 425 / 485 / 545 | 296 | 56 | 68 | gap 4; the picker popover opens above: w 228, h 92, three 70×80 options, y 196 |
| · **Evolve block** (the whole block is the button) | 611 | 296 | 92 | 68 | XP bar at (617,301) w 80 h 8; icon 28 at (643,313); "EVOLVE" 10 px at y 346 |
| · **Special button** (circle) | 713 | 291 | 78 | 78 | cooldown ring r=35, 7 px; icon 44 |

**Phone interactions:** no hotkeys shown. Long-press (≥420 ms, existing `bindPress`) opens the tooltip with name and stats. The tooltip is placed above the dock (`y = 290 − h − 8`).

**Lane fit (phone landscape).** The ground line must stay above the queue strip (≤ y 232), and the lane top must be below the top bar (≥ 64).
`sc = Math.min(CW / 1050, (232 - 64) / 212)` → **0.79** (v0.1: 0.68, so units are +16% bigger). This means `viewW = 1050`, so the view pans with the existing camera-follow/drag code (`L.pan` true).
`gy = 232`. If showing the whole lane is preferred, keep `CW/1240` (0.68) and `gy = 232`. The extra sky room then goes to the art.

### 3.3 ASCII mockup (844 × 390, 1 char ≈ 9.4 px; `|:` = safe-area inset, 47 px)
```
 0    47                                    422                                  797 844
 +----+----------------------------------------+-------------------------------------+----+
 |    |[@] [##########----] 1000|   [ 2:31 ]   |332 [-------#########] [@]|  [||]   |    |  y8-52 (pause to 64)
 |  : |                            STONE AGE                                         | :  |
 |  : |      ~ sky ~        ~ far mesas ~            ~ mid mesas ~                   | :  |
 |  : |  _^_                                                                         | :  |
 |  : | (ember) o  |  o  -> ->        <FRONT>        <- <-   o   O                   | :  |
 |  : | [CAIRN]/|\ | /|\                                     /|\ [Bld]              | :  |  gy≈232
 |  : |==============================================================================| :  |
 |  : | [T*][W ][  ][  ][  ]                                                         | :  |  queue y236-286
 |  : | +--------------------------------------------------------------------------+ | :  |  dock y290
 |  : | |(o)1234|[Thd][Whr][Bld][Skt]|[ + ][Sli][ + ]|XP ###--|  ( * )             | | :  |
 |  : | |+2/s   |[o15][o25][o45][o20]|[   ][+25][   ]|[EVOLVE]|  ( 8s)            | | :  |
 |  : | +--------------------------------------------------------------------------+ | :  |  y369
 |    |                      (home indicator: 21 px)                                 |    |
 +----+------------------------------------------------------------------------------+----+
      gold 55-139  units 147-415 (4×64)  turrets 425-601  evolve 611-703  special 713-791
```

---

## 4. Element specs

### 4.1 Base HP bars (top panels)
- Track `#2b1d13`, 2 px ink border, radius h/2. Fill: horizontal gradient `--pL`→`--p` (enemy: `--eL`→`--e`) with a 30% white top highlight strip (h/3).
- **Ghost bar:** a cream `#fff3dc` @70% bar behind the fill that shrinks to the real value after a 350 ms delay over 400 ms (shows chunk damage).
- **Notches** at 66% and 33% (2 px ink ticks), which match the base damage states in art-direction §0.5.
- Critical (<33%): the fill pulses brightness 1→1.25 at 1.5 Hz, the crest wobbles ±3° on each hit, and the player panel border flashes `#ff9b85` for 120 ms on every hit.
- The number uses the existing `Math.ceil(hp)` value, 900 weight, tabular nums.

### 4.2 Unit cards
Content order: hotkey chip · portrait · name · cost. Stats (HP/DMG) move to the long-press tooltip (v0.1 printed them at 10 px, too small).
The 4th card is the specialist (Skitterling / Hearthkeeper / Pennant Runner / Tinker Wisp / Pulse Warden). A future-age card shows as locked.
When the queue is full, the "FULL" strip shows. When a unit is training, the card's top border shows a thin progress line (only on the card whose unit is at the front of the queue).

### 4.3 Training queue
- 5 slots (`DATA.economy.queueMax`). The front slot has a conic progress ring (`conic-gradient(#ffd27a calc(var(--p)*1turn), transparent 0)`, masked to 4 px) plus the existing bottom bar.
- Empty slots: `rgba(42,26,16,.45)` recess with a faint dashed inner outline. Tap on a filled slot = cancel + refund (existing `simCancel`), and a "+15" gold text pops from the slot.

### 4.4 Gold
- Nugget icon (existing `drawIcon("gold")`). When gold increases by ≥ 5 at once (a kill), the icon squashes 1.25×0.8 → 1 over 180 ms, and a small `+N` rises from the value.
- The value counts up (lerp the displayed value toward the real value at 12/s minimum, snap when it's within 1).

### 4.5 Evolve block
- XP bar: track `#2b1d13`, fill `linear-gradient(90deg,#ffd27a,#ff8a2a)` (as now). When full, a diagonal shimmer sweep `rgba(255,255,255,.5)` crosses every 1.5 s.
- Button states: **not enough XP** = stone slab, shows "NEXT: KILN AGE" + the required XP. **Ready** = ember gradient `#ffb45a→#d9531f` + `.ready` glow + rising ember sparks (3 CSS dots). **Evolving** = disabled, and a 2.4 s fill wipe matches the art-direction §6 sequence. **Final age** = hidden, and the block shows "MAX AGE".

### 4.6 Special button (circular)
- A 100 px circle (78 on phone): basalt center, 8 px ring track `#3b2819`, progress ring `--age-accent` drawn with `conic-gradient` masked to a ring (or a small canvas).
- Cooldown: dark wedge + remaining seconds (22 px / 17 px). **Ready:** the ring turns `#ffd27a`, `.ready` glow, and the icon bobs ±2 px.
- **Tap = fire.** None of the 5 specials in `specials.json` needs manual aim: Rockslide and Kiln Burst cover x 250-1050, Steam Vent goes to `enemyFront`, and Static Surge picks targets itself. Muster Horn is a buff.
  To prevent accidental use on phone, the first tap shows a **1 s "armed" state** (the ring turns white and the icon grows 10%) and a second tap fires. Desktop Space fires right away.
  While the telegraph plays, the button shows a filling inner disc. For buffs (Muster Horn, 8 s), a thin inner ring counts the buff down.
- Cooldowns come from `specials.json` (50-52 s range). Show whole seconds above 10 and one decimal below.

### 4.7 Pause
- 56×56 slab (the existing icon). Pressing it opens the existing pause screen. The keys P/Esc stay the same.

---

## 5. Hotkeys (desktop)
| Key | Action |
|-----|--------|
| 1 2 3 4 | buy unit cards 1-4 |
| Q W E | turret sockets 1-3 (empty → picker, then 1/2/3 chooses; built → arm sell, press again to confirm) |
| V | evolve |
| Space | special (fire at the default target) |
| P / Esc | pause (Esc closes the picker/aim first) |

Note: v0.1 uses key **3 = turret**. In this plan 3 becomes the heavy unit card, so update the menu help text (`"PC: keys 1 / 2 / 3, P to pause"`).

---

## 6. Implementation notes
- Build the dock with one `.plate` and absolutely positioned children. Switch the layout with `#hud.L-desk` / `#hud.L-phone` in `resize()`
  (phone = `CH <= 430 && CW > CH`). Portrait keeps v0.1's stacked flow (out of scope).
- For widths between 844 and 1280, anchor the groups: HP panels to the left/right edges, the timer to center, the dock's left groups (gold, cards) to the left and the right groups (evolve, special) to the right. The turret sockets center in the remaining gap.
- Canvas icons inside buttons: keep `drawIcon()`, but give it per-age portraits. Re-paint on age-up (cards flip with `rotateX` 0→90°→0 while the canvas is swapped at 90°).
- `resize()` currently measures `$("bottombar").offsetHeight`. With fixed layouts, use the constants above (`groundMaxY`), which avoids the lane jumping when the card height changes.
