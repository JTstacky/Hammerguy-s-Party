"""clog_up.py : parse the Uther Party CL logs (Logs\\claude_up_N.txt, Preload format) into records.

Record tags (see cl_funcs*.j):
  P,p,id,controller,slotstate,name     B,t,text          M,t,text            X,t,exp,...
  N,id,t,type,owner,name,x,y,maxhp,ms,turn,propwin,acq,flyH   (unit first seen)
  U,id,t,x,y,facing,order,ms           H,id,t,hp          (sampled, only on change)
  OP,t,id,order,x,y  OT,t,id,order,target,x,y  OI,t,id,order
  SCH/SCA/SEF/SFI/SEN,t,id,abil,target,x,y   (spell channel/cast/effect/finish/endcast)
  D,t,victim,source,dmg,vx,vy,sx,sy,life    K,t,victim,killer,x,y    A,t,attacker,victim,ax,ay,vx,vy,facing
  G,t,how,n,gamesPlayed,seq,ante   SC0,i,score,slot   SC,t,i,score   AN,t,ante   KU,t,count   TL,t,secondsLeft
  C,t,why,n   (game aborted by cap/chat/tour)
Every record is returned as (tag, t, id, fields) with t a float (or None) and id the unit handle id (or None)."""
import glob, os, re

LOGS = r"E:\Games\Warcraft III\Logs"
UNIT_FIRST = {"N", "U", "H"}


def rawcode(i):
    i = int(i)
    try:
        return i.to_bytes(4, "big").decode("latin-1")
    except OverflowError:
        return str(i)


def files(d=LOGS):
    fs = glob.glob(os.path.join(d, "claude_up_*.txt"))
    return sorted(fs, key=lambda p: int(re.findall(r"(\d+)\.txt$", p)[0]))


def read(d=LOGS):
    out = []
    for p in files(d):
        txt = open(p, encoding="latin-1").read()
        for chunk in re.findall(r'call Preload\( "(.*)" \)', txt):
            for rec in chunk.split(";"):
                if not rec:
                    continue
                f = rec.split(",")
                tag = f[0]
                if tag in UNIT_FIRST:
                    out.append((tag, float(f[2]), int(f[1]), f[3:]))
                elif tag in ("P", "SC0"):
                    out.append((tag, None, None, f[1:]))
                else:
                    try:
                        t = float(f[1])
                    except (IndexError, ValueError):
                        t = None
                    out.append((tag, t, None, f[2:]))
    return out


class Units:
    """Unit table from N records (handle ids are reused after a unit is removed, so keep every incarnation)."""

    def __init__(self, recs):
        self.inc = {}
        for tag, t, uid, f in recs:
            if tag == "N":
                if len(f) < 11:
                    continue
                if len(f) > 11:  # unit name containing commas
                    f = f[:2] + [",".join(f[2:len(f) - 8])] + f[len(f) - 8:]
                self.inc.setdefault(uid, []).append(dict(t=t, type=rawcode(f[0]), owner=int(f[1]), name=f[2], x=float(f[3]), y=float(f[4]),
                                                         maxhp=float(f[5]), ms=float(f[6]), turn=float(f[7]), propwin=float(f[8]),
                                                         acq=float(f[9]), fly=float(f[10])))

    def at(self, uid, t):
        best = None
        for u in self.inc.get(uid, []):
            if u["t"] <= t + 0.2:
                best = u
        return best or (self.inc.get(uid) or [None])[0]

    def label(self, uid, t):
        u = self.at(int(uid), t) if str(uid).lstrip("-").isdigit() else None
        return f"{u['type']}/p{u['owner']}" if u else str(uid)


def games(recs):
    """Split records into games at each G record -> list of (g_fields, t0, records)."""
    res, cur = [], None
    for r in recs:
        if r[0] == "G":
            cur = (r[3], r[1], [])
            res.append(cur)
        elif cur is not None:
            cur[2].append(r)
    return res


def track(recs, uid, t0=None, t1=None):
    """Position samples [(t,x,y,facing,order,ms)] of one unit handle within [t0,t1]."""
    out = []
    for tag, t, i, f in recs:
        if tag == "U" and i == uid and (t0 is None or t >= t0) and (t1 is None or t <= t1):
            out.append((t, float(f[0]), float(f[1]), int(f[2]), int(f[3]), int(f[4])))
    return out


if __name__ == "__main__":
    import sys
    from collections import Counter
    d = sys.argv[1] if len(sys.argv) > 1 else LOGS
    r = read(d)
    print(len(files(d)), "files", len(r), "records", Counter(x[0] for x in r).most_common())
    for x in r:
        if x[0] in ("B", "G", "C", "M", "X", "AN", "SC"):
            print(x)
