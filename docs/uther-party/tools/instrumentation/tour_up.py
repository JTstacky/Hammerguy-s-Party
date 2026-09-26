"""tour_up.py [logdir] [out.md] [tour.json] : one summary per minigame played in the CL tour (8 computer players, brown spectator).
For each game: how it ended, scoring (score and ante changes), the elimination timeline, what the script spawned
(types, owners, spawn intervals), spells, damage per source type, and measured unit speeds."""
import json, math, os, sys
from collections import Counter, defaultdict
from clog_up import read, Units, games, rawcode, LOGS

HERE = os.path.dirname(os.path.abspath(__file__))
IDX = {r[0]: r for r in json.load(open(os.path.join(HERE, "..", "up40", "index.json")))}
d = sys.argv[1] if len(sys.argv) > 1 else LOGS
out_path = sys.argv[2] if len(sys.argv) > 2 else None
json_path = sys.argv[3] if len(sys.argv) > 3 else None
# per game, for the field guide; merged into an existing file so several runs add up
live = json.load(open(json_path, encoding="utf-8")) if json_path and os.path.exists(json_path) else {}
R = read(d)
U = Units(R)
G = games(R)
lines = []
P = lambda *a: lines.append(" ".join(str(x) for x in a))


def owner(uid, t):
    u = U.at(uid, t)
    return u["owner"] if u else None


def utype(uid, t):
    u = U.at(uid, t)
    return u["type"] if u else "?"


