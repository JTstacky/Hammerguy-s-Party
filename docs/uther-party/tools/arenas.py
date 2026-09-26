"""Render every Uther Party 4.0 arena from the map's own data:
war3map.w3e (terrain: cliff level, water, blight, ground texture), war3map.wpm
(baked pathing: walkable / unwalkable) and war3map.doo (destructables, with
footprints from their pathing texture names). One PNG per arena region plus
arenas.json with the geometry in world units."""
import json, os, re, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, 'up40')
GAME = r"path\to\scratch\w3data\game"
sys.path.insert(0, HERE)
import objdecode as od
od.GAME = GAME

# ---------------------------------------------------------------- terrain
d = open(os.path.join(M, 'war3map.w3e'), 'rb').read()
pos = 13
ng = struct.unpack_from('<i', d, pos)[0]; pos += 4
ground = [d[pos + 4 * k:pos + 4 * k + 4].decode() for k in range(ng)]; pos += 4 * ng
nc = struct.unpack_from('<i', d, pos)[0]; pos += 4 + 4 * nc
W, H = struct.unpack_from('<ii', d, pos); pos += 8
CX, CY = struct.unpack_from('<ff', d, pos); pos += 8
arr = np.frombuffer(d, dtype=np.uint8, count=W * H * 7, offset=pos).reshape(H, W, 7)
height = arr[:, :, 0].astype(np.int32) | (arr[:, :, 1].astype(np.int32) << 8)
wl = arr[:, :, 2].astype(np.int32) | (arr[:, :, 3].astype(np.int32) << 8)
water = wl & 0x3FFF
tex = arr[:, :, 4] & 0x0F
flags = arr[:, :, 4] >> 4          # 1 ramp, 2 blight, 4 water, 8 boundary
layer = arr[:, :, 6] & 0x0F
print('w3e', W, H, CX, CY, ground)

# ---------------------------------------------------------------- pathing
p = open(os.path.join(M, 'war3map.wpm'), 'rb').read()
_, ver, PW, PH = struct.unpack_from('<4sIII', p, 0)
path = np.frombuffer(p, dtype=np.uint8, count=PW * PH, offset=16).reshape(PH, PW)
print('wpm', PW, PH)
# orientation check: cliff-edge cells should be unwalkable. Compare both row orders
lay_cells = np.repeat(np.repeat(layer[:-1, :-1], 4, 0), 4, 1)[:PH, :PW]
edge = np.zeros_like(lay_cells, dtype=bool)
edge[1:, :] |= lay_cells[1:, :] != lay_cells[:-1, :]
edge[:, 1:] |= lay_cells[:, 1:] != lay_cells[:, :-1]
nw = (path & 0x02) > 0
a = (nw & edge).sum() / max(edge.sum(), 1)
b = (nw[::-1] & edge).sum() / max(edge.sum(), 1)
print('cliff-edge unwalkable fraction: bottom-up %.3f, top-down %.3f' % (a, b))
if b > a:
    path = path[::-1]          # make row 0 = bottom (y = CY)
nowalk = (path & 0x02) > 0
nobuild = (path & 0x08) > 0
blightp = (path & 0x20) > 0

# ---------------------------------------------------------------- destructables
dslk = od.parse_slk(os.path.join(GAME, 'Units', 'DestructableData.slk'))
dood = od.parse_slk(os.path.join(GAME, 'Doodads', 'Doodads.slk'))
wes = od.load_strings()
q = open(os.path.join(M, 'war3map.doo'), 'rb').read()
_, dver, dsub, n = struct.unpack_from('<4siii', q, 0)
pos = 16
dests = []
for k in range(n):
    rid = q[pos:pos + 4].decode('latin-1'); pos += 4
    var, x, y, z, ang, sx, sy, sz = struct.unpack_from('<iffffff f'.replace(' ', ''), q, pos); pos += 32
    fl, life = q[pos], q[pos + 1]; pos += 2
    if dver >= 8:
        itp, nsets = struct.unpack_from('<ii', q, pos); pos += 8
        for s in range(nsets):
            ni = struct.unpack_from('<i', q, pos)[0]; pos += 4 + ni * 8
    eid = struct.unpack_from('<i', q, pos)[0]; pos += 4
    dests.append((rid, x, y, ang, sx))
print('doo version', dver, 'objects', n)


