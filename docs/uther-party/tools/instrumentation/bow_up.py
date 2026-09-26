"""bow_up.py logdir [logdir...] : every Way of the Bow (#6) attack in the tour logs, hit or miss, with the target's
last new order relative to the attack start. Tests the dodge rule from the lab (reversing 0.6-1.0 s into the
draw made every arrow miss) against real play by computer archers."""
import math, sys
from clog_up import read, games

for d in sys.argv[1:]:
    R = read(d)
    for gf, t0, recs in games(R):
        if int(gf[1]) != 6:
            continue
        t_end = max(r[1] for r in recs if r[1])
        print(f"\n== {d.split('/')[-1]}  Way of the Bow started {t0:.1f}")
        atk = [(r[1], r[3]) for r in recs if r[0] == "A"]
        dmg = [(r[1], r[3]) for r in recs if r[0] == "D"]
        dead = {r[3][0]: r[1] for r in recs if r[0] == "K"}
        orders = [(r[1], r[3][0], r[3][1]) for r in recs if r[0] in ("OP", "OT", "OI")]
        for ta, f in atk:
            if ta - t0 > 20:
                break
            a, v = f[0], f[1]
            nxt = [t for t, g in atk if g[0] == a and t > ta]
            window = min([ta + 3.0] + nxt[:1])
            hit = [td for td, g in dmg if g[0] == v and g[1] == a and ta < td <= window + 1.5]
            vo = [round(t - ta, 2) for t, u, o in orders if u == v and ta - 0.5 <= t <= ta + 1.6 and o not in ("851972", "851974")]
            ao = [(round(t - ta, 2), o[-3:]) for t, u, o in orders if u == a and ta - 0.1 <= t <= ta + 0.9 and o not in ("851972", "851974")]
            dist = math.hypot(float(f[2]) - float(f[4]), float(f[3]) - float(f[5]))
            fate = f"hit +{hit[0] - ta:.2f}" if hit else "miss"
            notes = []
            if a in dead and dead[a] < ta + 0.72:
                notes.append(f"archer died +{dead[a] - ta:.2f}")
            if v in dead and dead[v] <= ta + 1.6 and not hit:
                notes.append(f"target died +{dead[v] - ta:.2f}")
            if ta + 1.6 > t_end:
                notes.append("game ended")
            print(f"  +{ta - t0:6.2f}  {a}->{v}  {dist:4.0f} u  {fate:<9} target orders at {vo}  archer orders {ao}  {' '.join(notes)}")