for gi, (gf, t0, recs) in enumerate(G):
    how, n = gf[0], int(gf[1])
    t_end = G[gi + 1][1] if gi + 1 < len(G) else (recs[-1][1] if recs and recs[-1][1] else t0)
    meta = IDX.get(n)
    name = meta[2] if meta else "?"
    abort = [r for r in recs if r[0] == "C"]
    P(f"\n## #{n} {name}  ({how}, started {t0:.1f}, next game after {t_end - t0:.1f} s)")
    if meta:
        P(f"code index: type {meta[6]}, timer {meta[4] or 'none'}, ante set {meta[5] or '-'}, ties {meta[7]}")
    tl = [r for r in recs if r[0] == "TL"]
    tl0 = next((int(r[3][0]) for r in tl if int(r[3][0]) > 0), None)
    P(f"timer seen: {tl0 if tl0 is not None else 'none'}" + (f"; ended by {abort[0][3][0]} at +{abort[0][1] - t0:.1f} s" if abort else "; ended by the game itself"))
    an = [(round(r[1] - t0, 1), int(r[3][0])) for r in recs if r[0] == "AN"]
    ku = [(round(r[1] - t0, 1), int(r[3][0])) for r in recs if r[0] == "KU"]
    sc = [(round(r[1] - t0, 1), int(r[3][0]), int(r[3][1])) for r in recs if r[0] == "SC"]
    base = {int(r[3][0]): int(r[3][1]) for r in recs if r[0] == "SC0"}
    last = dict(base)
    gains = []
    for t, i, v in sc:
        if v != last.get(i, 0):
            gains.append((t, i, v - last.get(i, 0)))
            last[i] = v
    P("ante:", an[:14])
    P("key units:", ku[:20])
    P("score gains (t, player 1-8, points):", gains)
    # units
    born = [(r[1], r[2], U.at(r[2], r[1])) for r in recs if r[0] == "N"]
    by = Counter((u["type"], u["owner"]) for _, _, u in born if u)
    P("units created (type/owner x count):", ", ".join(f"{t}/p{o}x{c}" for (t, o), c in sorted(by.items(), key=lambda x: (x[0][1], x[0][0]))))
    names = {}
    for _, _, u in born:
        if u:
            names.setdefault(u["type"], (u["name"], u["maxhp"], u["ms"], u["acq"]))
    P("types:", "; ".join(f"{t}={v[0]} hp{v[1]:.0f} ms{v[2]:.0f}" for t, v in sorted(names.items())))
    haz = defaultdict(list)
    for t, uid, u in born:
        if u and u["owner"] >= 8:
            haz[(u["type"], u["owner"])].append(round(t - t0, 2))
    for (ty, o), ts in sorted(haz.items()):
        if len(ts) >= 3:
            gaps = [round(b - a, 2) for a, b in zip(ts, ts[1:])]
            P(f"spawn times {ty}/p{o} (n={len(ts)}): first +{ts[0]}, gaps {gaps[:12]}{' ...' if len(gaps) > 12 else ''}")
    # spells
    sp = Counter((rawcode(r[3][1]), utype(int(r[3][0]), r[1]), owner(int(r[3][0]), r[1]) if r[3][0].isdigit() else None) for r in recs if r[0] == "SEF" and r[3][0].isdigit())
    if sp:
        P("spell effects (abil, caster type, owner): ", ", ".join(f"{a} by {t}/p{o} x{c}" for (a, t, o), c in sp.most_common(12)))
    # damage and kills
    dm = defaultdict(list)
    for r in recs:
        if r[0] == "D" and r[3][1].isdigit() and r[3][0].isdigit():
            st = utype(int(r[3][1]), r[1]) if r[3][1] != "0" else "none"
            dm[(st, utype(int(r[3][0]), r[1]))].append(float(r[3][2]))
    for (s, v), xs in sorted(dm.items(), key=lambda x: -len(x[1]))[:8]:
        P(f"damage {s} -> {v}: n={len(xs)} min {min(xs):.1f} max {max(xs):.1f}")
    kills = Counter((utype(int(r[3][0]), r[1]), utype(int(r[3][1]), r[1]) if r[3][1] not in ("0", "") else "none") for r in recs if r[0] == "K" and r[3][0].isdigit())
    if kills:
        P("deaths (victim type <- killer type):", ", ".join(f"{v}<-{k} x{c}" for (v, k), c in kills.most_common(10)))
    # speeds (from consecutive samples of the same unit)
    last_s, spd = {}, defaultdict(list)
    for r in recs:
        if r[0] == "U":
            uid, t = r[2], r[1]
            x, y = float(r[3][0]), float(r[3][1])
            if uid in last_s:
                tp, xp, yp = last_s[uid]
                if 0.05 < t - tp < 0.25:
                    v = math.hypot(x - xp, y - yp) / (t - tp)
                    if v < 3000:
                        spd[utype(uid, t)].append(v)
            last_s[uid] = (t, x, y)
    sp_txt = []
    for ty, vs in sorted(spd.items()):
        vs = sorted(vs)
        if len(vs) >= 10:
            sp_txt.append(f"{ty} p50 {vs[len(vs) // 2]:.0f} p95 {vs[int(len(vs) * .95)]:.0f} max {vs[-1]:.0f}")
    P("speeds u/s:", "; ".join(sp_txt))
    deaths = [round(r[1] - t0, 1) for r in recs if r[0] == "K" and r[3][0].isdigit() and (owner(int(r[3][0]), r[1]) or 99) < 8]
    tot = Counter()
    for _, i, v in gains:
        tot[i] += v
    capped = bool(abort) and abort[0][3][0] == "cap"
    # length = start to the last payout (the log can run on past the end, e.g. into a crash)
    ku_zero = next((t for t, k in ku if k == 0 and t > 0.5), None)
    # every unit gets a stop (851972) and 851974 when the map creates it; anything else is a real order
    moves = sum(1 for r in recs if r[0] in ("OP", "OT", "OI") and r[3][0].isdigit() and r[3][1] not in ("851972", "851974")
                and (owner(int(r[3][0]), r[1]) or 99) < 8)
    entry = {"dur": gains[-1][0] if gains and not capped else (ku_zero if ku_zero is not None and not capped else round(t_end - t0, 1)), "end": "cap" if capped else "game",
             "scores": sorted(([i, v] for i, v in tot.items() if v), key=lambda x: -x[1]),
             "note": (f"{len(deaths)} deaths among players' units, first at +{deaths[0]} s" if deaths else "no player deaths")
                     + (f"; timer {tl0} s" if tl0 else "")
                     + ("; stopped by the 150 s cap" if capped else "")
                     + ("; the computer players never moved" if moves == 0 else "")}
    prev = live.get(str(n))
    # only games the tour started count; random games before or after it are often cut short
    if how == "tour" and (not prev or (prev.get("end") == "cap" and entry["end"] == "game")):
        live[str(n)] = entry
    orders = Counter(r[3][1] for r in recs if r[0] in ("OP", "OT", "OI") and r[3][0].isdigit() and (owner(int(r[3][0]), r[1]) or 99) < 8)
    P("contestant orders (order id x count):", dict(orders.most_common(8)))

txt = "\n".join(lines)
if json_path:
    json.dump(live, open(json_path, "w", encoding="utf-8"), indent=1, sort_keys=True)
    print("tour.json games:", len(live))
if out_path:
    open(out_path, "w", encoding="utf-8").write("# CL tour: per-game summaries (8 computer players, brown spectator)\n" + txt + "\n")
print(txt[-6000:] if len(txt) > 6000 else txt)
