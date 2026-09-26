"""exp_up.py [logdir] : analyse the lab experiments (-cl exp all) from the CL logs."""
import math, sys
from clog_up import read, Units, track, LOGS

d = sys.argv[1] if len(sys.argv) > 1 else LOGS
R = read(d)
U = Units(R)
X = [(i, r) for i, r in enumerate(R) if r[0] == "X"]


def after(i0, pred, t_max=None):
    for tag, t, uid, f in R[i0 + 1:]:
        if t_max is not None and t is not None and t > t_max:
            return None
        if pred(tag, t, uid, f):
            return (tag, t, uid, f)
    return None


def between(i0, t1, pred):
    out = []
    for tag, t, uid, f in R[i0 + 1:]:
        if t is not None and t > t1:
            break
        if pred(tag, t, uid, f):
            out.append((tag, t, uid, f))
    return out


def nxt_t(k):
    return X[k + 1][1][1] if k + 1 < len(X) else 1e9


print("== artillery: catapult (ncat) attacking a held peon at distance d")
rows = []
for k, (i, (tag, t, _, f)) in enumerate(X):
    if f[:2] == ["art", "flight"]:
        dist, cid, vid = float(f[2]), f[3], f[4]
        A = between(i, nxt_t(k), lambda tg, tt, u, ff: tg == "A" and ff[0] == cid and ff[1] == vid)
        D = between(i, nxt_t(k), lambda tg, tt, u, ff: tg == "D" and ff[0] == vid and ff[1] == cid)
        O = after(i, lambda tg, tt, u, ff: tg == "OT" and ff[0] == cid, nxt_t(k))
        if A and D:
            rows.append((dist, A[0][1] - O[1] if O else None, D[0][1] - A[0][1], float(D[0][3][2]), [round(a[1] - A[0][1], 3) for a in A]))
for dist, acq, fl, dmg, atimes in rows:
    print(f"  d={dist:6.0f}  order->attack-start {acq if acq is None else round(acq,3)}  attack-start->damage {fl:.3f} s  dmg {dmg:.1f}  attack starts at +{atimes}")
if len(rows) >= 2:
    xs = [r[0] for r in rows]; ys = [r[2] for r in rows]
    n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    a = my - b * mx
    print(f"  fit: damage delay = {a:.3f} + d / {1 / b:.1f}   (projectile speed estimate {1 / b:.1f} u/s; intercept = damage point + launch offset)")

print("== artillery: splash rings (attackground at the ring centre)")
for k, (i, (tag, t, _, f)) in enumerate(X):
    if f[:2] == ["art", "ring"]:
        cx, cy, cid = float(f[2]), float(f[3]), f[4]
        D = between(i, nxt_t(k), lambda tg, tt, u, ff: tg == "D" and ff[1] == cid)
        if not D:
            print("  no damage"); continue
        t0 = D[0][1]
        mx = max(float(x[3][2]) for x in D)
        print(f"  shot at {t:.2f}: {len(D)} peons damaged, first impact +{t0 - t:.3f} s after the order, max dmg {mx:.2f}")
        for x in sorted(D, key=lambda x: math.hypot(float(x[3][3]) - cx, float(x[3][4]) - cy)):
            r = math.hypot(float(x[3][3]) - cx, float(x[3][4]) - cy)
            dm = float(x[3][2])
            print(f"    r={r:6.1f}  dmg {dm:6.2f}  ratio {dm / mx:5.3f}  t+{x[1] - t0:.3f}")

