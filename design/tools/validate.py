#!/usr/bin/env python3
"""Validates design/*.json: parse, cross-refs, required constraints, and per-gold power ratios.
Prints a markdown table (also pasted into balance-notes.md). Exit 1 on any failure."""
import json, os, subprocess, sys
D = os.path.join(os.path.dirname(__file__), ".."); ROOT = os.path.join(D, "..")
fails = []
def check(ok, msg):
    if not ok: fails.append(msg)
def load(n): return json.load(open(os.path.join(D, n)))
units = load("units.json")["units"]; turrets = load("turrets.json")["turrets"]
ages = load("ages.json")["ages"]; specials = load("specials.json")["specials"]; perks = load("perks.json")["perks"]
AGE_IDS = [a["id"] for a in ages]
# ---- counts & cross refs ----
check(len(ages) == 5, "5 ages"); check(len(units) == 20, "20 units"); check(len(turrets) == 15, "15 turrets"); check(len(specials) == 5, "5 specials")
check([a["xpToNext"] for a in ages] == [1000, 3500, 9000, 20000, None], "xpToNext")
check([a["baseMaxHp"] for a in ages] == [1000, 1400, 1900, 2500, 3200], "baseMaxHp")
gps = [a["goldPerSec"] for a in ages]; check(gps[0] == 2 and all(b > a for a, b in zip(gps, gps[1:])), "goldPerSec rising from 2")
names = set()
for a in ages:
    check(len(a["units"]) == 4 and len(a["turrets"]) == 3, f"{a['id']} counts")
    check(sorted(units[u]["role"] for u in a["units"]) == ["heavy", "melee", "ranged", "specialist"], f"{a['id']} roles")
    for u in a["units"]: check(u in units and units[u]["age"] == a["id"], f"unit ref {u}")
    for t in a["turrets"]: check(t in turrets and turrets[t]["age"] == a["id"], f"turret ref {t}")
    check(a["special"] in specials and specials[a["special"]]["age"] == a["id"], f"special ref {a['special']}")
    check(bool(a.get("palette")), f"palette {a['id']}")
for coll in (units, turrets, specials):
    for k, v in coll.items():
        check(k == v["id"], f"id key {k}"); check(v["age"] in AGE_IDS, f"age of {k}")
        check(v["name"] not in names, f"dup name {v['name']}"); names.add(v["name"])
for s in specials.values():
    check(45 <= s["cooldown"] <= 60, f"cooldown {s['id']}"); check(s["hitsBases"] is False and "base" not in s["target"].lower(), f"base dmg {s['id']}")
# ---- v0.1 exact match against index.html DATA ----
js = r"""const fs=require('fs'),vm=require('vm');const h=fs.readFileSync(process.argv[1],'utf8');
const src=h.match(/<script id="game">([\s\S]*?)<\/script>/)[1];const c={console,Math,Map,JSON};c.globalThis=c;vm.createContext(c);vm.runInContext(src,c);
console.log(JSON.stringify(c.AGELINE.DATA));"""
cur = json.loads(subprocess.check_output(["node", "-e", js, os.path.join(ROOT, "index.html")]))
for uid in ("stone_clubber", "stone_slinger"):
    for k, v in cur["units"][uid].items(): check(units[uid].get(k) == v, f"{uid}.{k} differs from index.html")
for k, v in cur["turrets"]["stone_rock_sling"].items(): check(turrets["stone_rock_sling"].get(k) == v, f"rock_sling.{k} differs")
check(ages[0]["goldPerSec"] == cur["economy"]["goldPerSec"], "stone gold matches code")
check(ages[0]["baseMaxHp"] == cur["bases"]["hp"], "stone base hp matches code")
# ---- perks ----
TGT = {"role:melee","role:ranged","role:heavy","role:specialist","turrets","economy","special","base"}
STAT = {"hp","dmg","attackInterval","range","moveSpeed","goldPerSec","bounty","cooldown","maxHp","cost"}
pids = set()
for p in perks:
    e = p["effect"]; check(p["id"] not in pids, f"dup perk {p['id']}"); pids.add(p["id"])
    check(e["target"] in TGT and e["stat"] in STAT, f"perk enum {p['id']}"); check(("mult" in e) != ("add" in e), f"perk mult xor add {p['id']}")
    check(isinstance(p["maxStacks"], int) and 1 <= p["maxStacks"] <= 3, f"maxStacks {p['id']}")
check({p["effect"]["target"] for p in perks} == TGT, "perks cover all targets"); check(14 <= len(perks) <= 18, "~16 perks")
# ---- power metric ----
def upow(u):  # per-gold power: dps * hp / cost
    return (u["dmg"] / u["atkInterval"]) * u["hp"] / u["cost"]
def tpow(t):  # turret dps per gold, adjusted for effects
    dps = t["dmg"] / t["atkInterval"]; e = t.get("effect") or {}; f = 1.0
    if "splash" in e: f *= 1.6
    if "slow" in e: f *= 1.25
    if "chain" in e: c = e["chain"]; f *= sum(c["falloff"] ** i for i in range(c["jumps"] + 1))
    if "burn" in e: dps += e["burn"]["dps"] * min(1.0, e["burn"]["duration"] / t["atkInterval"])
    return dps * f / t["cost"]
ROLES = ["melee", "ranged", "heavy", "specialist"]
byrole = {a["id"]: {units[u]["role"]: units[u] for u in a["units"]} for a in ages}
lines = ["| Age | " + " | ".join(f"{r} P (ratio)" for r in ROLES) + " | age avg ratio | turret avg dps/g (ratio) |", "|---" * 7 + "|"]
prev = None; prevT = None
for a in ages:
    cells, rs = [], []
    for r in ROLES:
        p = upow(byrole[a["id"]][r])
        if prev: rr = p / prev[r]; rs.append(rr); check(1.6 <= rr <= 2.0, f"{a['id']} {r} ratio {rr:.2f}"); cells.append(f"{p:.1f} ({rr:.2f}x)")
        else: cells.append(f"{p:.1f} (—)")
    tp = sum(tpow(turrets[t]) for t in a["turrets"]) / 3
    tr = f"{tp:.3f} ({tp/prevT:.2f}x)" if prevT else f"{tp:.3f} (—)"
    if prevT: check(1.15 <= tp / prevT <= 1.5, f"{a['id']} turret ratio {tp/prevT:.2f}")
    avg = f"{sum(rs)/len(rs):.2f}x" if rs else "—"
    lines.append(f"| {a['name']} | " + " | ".join(cells) + f" | {avg} | {tr} |")
    prev = {r: upow(byrole[a["id"]][r]) for r in ROLES}; prevT = tp
print("\n".join(lines))
# cost & gold scaling sanity: units per minute of income for the melee unit
print("\n| Age | goldPerSec | melee cost | melee/min of income | base HP / melee dps (s) |\n|---|---|---|---|---|")
for a in ages:
    m = byrole[a["id"]]["melee"]; print(f"| {a['name']} | {a['goldPerSec']} | {m['cost']} | {a['goldPerSec']*60/m['cost']:.1f} | {a['baseMaxHp']/(m['dmg']/m['atkInterval']):.0f} |")
print("\n| Turret | age | cost | adj dps/gold |\n|---|---|---|---|")
for t in turrets.values(): print(f"| {t['name']} | {t['age']} | {t['cost']} | {tpow(t):.3f} |")
if fails: print("\nFAILURES:\n" + "\n".join(fails)); sys.exit(1)
print("\nALL CHECKS PASS")
