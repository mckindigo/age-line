#!/usr/bin/env python3
"""Generates units/turrets/ages/specials/perks JSON for AGE LINE from compact tables.
Numbers are hand-picked per age (not formula-generated) so each can be tuned individually.
Run: python3 design/tools/build_design.py  (then design/tools/validate.py)"""
import json, os
OUT = os.path.join(os.path.dirname(__file__), "..")

AGES = ["stone", "kiln", "banner", "gear", "spark"]
AGE_META = {
 "stone":  dict(name="Stone Age",  xpToNext=1000,  baseMaxHp=1000, goldPerSec=2.0,  palette="pal_ember_dusk",
                nextAgeNote="Fire the clay. Enter the Kiln Age."),
 "kiln":   dict(name="Kiln Age",   xpToNext=3500,  baseMaxHp=1400, goldPerSec=3.0,  palette="pal_kiln_glow",
                nextAgeNote="Raise the colors. Enter the Banner Age."),
 "banner": dict(name="Banner Age", xpToNext=9000,  baseMaxHp=1900, goldPerSec=4.5,  palette="pal_banner_field",
                nextAgeNote="Wind the springs. Enter the Gear Age."),
 "gear":   dict(name="Gear Age",   xpToNext=20000, baseMaxHp=2500, goldPerSec=6.75, palette="pal_gear_smog",
                nextAgeNote="Catch the lightning. Enter the Spark Age."),
 "spark":  dict(name="Spark Age",  xpToNext=None,  baseMaxHp=3200, goldPerSec=10.0, palette="pal_spark_night",
                nextAgeNote=None),
}

