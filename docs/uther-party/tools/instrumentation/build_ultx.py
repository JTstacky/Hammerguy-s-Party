"""build_ultx.py : splice the Claude logger/debug controls into Uther Party vUltima-X and write
"Uther Party Ultima-X CL.w3x". Same logger as the 4.0 build (cl_globals.j, cl_funcs.j, cl_funcs2.j).
Ultima-X differences handled here:
  - the script is optimizer output (no indentation, $hex literals) stored as scripts\\war3map.j
  - the archive has no (listfile) and two encrypted files whose names are unknown, so it is patched in place
    (mpq_inplace.py) instead of rebuilt
  - a human in the brown slot is defeated at start ("No. :)"): that call is removed
  - the map name is a literal in war3map.w3i
The original map is only read."""
import os, re, struct, subprocess, sys, hashlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mpq_inplace
from ultx_names import names, SRC
from w3i_players import players as w3i_players

OUT = os.path.join(HERE, "Uther Party Ultima-X CL.w3x")
NAME = "Uther Party |cff808080Ultima-X CL"
SCRIPT = "scripts" + chr(92) + "war3map.j"

arc, ns = names()
raw = arc.read_file(SCRIPT).decode("latin-1")
j = raw.replace("\r\n", "\n").replace("\r", "\n")
glob = open(os.path.join(HERE, "cl_globals.j")).read()
f1 = open(os.path.join(HERE, "cl_funcs.j")).read()
f2 = open(os.path.join(HERE, "cl_funcs2.j")).read()
f1 = f1.replace("DisplayTimedTextToPlayer(Player(0), ", "DisplayTimedTextToPlayer(GetLocalPlayer(), ")
f1 = f1.replace("""    call SetCameraBoundsToRectForPlayerBJ(Player(0), r)
    call PanCameraToTimedForPlayer(Player(0), GetRectCenterX(r), GetRectCenterY(r), 0)""",
                """    call SetCameraBoundsToRect(r)
    call PanCameraToTimed(GetRectCenterX(r), GetRectCenterY(r), 0)""")
f1 = f1.replace("call ResetToGameCameraForPlayer(Player(0), 0)", "call ResetToGameCamera(0)")
f1 = f1.replace("call SetCameraBoundsToRectForPlayerBJ(Player(0), gg_rct_Clean_Crew)", "call SetCameraBoundsToRect(gg_rct_Clean_Crew)")
f1 = f1.replace("Logs\\\\claude_up_", "Logs\\\\claude_ux_")
f1 = f1.replace("claude-instrumented Uther Party 4.0", "claude-instrumented Uther Party Ultima-X")
f2 = f2.replace("claude-instrumented Uther Party 4.0", "claude-instrumented Uther Party Ultima-X")
assert "claude_ux_" in f1

i = j.index("\nendglobals\n")
j = j[:i] + "\n" + glob.rstrip("\n") + j[i:]
i = j.index("\nendglobals\n") + len("\nendglobals\n")
j = j[:i] + "\n" + f1.rstrip("\n") + "\n" + f2.rstrip("\n") + "\n\n" + j[i:]

m = re.search(r"^function main takes nothing returns nothing\n.*?^endfunction", j, re.S | re.M)
body = m.group(0)
print("main() ends with:", body[-120:].replace("\n", " | "))
j = j[:m.end() - len("endfunction")] + "call CL_Init()\n" + j[m.end() - len("endfunction"):]

start_re = re.compile(r"^(\s*)call TriggerExecute\(udg_Triggers_Events\[udg_Integer_Number\]\)\s*$")
out = []
for line in j.split("\n"):
    m = start_re.match(line)
    if m:
        out.append(m.group(1) + 'call CL_GameStart(udg_Integer_Number, "start")')
    out.append(line)
j = "\n".join(out)
print("G hooks:", j.count('call CL_GameStart(udg_Integer_Number, "start")'))

head = "function Trig_Filter_Actions takes nothing returns nothing\n"
assert j.count(head) == 1
j = j.replace(head, head + """if cl_force > 0 then
set udg_Integer_Number = cl_force
set cl_force = 0
call CL_GameStart(udg_Integer_Number, "forced")
call TriggerExecute(udg_Triggers_Events[udg_Integer_Number])
return
endif
if cl_tour > 0 then
set udg_Integer_Number = cl_tour
set cl_tour = cl_tour + 1
if cl_tour > cl_tour_end then
set cl_tour = 0
endif
call CL_GameStart(udg_Integer_Number, "tour")
call TriggerExecute(udg_Triggers_Events[udg_Integer_Number])
return
endif
""")

defeat = 'call CustomDefeatBJ(Player($B),"No. :)")'
assert j.count(defeat) == 1
j = j.replace(defeat, "call DoNothing()")
ctrl = "call SetPlayerController(Player($B),MAP_CONTROL_COMPUTER)"
print("brown controller lines:", j.count(ctrl))
j = j.replace(ctrl, "call SetPlayerController(Player($B),MAP_CONTROL_USER)")

open(os.path.join(HERE, "war3map_ux.j"), "w", encoding="latin-1", newline="").write(j)
rc = subprocess.call([sys.executable, os.path.join(HERE, "jcheck.py"), os.path.join(HERE, "war3map_ux.j")])
if rc:
    sys.exit("jcheck failed")

# w3i: new name, brown slot human
w3i = arc.read_file("war3map.w3i")
e = w3i.index(b"\0", 12)
w3i = w3i[:12] + NAME.encode("latin-1") + w3i[e:]
w3i = bytearray(w3i)
flags, flag_off, ps, fs = w3i_players(bytes(w3i))
p11 = [p for p in ps if p["num"] == 11][0]
assert p11["type"] == 2
struct.pack_into("<i", w3i, p11["type_off"], 1)

n = mpq_inplace.patch(arc, OUT, {SCRIPT: j.encode("latin-1"), "war3map.w3i": bytes(w3i)}, header_name=NAME)
from mpq_inplace import mpq
back = mpq.MPQArchive(OUT)
back.add_known_names(ns)
assert back.read_file(SCRIPT).decode("latin-1") == j
assert back.read_file("war3map.w3i") == bytes(w3i)
same = sum(1 for x in ns if x not in (SCRIPT, "war3map.w3i", "(attributes)") and back.read_file(x) == arc.read_file(x))
print("unchanged files verified:", same, "of", len([x for x in ns if x not in (SCRIPT, "war3map.w3i", "(attributes)")]))
print("wrote", OUT, n, "bytes; sha", hashlib.sha256(open(OUT, "rb").read()).hexdigest()[:12])