def dinfo(rid):
    r = dslk.get(rid)
    if r:
        nm = r.get('Name', rid)
        nm = wes.get(nm, nm)
        return nm, str(r.get('pathTex') or ''), True, str(r.get('walkable'))
    r = dood.get(rid)
    if r:
        nm = r.get('Name', rid)
        nm = wes.get(nm, nm)
        return nm, str(r.get('pathTex') or ''), False, '0'
    return rid, '', False, '0'


def footprint(pt):
    m = re.search(r'(\d+)x(\d+)', pt or '')
    if m:
        return int(m.group(1)) * 32, int(m.group(2)) * 32
    return (64, 64) if pt and pt not in ('_', '-', '0') else (0, 0)


regions = {}
for l in open(os.path.join(M, 'regions.txt')):
    nm, rest = l.split(None, 1)
    regions[nm] = [float(v) for v in rest.replace(',', ' ').split()]

ARENAS = {  # main arena region per game (plus sub-regions drawn as outlines)
    'Peon_Pandemonium': 'Peon', 'Rat_Maze': 'Rat', 'Kaboom_Room': 'Kaboom', 'Mortar': 'Mortar', 'Clean_Crew': 'Clean',
    'Way_of_the_Bow': 'Way', 'Roadkill_Challenge': 'Roadkill', 'Covert_Kitty': 'Covert', 'Polymorph_Ring': 'Polymorph',
    'Tauren_Tragedy': 'Tauren', 'Bomb_Baldwin': 'Bomb', 'Dark_Forest': 'Dark', 'Hungry_Hungry_Kodos': 'Hungry',
    'Raider_Relay': 'Raider', 'Treant_Valley': 'Treant', 'Skeleton_Sonata': 'Skeleton', 'Stampede': 'Stampede',
    'Stop_and_Go': 'Stop', 'Push_the_Ogre': 'Push', 'Spike_Pit': 'Spike', 'Salamander_Sizzle': 'Salamander',
    'Obey_Archimonde': 'Obey', 'Whack_a_Fiend': 'Whack', 'Horse_Race': 'Horse', 'Masquerade': 'Masquerade',
    'Crab_Island': 'Crab', 'Blinky_the_Bear': 'Blinky', 'Abombinations': 'Abombinations', 'Sleepy_Time': 'Sleepy',
    'Nature_Circle': 'Nature', 'Skull': 'Skull', 'Minotaur_Maze': 'Minotaur', 'Quillboar_Mile': 'Quillboar',
    'Unseen': 'Unseen', 'Destruction_Dance': 'Destruction', 'Pork_the_Piggy': 'Pork', 'Plague': 'Plague',
    'Troubled_Waters': 'Troubled', 'Sheep_Shearers': 'Sheep', 'Doggy_Hell': 'Doggy', 'Ancient_Punisher': 'Ancient',
    'Spell_Breaker_Blood': 'Spell', 'Dune_Worm_Distress': 'Dune', 'Tides_of_Darkness': 'Tides',
    'Flight_of_the_Footmen': 'Flight', 'Tower_Defense': 'Tower', 'Wheel_of_Fire': 'Wheel', 'Death_Trap': 'Death',
    'Clandestine_Kitty': 'Clandestine',
}

