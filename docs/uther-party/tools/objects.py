"""Effective object data for every rawcode the Uther Party 4.0 script references.
Writes up40/objects_units.txt and up40/objects_abils.txt (compact, human readable)
plus objects.json."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import objdecode as od

HERE = os.path.dirname(os.path.abspath(__file__))
od.GAME = os.environ.get("OBJ_GAME") or r"path\to\scratch\w3data\game"
MAPD = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else 'up40')

udb = od.UnitDB()
adb = od.AbilDB()
wes = od.load_strings()
wts = od.load_wts(os.path.join(MAPD, 'war3map.wts'))


def tr(v):
    if isinstance(v, str):
        v2 = wts.get(v, v)
        return wes.get(v2, v2) if v2.startswith('WESTRING') else v2
    return v


def load(fname, levels):
    p = os.path.join(MAPD, fname)
    if not os.path.exists(p):
        return {}
    _, t = od.read_objfile(p, levels)
    out = {}
    for tname in ('original', 'custom'):
        for o in t.get(tname, []):
            out[o['id']] = o
    return out


units = load('war3map.w3u', False)
items = load('war3map.w3t', False)
abils = load('war3map.w3a', True)

j = open(os.path.join(MAPD, 'j.txt'), encoding='latin-1').read()
refs = sorted(set(re.findall(r"'([A-Za-z0-9]{4})'", j)))

# field ids by meta name
ufield = {m.get('field'): fid for fid, m in udb.meta.items()}
UF = [('name', 'unam'), ('speed', 'umvs'), ('turn', 'umvr'), ('propwin', 'uprw'), ('move', 'umvt'),
      ('flyH', 'umvh'), ('coll', 'ucol'), ('hp', 'uhpm'), ('regen', 'uhpr'), ('mana', 'umpm'), ('armor', 'udef'),
      ('weapons', 'uaen'), ('dmgBase', 'ua1b'), ('dice', 'ua1d'), ('sides', 'ua1s'), ('cool', 'ua1c'),
      ('range', 'ua1r'), ('splashFull', 'ua1f'), ('splashHalf', 'ua1h'), ('splashQtr', 'ua1q'), ('halfFac', 'uhd1'), ('qtrFac', 'uqd1'), ('splashTargs', 'ua1p'), ('targs', 'ua1g'), ('atkType', 'ua1t'), ('weapTp', 'ua1w'), ('dmgpt', 'udp1'), ('projSpd', 'ua1z'),
      ('acq', 'uacq'), ('sight', 'usid'), ('abilities', 'uabi'), ('heroAbils', 'uhab'), ('model', 'umdl'),
      ('scale', 'usca'), ('castpt', 'ucpt'), ('bounty', 'ubba'), ('race', 'urac'), ('lvl', 'ulev')]


def unit_row(rc):
    o = units.get(rc)
    base = o['base'] if o else rc
    mods = {m['field']: m['value'] for m in o['mods']} if o else {}
    if not o and base not in udb.slks['UnitBalance'] and base not in udb.slks['UnitData'] and base not in udb.profile:
        return None
    row = {'id': rc, 'base': base if o else None, 'custom': bool(o and o['id'] != o['base']) if o else False}
    changed = []
    for k, fid in UF:
        b = udb.base_value(base, fid)
        v = mods.get(fid, b)
        v = tr(v)
        if v in (None, '', '-', '_'):
            continue
        row[k] = v
        if fid in mods:
            changed.append(k)
    other = [f"{m['field']}({(udb.meta.get(m['field']) or {}).get('field')})={tr(m['value'])}" for m in (o['mods'] if o else [])
             if m['field'] not in dict((f, 1) for _, f in UF)]
    row['modified'] = changed
    row['otherMods'] = other
    return row


AF = ['alev', 'acdn', 'amcs', 'adur', 'ahdu', 'aran', 'aare', 'acas', 'atar', 'aher', 'abuf', 'aeff']


def abil_row(rc):
    o = abils.get(rc)
    base = o['base'] if o else rc
    if not o and base not in adb.slks['AbilityData'] and base not in adb.profile:
        return None
    mods = {}
    if o:
        for m in o['mods']:
            mods[(m['field'], m.get('level', 0), m.get('data', 0))] = m['value']
    nlev = None
    for (f, L, d), v in mods.items():
        if f == 'alev':
            nlev = v
    nlev = int(nlev or adb.base_value(base, 'alev', 0) or 1)
    nm = tr(next((v for (f, L, d), v in mods.items() if f == 'anam'), None) or adb.profile.get(base, {}).get('Name') or base)
    row = {'id': rc, 'base': base if o else None, 'name': nm, 'levels': nlev, 'fields': {}}
    fids = set(AF) | {f for (f, L, d) in mods}
    for fid in sorted(fids):
        meta = adb.meta.get(fid, {})
        if meta.get('field') in ('Tip', 'Ubertip', 'Researchtip', 'Researchubertip', 'Art', 'Researchart', 'Unart', 'Buttonpos', 'Name', 'Hotkey', 'Researchhotkey', 'Unhotkey', 'Untip', 'Unubertip', 'Unbuttonpos', 'EditorSuffix', 'SpecialArt', 'Specialattach', 'Missileart', 'Areaeffectart', 'TargetArt', 'Targetattach', 'CasterArt', 'Casterattach', 'Effectsound', 'Effectsoundlooped', 'Animnames', 'LightningEffect'):
            continue
        rep = meta.get('repeat', 0) or 0
        vals = []
        for L in (range(1, min(nlev, 4) + 1) if rep else [0]):
            b = adb.base_value(base, fid, L)
            key = [k for k in mods if k[0] == fid and (k[1] == L or not rep)]
            v = mods[key[0]] if key else b
            vals.append(tr(v))
        vals = [v for v in vals if v not in (None, '', '-')]
        if not vals:
            continue
        label = meta.get('field', fid) + ('ABCDEFGHI'[meta['data'] - 1] if meta.get('data') else '')
        mod = any(k[0] == fid for k in mods)
        row['fields'][f"{fid}/{label}{'*' if mod else ''}"] = vals if len(set(map(str, vals))) > 1 else vals[0]
    tip = [v for (f, L, d), v in mods.items() if f in ('aub1', 'atp1')]
    if tip:
        row['tooltip'] = tr(tip[0])
    return row


def item_row(rc):
    o = items.get(rc)
    base = o['base'] if o else rc
    if not o and base not in udb.slks['ItemData'] and base not in udb.profile:
        return None
    mods = {m['field']: tr(m['value']) for m in o['mods']} if o else {}
    nm = mods.get('unam') or udb.profile.get(base, {}).get('Name') or base
    return {'id': rc, 'base': base if o else None, 'name': nm, 'abilities': mods.get('iabi') or udb.base_value(base, 'iabi'), 'mods': mods}


out = {'units': [], 'abils': [], 'items': [], 'unknown': []}
for rc in refs + [k for k in units if k not in refs] + [k for k in abils if k not in refs]:
    r = unit_row(rc)
    if r:
        out['units'].append(r); continue
    r = abil_row(rc)
    if r:
        out['abils'].append(r); continue
    r = item_row(rc)
    if r:
        out['items'].append(r); continue
    out['unknown'].append(rc)

json.dump(out, open(os.path.join(MAPD, 'objects.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
with open(os.path.join(MAPD, 'objects_units.txt'), 'w', encoding='utf-8') as f:
    for r in out['units']:
        f.write(f"{r['id']}" + (f" (custom, from {r['base']})" if r.get('base') and r['base'] != r['id'] else '') + ': ' +
                ', '.join(f"{k}={r[k]}" for k, _ in UF if k in r) +
                (f" | MODIFIED: {','.join(r['modified'])}" if r['modified'] else '') +
                (f" | other: {'; '.join(r['otherMods'])}" if r['otherMods'] else '') + '\n')
with open(os.path.join(MAPD, 'objects_abils.txt'), 'w', encoding='utf-8') as f:
    for r in out['abils']:
        f.write(f"{r['id']}" + (f" (custom, from {r['base']})" if r.get('base') and r['base'] != r['id'] else '') +
                f": {r['name']} L{r['levels']} | " + '; '.join(f"{k}={v}" for k, v in r['fields'].items()) +
                (f" | tip: {r['tooltip']}" if r.get('tooltip') else '') + '\n')
    for r in out['items']:
        f.write(f"ITEM {r['id']}: {r['name']} abilities={r['abilities']} mods={r['mods']}\n")
    f.write('UNKNOWN rawcodes: ' + ' '.join(out['unknown']) + '\n')
print(len(out['units']), 'units', len(out['abils']), 'abils', len(out['items']), 'items', 'unknown', out['unknown'])
