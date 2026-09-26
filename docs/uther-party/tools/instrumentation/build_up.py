"""build_up.py : splice the Claude logger/debug controls into Uther Party 4.0 and write
"UtherParty 4.0 CL.w3x" (map list name "Uther Party 4.0 CL").
  - globals + CL_ functions go right after endglobals (they only use natives and globals)
  - CL_Init runs after RunInitializationTriggers
  - Filter honours cl_force (-cl go N / -cl next N) and every game start is logged as G
The original map is only read."""
import os, sys, struct, hashlib, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, r"E:\AI\Games\Arcane Arena\docs\wc3-instrumentation")
import mpq

SRC = r"E:\Games\Warcraft III\Maps\Download\UtherParty 4.0 OFFICIAL.w3x"
OUT = os.path.join(HERE, "UtherParty 4.0 CL.w3x")
NAME = "Uther Party 4.0 CL"

arc = mpq.MPQArchive(SRC)
arc.add_known_names(mpq.STANDARD_NAMES)
names = arc.names()
j = arc.read_file("war3map.j").decode("latin-1")
print("CRLF:", j.count("\r\n"), " lone CR:", j.count("\r") - j.count("\r\n"))
j = j.replace("\r\n", "\n")
assert "\r" not in j
glob = open(os.path.join(HERE, "cl_globals.j")).read()
f1 = open(os.path.join(HERE, "cl_funcs.j")).read()
f2 = open(os.path.join(HERE, "cl_funcs2.j")).read()

# messages and camera for whoever is local (the human may sit in any slot, e.g. brown)
f1 = f1.replace("DisplayTimedTextToPlayer(Player(0), ", "DisplayTimedTextToPlayer(GetLocalPlayer(), ")
f1 = f1.replace("""    call SetCameraBoundsToRectForPlayerBJ(Player(0), r)
    call PanCameraToTimedForPlayer(Player(0), GetRectCenterX(r), GetRectCenterY(r), 0)""",
                """    call SetCameraBoundsToRect(r)
    call PanCameraToTimed(GetRectCenterX(r), GetRectCenterY(r), 0)""")
f1 = f1.replace("call ResetToGameCameraForPlayer(Player(0), 0)", "call ResetToGameCamera(0)")
f1 = f1.replace("call SetCameraBoundsToRectForPlayerBJ(Player(0), gg_rct_Clean_Crew)", "call SetCameraBoundsToRect(gg_rct_Clean_Crew)")
f1 = f1.replace("// Chat (red only):", "// Chat (any slot 1-12):")
assert "Player(0), r" not in f1 and "ForPlayer(Player(0)" not in f1 and "ForPlayerBJ(Player(0)" not in f1

i = j.index("\nendglobals\n")
j = j[:i] + "\n" + glob.rstrip("\n") + j[i:]
i = j.index("\nendglobals\n") + len("\nendglobals\n")
j = j[:i] + "\n" + f1.rstrip("\n") + "\n" + f2.rstrip("\n") + "\n\n" + j[i:]

k = j.index("call RunInitializationTriggers(  )")
k = j.index("\n", k)
j = j[:k] + "\n    call CL_Init(  )" + j[k:]
assert j.count("call CL_Init(  )") == 1

head = "function Trig_Filter_Actions takes nothing returns nothing\n"
assert j.count(head) == 1
start = "call TriggerExecute( udg_Triggers_Events[udg_Integer_Number] )"
parts = j.split("\n")
out = []
for line in parts:
    if line.strip() == start:
        ind = line[:len(line) - len(line.lstrip())]
        out.append(ind + 'call CL_GameStart(udg_Integer_Number, "start")')
    out.append(line)
j = "\n".join(out)
print("G hooks:", j.count('call CL_GameStart(udg_Integer_Number, "start")'))
j = j.replace(head, head + """    if cl_force > 0 then
        set udg_Integer_Number = cl_force
        set cl_force = 0
        call CL_GameStart(udg_Integer_Number, "forced")
        call TriggerExecute( udg_Triggers_Events[udg_Integer_Number] )
        return
    endif
    if cl_tour > 0 then
        set udg_Integer_Number = cl_tour
        set cl_tour = cl_tour + 1
        if cl_tour > cl_tour_end then
            set cl_tour = 0
        endif
        call CL_GameStart(udg_Integer_Number, "tour")
        call TriggerExecute( udg_Triggers_Events[udg_Integer_Number] )
        return
    endif
""")

open(os.path.join(HERE, "war3map_cl.j"), "w", encoding="latin-1", newline="").write(j)
rc = subprocess.call([sys.executable, os.path.join(HERE, "jcheck.py"), os.path.join(HERE, "war3map_cl.j")])
if rc:
    sys.exit("jcheck failed")

wts = arc.read_file("war3map.wts")
old = b"|cff229966Uther Party 4.0 Official"
assert wts.count(old) >= 1
k = wts.index(b"STRING 1")
v = wts.index(old, k)
assert v - k < 20
wts = wts[:v] + b"|cff229966" + NAME.encode() + wts[v + len(old):]

# Debug seat: make brown (Player 11, "Uther's Staff", the hazard owner) an open human slot instead of a
# fixed computer, in both the w3i (lobby) and config() (script), so a human can sit there and watch.
from w3i_players import players as w3i_players
w3i = bytearray(arc.read_file("war3map.w3i"))
flags, flag_off, ps, fs = w3i_players(bytes(w3i))
p11 = [p for p in ps if p["num"] == 11][0]
assert p11["type"] == 2
struct.pack_into("<i", w3i, p11["type_off"], 1)
print("w3i: brown slot computer -> human; map flags", hex(flags))
cfg = "call SetPlayerController( Player(11), MAP_CONTROL_COMPUTER )"
assert j.count(cfg) == 1
j = j.replace(cfg, "call SetPlayerController( Player(11), MAP_CONTROL_USER )")
open(os.path.join(HERE, "war3map_cl.j"), "w", encoding="latin-1", newline="").write(j)

remove = [n for n in names if n.lower() in ("(attributes)",)]
written = mpq.rebuild_map(SRC, OUT, replace={"war3map.j": j.encode("latin-1"), "war3map.wts": wts, "war3map.w3i": bytes(w3i)}, remove=remove, compress=True)
src_blocks = len([b for b in arc.block_entries if b[3] & 0x80000000])
print("source files with names:", len(names), " source used blocks:", src_blocks, " written:", len(written))

b = bytearray(open(OUT, "rb").read())
assert b[:4] == b"HM3W"
end = b.index(b"\0", 8)
rest = bytes(b[end + 1:end + 9])
new = b"HM3W\0\0\0\0" + ("|cff229966" + NAME).encode() + b"\0" + rest
b[:512] = new.ljust(512, b"\0")
open(OUT, "wb").write(b)
back = mpq.MPQArchive(OUT)
assert back.read_file("war3map.j").decode("latin-1") == j
print("wrote", OUT, os.path.getsize(OUT), "bytes; sha", hashlib.sha256(bytes(b)).hexdigest()[:12])
