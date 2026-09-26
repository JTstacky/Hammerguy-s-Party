"""Split the Uther Party 4.0 script into one bundle per minigame: its trigger code,
the strings it shows, the regions it uses (with sizes) and the object data of
every unit/ability it references."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else 'up40')
sys.path.insert(0, HERE)
import objdecode as od

j = open(os.path.join(M, 'j.txt'), encoding='latin-1').read()
wts = od.load_wts(os.path.join(M, 'war3map.wts'))
objs = json.load(open(os.path.join(M, 'objects.json'), encoding='utf-8'))
ulines = {l.split(':')[0].split(' ')[0]: l.rstrip() for l in open(os.path.join(M, 'objects_units.txt'), encoding='utf-8')}
alines = {l.split(':')[0].split(' ')[0]: l.rstrip() for l in open(os.path.join(M, 'objects_abils.txt'), encoding='utf-8') if not l.startswith(('ITEM', 'UNKNOWN'))}
regions = {}
for l in open(os.path.join(M, 'regions.txt')):
    n, rest = l.split(None, 1)
    x1, y1, x2, y2 = [float(v) for v in rest.replace(',', ' ').split()]
    regions[n] = (x1, y1, x2, y2)

# trigger sections
parts = re.split(r'//===========================================================================\n// Trigger: (.*?)\n//===========================================================================\n', j)
sections = {}
order = []
for i in range(1, len(parts), 2):
    name = parts[i].strip()
    body = parts[i + 1]
    # cut the tail of the last section (InitCustomTriggers etc.)
    body = body.split('\n//***************************************************************************')[0]
    sections[name] = body
    order.append(name)

prefixes = []
for n in order:
    if n.endswith(' Initialization') and n not in ('Intro Initialization',):
        prefixes.append(n[:-len(' Initialization')])

os.makedirs(os.path.join(M, 'bundles'), exist_ok=True)
index = []
for p in prefixes:
    names = [n for n in order if n.split(' ')[0] == p.split(' ')[0] and n.startswith(p)]
    code = ''.join(f'\n// ===== Trigger: {n}\n' + sections[n] for n in names)
    strs = sorted(set(re.findall(r'TRIGSTR_(\d+)', code)), key=int)
    rcs = sorted(set(re.findall(r"'([A-Za-z0-9]{4})'", code)))
    rgs = sorted(set(re.findall(r'gg_rct_([A-Za-z0-9_]+)', code)))
    # also inline string literals
    out = [f'# Minigame bundle: {p}', f'Triggers: {", ".join(names)}', '']
    out.append('## Strings shown (TRIGSTR)')
    for s in strs:
        out.append(f'TRIGSTR_{s}: ' + wts.get('TRIGSTR_%03d' % int(s), '?').replace('\r', '').replace('\n', ' / '))
    out.append('')
    out.append('## Regions (x1,y1,x2,y2 -> width x height, centre)')
    for r in rgs:
        x1, y1, x2, y2 = regions[r]
        out.append(f'{r}: ({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f}) -> {x2-x1:.0f} x {y2-y1:.0f}, centre ({(x1+x2)/2:.0f},{(y1+y2)/2:.0f})')
    out.append('')
    out.append('## Object data for referenced rawcodes (effective values = WC3 1.26 base + map overrides)')
    for rc in rcs:
        out.append(ulines.get(rc) or alines.get(rc) or f'{rc}: (not a unit/ability; destructable/doodad/item or buff)')
    out.append('')
    out.append('## JASS code')
    out.append(code)
    fn = os.path.join(M, 'bundles', p.replace(' ', '_') + '.txt')
    open(fn, 'w', encoding='utf-8').write('\n'.join(out))
    index.append((p, len(names), code.count('\n'), os.path.getsize(fn)))

for row in index:
    print('%-16s triggers=%2d lines=%5d bytes=%6d' % row)
print(len(index), 'bundles')
