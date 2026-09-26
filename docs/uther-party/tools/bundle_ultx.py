"""Per-minigame bundles for Uther Party Ultima-X. Its script was run through an
optimizer: no '// Trigger:' comments and trigger setup (events, periods) is
inlined into main(). So bundles are built from function names (Trig_<T>_*) of the
triggers that belong to each game, plus each trigger's inlined setup from main."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, 'ultx')
sys.path.insert(0, HERE)
import objdecode as od

j = open(os.path.join(M, 'j.txt'), encoding='latin-1').read()
wts = od.load_wts(os.path.join(M, 'war3map.wts'))
ulines = {l.split(':')[0].split(' ')[0]: l.rstrip() for l in open(os.path.join(M, 'objects_units.txt'), encoding='utf-8')}
alines = {l.split(':')[0].split(' ')[0]: l.rstrip() for l in open(os.path.join(M, 'objects_abils.txt'), encoding='utf-8') if not l.startswith(('ITEM', 'UNKNOWN'))}

# regions
regions = {}
for m in re.finditer(r'set gg_rct_(\w+)=Rect\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)', j):
    regions[m.group(1)] = tuple(float(v) for v in m.groups()[1:])
with open(os.path.join(M, 'regions.txt'), 'w') as f:
    for n, (a, b, c, d) in sorted(regions.items()):
        f.write(f'{n} {a}, {b}, {c}, {d}\n')

# functions
funcs = {}
order = []
for m in re.finditer(r'^function (\w+) takes.*?^endfunction\n', j, re.S | re.M):
    funcs[m.group(1)] = m.group(0)
    order.append(m.group(1))
main = funcs.get('main', '')
# trigger names and their inlined setup blocks in main()
trig_names = sorted(set(re.findall(r'set gg_trg_(\w+)=CreateTrigger\(\)', j)))
setup = {}
parts = re.split(r'(?=set gg_trg_\w+=CreateTrigger\(\))', main)
for p in parts:
    m = re.match(r'set gg_trg_(\w+)=CreateTrigger\(\)', p)
    if m:
        setup[m.group(1)] = p.strip()

events = {}
for m in re.finditer(r'set udg_Triggers_Events\[(\$?[0-9A-Fa-f]+)\]=gg_trg_(\w+)', j):
    k = m.group(1)
    n = int(k[1:], 16) if k.startswith('$') else int(k)
    events[n] = m.group(2)
prefixes = {n: (t[:-len('_Initialization')] if t.endswith('_Initialization') else t) for n, t in events.items()}
allp = sorted(set(prefixes.values()) | {'Free'}, key=len, reverse=True)


def owner(trig):
    for p in allp:
        if trig == p or trig.startswith(p + '_'):
            return p
    return None


up40_prefixes = set(re.findall(r'udg_Triggers_Events\[\d+\] = gg_trg_(\w+)_Initialization', open(os.path.join(HERE, 'up40', 'j.txt'), encoding='latin-1').read()))
os.makedirs(os.path.join(M, 'bundles'), exist_ok=True)
index = []
for n in sorted(prefixes):
    p = prefixes[n]
    trigs = [t for t in trig_names if owner(t) == p]
    code = []
    for t in trigs:
        fs = [f for f in order if f.startswith('Trig_' + t + '_')]
        code.append(f'\n// ===== Trigger: {t}\n// setup (inlined in main): ' + setup.get(t, '(none found)').replace('\n', ' ; ') + '\n' + ''.join(funcs[f] for f in fs))
    code = ''.join(code)
    strs = sorted(set(re.findall(r'TRIGSTR_(\d+)', code)), key=int)
    lits = sorted(set(re.findall(r'"(\|c[Ff]{2}[^"]{4,200})"', code)))
    rcs = sorted(set(re.findall(r"'([A-Za-z0-9]{4})'", code)))
    rgs = sorted(set(re.findall(r'gg_rct_([A-Za-z0-9_]+)', code)))
    out = [f'# Ultima-X minigame bundle: {p} (event #{n}{", also in 4.0" if p in up40_prefixes else ""})', f'Triggers: {", ".join(trigs)}', '']
    out.append('## Strings shown')
    for s in strs:
        out.append(f'TRIGSTR_{s}: ' + wts.get('TRIGSTR_%03d' % int(s), '?').replace('\n', ' / '))
    for s in lits:
        out.append('literal: ' + s.replace('\n', ' / '))
    out.append('')
    out.append('## Regions (x1,y1,x2,y2 -> width x height, centre)')
    for r in rgs:
        if r in regions:
            x1, y1, x2, y2 = regions[r]
            out.append(f'{r}: ({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f}) -> {x2-x1:.0f} x {y2-y1:.0f}, centre ({(x1+x2)/2:.0f},{(y1+y2)/2:.0f})')
    out.append('')
    out.append('## Object data (effective values from the map\'s own merged SLK/TXT tables)')
    for rc in rcs:
        out.append(ulines.get(rc) or alines.get(rc) or f'{rc}: (not a unit/ability in the tables; destructable/doodad/item/buff/order id)')
    out.append('')
    out.append('## JASS (optimized: hex literals like $A = 10, Player(-1+(i)) = player i)')
    out.append(code)
    fn = os.path.join(M, 'bundles', f'{n:03d}_{p}.txt')
    open(fn, 'w', encoding='utf-8').write('\n'.join(out))
    index.append((n, p, p in up40_prefixes, len(trigs), os.path.getsize(fn)))
for r in index:
    print('%3d %-22s in4.0=%-5s triggers=%2d bytes=%6d' % r)
json.dump(index, open(os.path.join(M, 'bundles', 'index.json'), 'w'))
