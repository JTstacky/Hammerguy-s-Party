"""exp2_up.py [logdir] : the second experiment set ("-cl exp two"): dodge, chase2, orphan.
dodge  : an archer (earc) shoots a mortal paladin that runs across the line of fire and reverses `delay` s after
         each attack starts. Does reversing ever make an arrow miss?
chase2 : an abomination (melee) chases a mortal paladin at equal speed: straight flight, stop, then circling.
orphan : the shooter is killed `delay` s after its attack starts. Does the missile already in flight still hurt?"""
import math, sys
from clog_up import read, rawcode

d = sys.argv[1] if len(sys.argv) > 1 else r"path\to\scratch\live\logs_up_run4_exp"
R = read(d)
R.sort(key=lambda r: r[1] or 0)


def trials(kind):
    out, cur = [], None
    for r in R:
        if r[0] == "X" and r[3][0] == kind:
            if r[3][1] in ("start", "flee"):
                cur = {"t0": r[1], "args": r[3][2:], "flips": [], "phases": [(r[3][1], r[1])]}
            elif r[3][1] == "flip" and cur:
                cur["flips"].append((r[1], int(r[3][2])))
            elif r[3][1] in ("stop", "circle") and cur:
                cur["phases"].append((r[3][1], r[1]))
            elif r[3][1] == "kill" and cur:
                cur["kill"] = r[1]
            elif r[3][1] == "end" and cur:
                cur["t1"], cur["hp"] = r[1], float(r[3][2])
                out.append(cur)
                cur = None
    return out


def events(tag, t0, t1, a=None, v=None):
    """A: fields (attacker, victim, ax, ay, vx, vy, facing); D: (victim, source, dmg, vx, vy, sx, sy, life)"""
    res = []
    for r in R:
        if r[0] == tag and t0 <= r[1] <= t1:
            f = r[3]
            if tag == "A" and (a is None or f[0] == a) and (v is None or f[1] == v):
                res.append((r[1], f))
            if tag == "D" and (v is None or f[0] == v) and (a is None or f[1] == a):
                res.append((r[1], f))
    return res


print("== dodge: archer vs a paladin that reverses `delay` s after each attack starts ==")
print("target mode     delay  range  attacks  hits  hit times after attack start (s)   end HP")
for tr in trials("dodge"):
    delay, rng, s, v = tr["args"][:4]
    atk = events("A", tr["t0"], tr["t1"], s, v)
    dmg = events("D", tr["t0"], tr["t1"], s, v)
    vt = rawcode(tr["args"][4]) if len(tr["args"]) > 4 else "Hart"
    mode = ("reverse", "stop")[int(tr["args"][5])] if len(tr["args"]) > 5 else "reverse"
    lags = []
    for td, f in dmg:
        prev = [ta for ta, _ in atk if ta <= td]
        lags.append(round(td - prev[-1], 2) if prev else None)
    print(f"{vt:<6} {mode:<8} {delay:>5}  {rng:>5}  {len(atk):>7}  {len(dmg):>4}  {str(lags):<34} {tr['hp']}")
    tr["atk"], tr["dmg"] = atk, dmg

print("\n== orphan: shooter killed `delay` s after its attack starts ==")
print("type  delay  attack->kill  damage events (t after attack, dmg)   end HP")
for tr in trials("orphan"):
    typ, delay, s, v = tr["args"][:4]
    atk = events("A", tr["t0"], tr["t1"], s, v)
    dmg = events("D", tr["t0"], tr["t1"], None, v)
    ta = atk[0][0] if atk else None
    k = round(tr["kill"] - ta, 2) if ta is not None and "kill" in tr else None
    dd = [(round(td - ta, 2) if ta else None, float(f[2])) for td, f in dmg]
    print(f"{rawcode(typ)}  {delay:>5}  {str(k):>12}  {str(dd):<38} {tr['hp']}")

print("\n== chase2: abomination vs a mortal paladin ==")
for tr in trials("chase2"):
    a, v = tr["args"][:2]
    ph = tr["phases"] + [("end", tr["t1"])]
    atk = events("A", tr["t0"], tr["t1"], a, v)
    dmg = events("D", tr["t0"], tr["t1"], a, v)
    for (name, p0), (_, p1) in zip(ph, ph[1:]):
        na = [t for t, _ in atk if p0 <= t < p1]
        nd = [t for t, _ in dmg if p0 <= t < p1 + 0.6]
        dist = [round(math.hypot(float(f[2]) - float(f[4]), float(f[3]) - float(f[5]))) for t, f in atk if p0 <= t < p1]
        print(f"{name:<7} {p1 - p0:5.1f} s: attacks {len(na)}, hits {len([t for t in nd if t < p1 + 0.6])}, "
              f"centre distance at attack start {dist}")
    print("attack times:", [round(t - tr["t0"], 2) for t, _ in atk])
    print("hit times:   ", [round(t - tr["t0"], 2) for t, _ in dmg], "end HP", tr["hp"])