# id, name, role, subrole, formation, cost, hp, dmg, atkInterval, range, speed, spawnTime, bountyGold, bountyXp, radius, height, projectile, ability, blurb
U = [
 # ---- STONE (Thudder & Whirler are the exact v0.1 values) ----
 ("stone_clubber","Thudder","melee",None,"front",15,55,16,1.0,20,40,1.0,9,15,14,44,None,None,
  "Round, stubborn, carries a club bigger than its opinions. Holds the front."),
 ("stone_slinger","Whirler","ranged",None,"back",25,40,10,1.2,140,38,1.5,15,25,11,68,{"kind":"rock","speed":300},None,
  "Lanky and quick-wristed. Hangs back behind Thudders and pelts rocks."),
 ("stone_boulderback","Boulderback","heavy",None,"front",45,210,24,1.7,22,28,2.5,27,45,20,58,None,None,
  "A walking landslide with a flat rock strapped to each fist. Slow, but it does not stop."),
 ("stone_skitter","Skitterling","specialist","skirmisher","front",20,32,7,0.55,18,78,0.8,12,20,9,34,None,None,
  "Tiny, twitchy, and all elbows. Darts ahead to nip at slingers before the line arrives."),
 # ---- KILN ----
 ("kiln_clanger","Clanger","melee",None,"front",22,100,23,0.95,22,40,1.1,13,26,14,46,None,None,
  "Swings a fire-hardened clay maul that rings like a pot every time it lands."),
 ("kiln_pelter","Shardpelter","ranged",None,"back",38,70,15,1.2,150,38,1.6,23,42,11,70,{"kind":"clayshot","speed":320},None,
  "Lobs glowing kiln shards from a leather cup-sling. Stays back where it is warm."),
 ("kiln_anvilhorn","Anvilhorn","heavy",None,"front",68,380,33,1.6,24,28,2.6,41,78,21,62,None,None,
  "Wears a baked-clay helm with an anvil for a brow. Headbutts first, thinks never."),
 ("kiln_hearth","Hearthkeeper","specialist","support","back",32,130,9,1.0,110,36,1.4,19,36,11,56,{"kind":"ember","speed":260},
  {"type":"healAura","radius":90,"hps":3.0,"affects":"allies"},
  "Carries a coal pot on a pole. Allies nearby warm up and knit their scrapes."),
 # ---- BANNER ----
 ("banner_hedgeman","Brambleguard","melee",None,"front",34,180,32,0.9,24,42,1.2,20,44,15,50,None,None,
  "Hides behind a thorn-wrapped round shield and pokes with a hooked spear."),
 ("banner_quill","Quillwright","ranged",None,"back",56,125,21,1.15,165,38,1.7,34,70,11,70,{"kind":"bolt","speed":380},None,
  "Cranks a squat wooden bolt-bow. Every bolt is fletched in the tribe's colors."),
 ("banner_wallwalker","Wallwalker","heavy",None,"front",100,690,46,1.5,26,26,2.8,60,130,23,70,None,None,
  "A stack of shields on legs, with one very tired person somewhere inside."),
 ("banner_runner","Pennant Runner","specialist","skirmisher","front",45,100,18,0.6,22,82,1.0,27,58,10,54,None,
  {"type":"hasteAura","radius":100,"speedMult":1.2,"affects":"allies"},
  "Sprints ahead waving a long pennant. Everyone near the flag walks a little faster."),
 # ---- GEAR ----
 ("gear_cogbiter","Cogbiter","melee",None,"front",51,320,45,0.85,24,44,1.3,31,74,15,52,None,None,
  "Has a spinning toothed wheel where a hand should be. Very enthusiastic about it."),
 ("gear_pipesnap","Pipesnap","ranged",None,"back",84,225,30,1.1,175,38,1.8,50,118,11,72,{"kind":"pellet","speed":460},None,
  "Snaps a brass air-pipe rifle and fires hot rivets from a comfortable distance."),
 ("gear_boilerhulk","Boilerhulk","heavy",None,"front",150,1250,66,1.45,28,24,3.0,90,210,25,78,None,None,
  "A walking boiler that vents steam through its knees. Punches with pressure valves."),
 ("gear_wisp","Tinker Wisp","specialist","support","back",68,370,20,0.9,120,40,1.6,41,98,10,60,{"kind":"pellet","speed":420},
  {"type":"shieldPulse","radius":80,"shield":70,"every":6.0,"affects":"allies"},
  "A clockwork kite with a tinkerer dangling below. Clips brass plates onto friends."),
 # ---- SPARK ----
 ("spark_arcblade","Arcfencer","melee",None,"front",76,580,64,0.8,26,46,1.4,46,120,15,54,None,None,
  "Duels with a humming wire-whip that crackles blue whenever it connects."),
 ("spark_lancer","Glintcaster","ranged",None,"back",126,405,43,1.05,185,38,1.9,76,195,11,74,{"kind":"spark","speed":560},None,
  "Focuses sunlight through a crystal staff and snaps it out in bright white darts."),
 ("spark_cradle","Stormcradle","heavy",None,"front",225,2250,95,1.4,30,24,3.2,135,345,26,84,None,None,
  "A copper cage on stomping legs with a trapped thundercloud inside. Grumbles loudly."),
 ("spark_warden","Pulse Warden","specialist","support","back",102,630,30,0.85,125,40,1.8,61,160,11,64,{"kind":"spark","speed":520},
  {"type":"damageReductionAura","radius":95,"mult":0.8,"affects":"allies"},
  "Hums a steady tone through a tuning-fork mast. Hits on nearby allies land softer."),
]
FIELDS = ["id","name","role","subrole","formation","cost","hp","dmg","atkInterval","range","speed","spawnTime","bg","bx","radius","height","projectile","ability","blurb"]
units = {}
for row in U:
    d = dict(zip(FIELDS, row)); age = d["id"].split("_")[0]
    u = {"id": d["id"], "name": d["name"], "age": age, "role": d["role"], "subrole": d["subrole"], "formation": d["formation"],
         "cost": d["cost"], "hp": d["hp"], "dmg": d["dmg"], "atkInterval": d["atkInterval"], "range": d["range"], "speed": d["speed"],
         "spawnTime": d["spawnTime"], "bounty": {"gold": d["bg"], "xp": d["bx"]}, "radius": d["radius"], "height": d["height"],
         "projectile": d["projectile"], "ability": d["ability"], "blurb": d["blurb"]}
    units[u["id"]] = u