os.makedirs(os.path.join(M, 'arenas'), exist_ok=True)
S = 8  # px per 32-unit pathing cell
out = {}
for rname, prefix in ARENAS.items():
    x1, y1, x2, y2 = regions[rname]
    mg = 256
    X1, Y1, X2, Y2 = x1 - mg, y1 - mg, x2 + mg, y2 + mg
    c1, c2 = int((X1 - CX) // 32), int((X2 - CX) // 32)
    r1, r2 = int((Y1 - CY) // 32), int((Y2 - CY) // 32)
    c1, r1 = max(c1, 0), max(r1, 0)
    c2, r2 = min(c2, PW), min(r2, PH)
    w, h = c2 - c1, r2 - r1
    img = np.zeros((h, w, 3), dtype=np.float32)
    # base colour from cliff level of nearest vertex, water, blight
    for rr in range(h):
        for cc in range(w):
            cell_r, cell_c = r1 + rr, c1 + cc
            vi, vj = min(cell_r // 4, H - 1), min(cell_c // 4, W - 1)
            lv = layer[vi, vj]
            base = np.array([150, 170, 120]) + (int(lv) - 2) * 22
            if water[vi, vj] > height[vi, vj] and flags[vi, vj] & 4:
                base = np.array([70, 110, 190])
            if blightp[cell_r, cell_c]:
                base = base * 0.6 + np.array([120, 60, 140]) * 0.4
            if nowalk[cell_r, cell_c]:
                base = base * 0.35
            img[h - 1 - rr, cc] = np.clip(base, 0, 255)
    im = Image.fromarray(img.astype(np.uint8)).resize((w * S, h * S), Image.NEAREST)
    dr = ImageDraw.Draw(im, 'RGBA')

    def to_px(x, y):
        return ((x - (CX + c1 * 32)) / 32 * S, (h - (y - (CY + r1 * 32)) / 32) * S)

    # destructables
    found = {}
    for rid, x, y, ang, sc in dests:
        if not (X1 <= x <= X2 and Y1 <= y <= Y2):
            continue
        nm, pt, isdest, walk = dinfo(rid)
        fw, fh = footprint(pt)
        found.setdefault(rid, [nm, pt, isdest, 0])[3] += 1
        if isdest and fw:
            a_, b_ = to_px(x - fw / 2, y + fh / 2)
            c_, d_ = to_px(x + fw / 2, y - fh / 2)
            dr.rectangle([a_, b_, c_, d_], outline=(255, 200, 0, 255), fill=(255, 170, 0, 90))
        else:
            px, py = to_px(x, y)
            dr.ellipse([px - 3, py - 3, px + 3, py + 3], fill=(255, 255, 255, 160))
    # sub-regions of this game
    subs = [n for n in regions if n != rname and regions[n][0] >= x1 - 1 and regions[n][2] <= x2 + 1 and regions[n][1] >= y1 - 1 and regions[n][3] <= y2 + 1]
    subs += [n for n in regions if n.startswith(prefix) and n != rname and n not in subs]
    for n in [rname] + subs:
        a1, b1_, a2, b2 = regions[n]
        p1 = to_px(a1, b2); p2 = to_px(a2, b1_)
        col = (255, 60, 60, 255) if n == rname else (0, 255, 255, 255)
        dr.rectangle([p1, p2], outline=col, width=3 if n == rname else 2)
        if n != rname:
            dr.text((p1[0] + 3, p1[1] + 2), n.replace(prefix + '_', '').replace(prefix, '')[:14], fill=(0, 255, 255, 255))
    # grid every 128 u
    for gx in range(int(X1 // 128) * 128, int(X2) + 1, 128):
        px, _ = to_px(gx, 0)
        dr.line([px, 0, px, h * S], fill=(0, 0, 0, 40))
    for gy in range(int(Y1 // 128) * 128, int(Y2) + 1, 128):
        _, py = to_px(0, gy)
        dr.line([0, py, w * S, py], fill=(0, 0, 0, 40))
    dr.text((6, 6), f"{rname}  {x2-x1:.0f}x{y2-y1:.0f} u  (grid = 128 u)", fill=(255, 255, 255, 255))
    im.save(os.path.join(M, 'arenas', rname + '.png'))
    # walkable fraction inside the arena
    ic1, ic2 = int((x1 - CX) // 32), int((x2 - CX) // 32)
    ir1, ir2 = int((y1 - CY) // 32), int((y2 - CY) // 32)
    sub = nowalk[ir1:ir2, ic1:ic2]
    lv = layer[(ir1 // 4):(ir2 // 4) + 1, (ic1 // 4):(ic2 // 4) + 1]
    out[rname] = {'rect': [x1, y1, x2, y2], 'walkable_fraction': round(1 - float(sub.mean()), 3),
                  'cliff_levels': sorted(set(int(v) for v in np.unique(lv))),
                  'water_vertices': int(((water > height) & ((flags & 4) > 0))[(ir1 // 4):(ir2 // 4) + 1, (ic1 // 4):(ic2 // 4) + 1].sum()),
                  'destructables': {k: {'name': v[0], 'pathTex': v[1], 'destructable': v[2], 'count': v[3]} for k, v in found.items()},
                  'subregions': subs}
json.dump(out, open(os.path.join(M, 'arenas.json'), 'w'), indent=1)
print('rendered', len(out))