print("== missiles: shooter vs knight (still, then running across the line of fire)")
for k, (i, (tag, t, _, f)) in enumerate(X):
    if f[0] == "miss":
        phase, typ, sid, vid = f[1], f[2], f[3], f[4]
        t1 = nxt_t(k)
        A = between(i, t1, lambda tg, tt, u, ff: tg == "A" and ff[0] == sid)
        D = between(i, t1, lambda tg, tt, u, ff: tg == "D" and ff[1] == sid)
        from clog_up import rawcode
        print(f"  {rawcode(typ)} {phase:5s}: attacks started {len(A)}, hits {len(D)}; delays attack->hit {[round(D[j][1] - A[j][1], 3) for j in range(min(len(A), len(D)))]}")
        if phase == "run":
            for a in A:
                h = next((x for x in D if x[1] > a[1]), None)
                print(f"      attack at {a[1]:.2f} target at ({float(a[3][4]):.0f},{float(a[3][5]):.0f})  -> {'hit at %.2f pos (%s,%s)' % (h[1], h[3][3], h[3][4]) if h else 'no hit'}")

print("== collision")
for k, (i, (tag, t, _, f)) in enumerate(X):
    if f[0] == "coll" and f[1] != "swap8":
        a, b = int(f[2]), int(f[3])
        ta, tb = track(R, a, t, t + 5.2), track(R, b, t, t + 5.2)
        def pos(tr, tt):
            p = None
            for s in tr:
                if s[0] <= tt:
                    p = s
            return p
        dmin, dev = 1e9, 0
        y0 = ta[0][2] if ta else 0
        for s in ta:
            q = pos(tb, s[0])
            if q:
                dmin = min(dmin, math.hypot(s[1] - q[1], s[2] - q[2]))
            dev = max(dev, abs(s[2] - y0))
        arr = next((s[0] - t for s in ta if abs(s[1] - (ta[0][1] + 800)) < 8), None)
        print(f"  case {f[1]} ({['enemy head-on', 'same owner head-on', 'enemy idle blocker', 'own idle blocker'][int(f[1])]}): min centre distance {dmin:.1f}, paladin A max sideways deviation {dev:.1f}, arrival {arr}")
    if f[:2] == ["coll", "swap8"]:
        ids = sorted({uid for tg, tt, uid, ff in R[i + 1:] if tg == "N" and tt < t + 1 and ff[0] and U.at(uid, tt)["type"] == "opeo"})
        print(f"  swap8: {len(ids)} peons")
        for uid in ids:
            tr = track(R, uid, t, t + 8.5)
            if tr:
                s, e = tr[0], tr[-1]
                pl = sum(math.hypot(tr[j + 1][1] - tr[j][1], tr[j + 1][2] - tr[j][2]) for j in range(len(tr) - 1))
                done = next((q[0] - t for q in tr if q[4] == 0 and q[0] > t + 0.5), None)
                print(f"    peon {uid}: start ({s[1]:.0f},{s[2]:.0f}) end ({e[1]:.0f},{e[2]:.0f}) path {pl:.0f} (straight 600) order idle at {done}")

print("== melee chase")
for k, (i, (tag, t, _, f)) in enumerate(X):
    if f[0] == "chase":
        aid, vid = f[2], f[3]
        t1 = nxt_t(k)
        A = between(i, t1, lambda tg, tt, u, ff: tg == "A" and ff[0] == aid)
        D = between(i, t1, lambda tg, tt, u, ff: tg == "D" and ff[1] == aid)
        K = between(i, t1, lambda tg, tt, u, ff: tg == "K" and ff[0] == vid)
        print(f"  {f[1]}: attack starts {[round(a[1] - t, 2) for a in A]}  hits {[round(x[1] - t, 2) for x in D]} dmg {[x[3][2] for x in D]}  killed {[round(x[1] - t, 2) for x in K]}")
        for a in A:
            print(f"      attack start at +{a[1] - t:.2f}: gap {math.hypot(float(a[3][2]) - float(a[3][4]), float(a[3][3]) - float(a[3][5])):.1f}")

print("== unit stats seen (N records)")
seen = {}
for uid, incs in U.inc.items():
    for u in incs:
        seen.setdefault(u["type"], u)
for ty, u in sorted(seen.items()):
    print(f"  {ty} {u['name']:<20s} hp {u['maxhp']:.0f} ms {u['ms']:.0f} turn {u['turn']:.3f} propwin {u['propwin']:.1f} acq {u['acq']:.0f}")