# id, name, cost, dmg, atkInterval, range, projectile, effect, blurb
T = [
 ("stone_rock_sling","Sling Post",100,12,1.2,260,{"kind":"rock","speed":400},None,
  "Lashed-timber throwing arm on your cairn. Hurls rocks at anything that comes close."),
 ("stone_pitch_pot","Pitch Pot",160,14,2.0,200,{"kind":"pitch","speed":260},{"splash":{"radius":45,"falloff":0.5}},
  "A tripod with a bubbling pot of pine pitch. Tips sticky globs onto crowds."),
 ("stone_bone_rack","Bone Bolt Rack",140,30,2.4,340,{"kind":"bone","speed":520},None,
  "A bent-sapling spring that flings sharpened bones far down the lane. Slow to reload."),
 ("kiln_dart_frame","Bronze Dart Frame",180,18,0.8,270,{"kind":"dart","speed":480},None,
  "A clay-and-bronze frame that clacks out darts one after another."),
 ("kiln_mortar","Clay Mortar",260,34,2.2,230,{"kind":"clayshot","speed":260},{"splash":{"radius":55,"falloff":0.5}},
  "A squat kiln-fired tube that coughs burning shards into the thick of the fight."),
 ("kiln_brick_oven","Firebrick Oven",220,13,1.0,150,{"kind":"ember","speed":300},{"burn":{"dps":8,"duration":3.0}},
  "Short-range oven mouth that spits embers. Whatever it hits keeps smoldering."),
 ("banner_spire_bow","Spire Bow",320,58,1.1,300,{"kind":"bolt","speed":560},None,
  "A great bolt-bow mounted high on a banner pole. Patient and accurate."),
 ("banner_cauldron","Oil Cauldron",420,70,2.4,210,{"kind":"oil","speed":240},{"splash":{"radius":60,"falloff":0.5}},
  "A hanging iron pot on a swing-arm. Pours scalding oil over the front rank."),
 ("banner_bell","Warning Bell",360,35,1.2,240,{"kind":"ring","speed":400},{"slow":{"mult":0.7,"duration":2.0}},
  "Each clang sends a shock ring down the lane that leaves attackers staggering."),
 ("gear_rivet_gun","Rivet Gun",560,52,0.5,300,{"kind":"pellet","speed":620},None,
  "A crank-fed rivet spitter. Loud, rattly, and very hard to walk into."),
 ("gear_steam_mortar","Steam Mortar",720,150,2.4,250,{"kind":"boiler","speed":280},{"splash":{"radius":70,"falloff":0.5}},
  "Launches tiny overheated boilers that burst in scalding clouds."),
 ("gear_magnet_coil","Magnet Coil",620,84,1.3,260,{"kind":"coil","speed":500},{"slow":{"mult":0.65,"duration":2.2}},
  "A humming copper coil that yanks at buckles and gears. Attackers slog through it."),
 ("spark_arc_pylon","Arc Pylon",960,104,0.9,280,{"kind":"spark","speed":800},{"chain":{"jumps":2,"range":70,"falloff":0.6}},
  "A lightning rod that jumps from one attacker to the next."),
 ("spark_prism","Prism Lens",1100,330,2.2,380,{"kind":"beam","speed":1400},None,
  "A tilting crystal that focuses the dusk sun into one searing, long-range beam."),
 ("spark_gravity_drum","Hush Drum",1040,120,1.4,260,{"kind":"pulse","speed":600},{"slow":{"mult":0.6,"duration":2.4},"splash":{"radius":50,"falloff":0.6}},
  "A huge taut drum whose low beat makes the air heavy. Attackers wade through it."),
]
turrets = {}
for (tid,name,cost,dmg,ai,rng,proj,eff,blurb) in T:
    t = {"id":tid,"name":name,"age":tid.split("_")[0],"cost":cost,"dmg":dmg,"atkInterval":ai,"range":rng,"projectile":proj,
         "refundRate":0.25,"effect":eff,"blurb":blurb}
    turrets[tid] = t

S = [
 dict(id="stone_rockslide", name="Rockslide", age="stone", cooldown=50, target="enemyUnits", hitsBases=False, kind="laneRain",
      params={"projectiles":10,"damagePerHit":35,"radius":40,"duration":2.5,"zone":{"fromX":250,"toX":1050}},
      blurb="The mesa shrugs. Boulders tumble down across the lane and flatten rival warriors."),
 dict(id="kiln_ember_burst", name="Kiln Burst", age="kiln", cooldown=52, target="enemyUnits", hitsBases=False, kind="laneRain",
      params={"projectiles":12,"damagePerHit":55,"radius":45,"duration":2.5,"zone":{"fromX":250,"toX":1050},"burn":{"dps":6,"duration":3}},
      blurb="Every kiln door swings open at once. Clouds of glowing shards drift down on the rivals."),
 dict(id="banner_charge_horn", name="Muster Horn", age="banner", cooldown=55, target="alliedUnits+enemyUnits", hitsBases=False, kind="buffAndShove",
      params={"allyDmgMult":1.3,"allySpeedMult":1.25,"duration":8,"enemyKnockback":60,"enemyDamage":40},
      blurb="One long blast rolls down the lane. Your side surges forward, and the rival front line is shoved back."),
 dict(id="gear_steam_vent", name="Steam Vent", age="gear", cooldown=55, target="enemyUnits", hitsBases=False, kind="groundZone",
      params={"width":260,"placeAt":"enemyFront","dps":55,"slowMult":0.6,"duration":6},
      blurb="Pipes burst under the rivals' feet. A scalding cloud slows and cooks anything standing in it."),
 dict(id="spark_static_surge", name="Static Surge", age="spark", cooldown=60, target="enemyUnits", hitsBases=False, kind="chainStrike",
      params={"strikes":3,"initialDamage":320,"jumps":6,"jumpRange":110,"jumpFalloff":0.8,"stunDuration":1.0,"interval":0.6},
      blurb="The sky crackles. Bolts snap from rival to rival and leave them twitching."),
]
specials = {s["id"]: s for s in S}

ages = []
for i, a in enumerate(AGES):
    m = AGE_META[a]
    ages.append({"id": a, "name": m["name"], "order": i, "xpToNext": m["xpToNext"], "nextAgeNote": m["nextAgeNote"],
                 "baseMaxHp": m["baseMaxHp"], "goldPerSec": m["goldPerSec"], "palette": m["palette"],
                 "units": [u for u in units if units[u]["age"] == a],
                 "turrets": [t for t in turrets if turrets[t]["age"] == a],
                 "special": next(s for s in specials if specials[s]["age"] == a)})

P = [
 ("perk_thick_hides","Thick Hides","Melee units get +15% max HP.","role:melee","hp",{"mult":1.15},3),
 ("perk_heavy_swing","Heavy Swing","Melee units deal +12% damage.","role:melee","dmg",{"mult":1.12},3),
 ("perk_steady_hands","Steady Hands","Ranged units attack 10% faster.","role:ranged","attackInterval",{"mult":0.9},2),
 ("perk_long_eye","Long Eye","Ranged units get +20 range.","role:ranged","range",{"add":20},2),
 ("perk_bedrock","Bedrock Bones","Heavy units get +18% max HP.","role:heavy","hp",{"mult":1.18},2),
 ("perk_cheap_bulk","Bulk Discount","Heavy units cost 12% less.","role:heavy","cost",{"mult":0.88},2),
 ("perk_quickfeet","Quick Feet","Specialists move 20% faster.","role:specialist","moveSpeed",{"mult":1.2},2),
 ("perk_sharp_tricks","Sharp Tricks","Specialists deal +20% damage.","role:specialist","dmg",{"mult":1.2},2),
 ("perk_oiled_arms","Oiled Arms","Turrets fire 12% faster.","turrets","attackInterval",{"mult":0.88},2),
 ("perk_high_perch","High Perch","Turrets get +30 range.","turrets","range",{"add":30},2),
 ("perk_tithe","Tribute Tithe","Gold income +12%.","economy","goldPerSec",{"mult":1.12},2),
 ("perk_scavengers","Scavengers","Kills pay +20% gold.","economy","bounty",{"mult":1.2},2),
 ("perk_old_songs","Old Songs","Special ability cooldown -15%.","special","cooldown",{"mult":0.85},2),
 ("perk_loud_sky","Loud Sky","Special ability deals +20% damage.","special","dmg",{"mult":1.2},2),
 ("perk_deep_roots","Deep Roots","Your base gets +12% max HP.","base","maxHp",{"mult":1.12},2),
 ("perk_mortar_mix","Mortar Mix","Your base gets +150 max HP.","base","maxHp",{"add":150},2),
]
perks = [{"id":i,"name":n,"desc":d,"effect":dict(target=t,stat=s,**v),"maxStacks":m} for (i,n,d,t,s,v,m) in P]

def dump(name, obj):
    with open(os.path.join(OUT, name), "w") as f: json.dump(obj, f, indent=2, ensure_ascii=False); f.write("\n")
dump("units.json", {"schemaVersion": 2, "units": units})
dump("turrets.json", {"schemaVersion": 2, "turrets": turrets})
dump("ages.json", {"schemaVersion": 2, "ages": ages})
dump("specials.json", {"schemaVersion": 2, "specials": specials})
dump("perks.json", {"schemaVersion": 2, "perks": perks})
print("wrote 5 files")
