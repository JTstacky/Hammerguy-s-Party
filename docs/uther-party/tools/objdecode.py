"""Decode WC3 object-editor data (w3u/w3t/w3a/w3h/w3q) into JSON with
human field names and base-object values from the game SLK/TXT tables."""
import json, os, re, struct, glob

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, 'game')
MAPD = os.path.join(HERE, 'map')


# ---------------------------------------------------------------- SLK / TXT
def parse_slk(path):
    rows = {}
    x = y = 0
    maxx = 0
    with open(path, 'rb') as f:
        text = f.read().decode('latin-1')
    for line in text.splitlines():
        if not line.startswith('C;'):
            continue
        parts = line.split(';')
        val = None
        i = 1
        while i < len(parts):
            p = parts[i]
            if p.startswith('X'):
                x = int(p[1:])
            elif p.startswith('Y'):
                y = int(p[1:])
            elif p.startswith('K'):
                val = ';'.join(parts[i:])[1:]
                break
            i += 1
        if val is None:
            continue
        if val.startswith('"') and val.endswith('"') and len(val) >= 2:
            val = val[1:-1]
        else:
            try:
                val = int(val)
            except ValueError:
                try:
                    val = float(val)
                except ValueError:
                    pass
        rows.setdefault(y, {})[x] = val
    header = rows.get(1, {})
    cols = {xx: str(name) for xx, name in header.items()}
    table = {}
    keycol = min(cols)
    for yy, r in rows.items():
        if yy == 1:
            continue
        key = r.get(keycol)
        if key is None:
            continue
        table[str(key)] = {cols[xx]: v for xx, v in r.items() if xx in cols}
    return table


def parse_txt(paths):
    out = {}
    for path in paths:
        if not os.path.exists(path):
            continue
        sec = None
        for line in open(path, 'rb').read().decode('latin-1').splitlines():
            line = line.strip()
            if not line or line.startswith('//'):
                continue
            if line.startswith('[') and ']' in line:
                sec = line[1:line.index(']')]
                out.setdefault(sec, {})
            elif '=' in line and sec is not None:
                k, v = line.split('=', 1)
                out[sec].setdefault(k.strip(), v.strip())
    return out


def load_strings():
    s = {}
    for p in [os.path.join(GAME, 'UI', 'WorldEditStrings.txt'), os.path.join(GAME, 'UI', 'WorldEditGameStrings.txt')]:
        for sec, kv in parse_txt([p]).items():
            s.update(kv)
    return s


def load_wts(path):
    d = {}
    if not os.path.exists(path):
        return d
    t = open(path, 'rb').read().decode('utf-8', 'replace').lstrip('﻿')
    for m in re.finditer(r'STRING\s+(\d+)\s*(?://[^\n]*\n)?\s*\{\r?\n(.*?)\r?\n\}', t, re.S):
        d['TRIGSTR_%03d' % int(m.group(1))] = m.group(2)
    return d


# -------------------------------------------------------------- object files
def read_objfile(path, with_levels):
    data = open(path, 'rb').read()
    pos = 0

    def u32():
        nonlocal pos
        v = struct.unpack_from('<I', data, pos)[0]; pos += 4; return v

    def i32():
        nonlocal pos
        v = struct.unpack_from('<i', data, pos)[0]; pos += 4; return v

    def f32():
        nonlocal pos
        v = struct.unpack_from('<f', data, pos)[0]; pos += 4; return v

    def id4():
        nonlocal pos
        v = data[pos:pos + 4]; pos += 4
        return v.decode('latin-1') if v != b'\0\0\0\0' else None

    def cstr():
        nonlocal pos
        e = data.index(b'\0', pos)
        v = data[pos:e].decode('utf-8', 'replace'); pos = e + 1; return v

    version = u32()
    tables = {}
    for tname in ('original', 'custom'):
        n = u32()
        objs = []
        for _ in range(n):
            base = id4(); new = id4()
            nm = u32()
            mods = []
            for _ in range(nm):
                fid = id4()
                typ = u32()
                lvl = dp = None
                if with_levels:
                    lvl = u32(); dp = u32()
                if typ == 0:
                    val = i32()
                elif typ in (1, 2):
                    val = round(f32(), 6)
                elif typ == 3:
                    val = cstr()
                else:
                    raise ValueError('bad type %d at %d' % (typ, pos))
                end = id4()
                m = {'field': fid, 'type': ['int', 'real', 'unreal', 'string'][typ], 'value': val}
                if with_levels:
                    m['level'] = lvl
                    m['data'] = dp
                mods.append(m)
            objs.append({'base': base, 'id': new or base, 'mods': mods})
        tables[tname] = objs
    assert pos == len(data), (pos, len(data))
    return version, tables


# ---------------------------------------------------------- base value lookup
class UnitDB:
    def __init__(self):
        g = lambda n: parse_slk(os.path.join(GAME, 'Units', n))
        self.meta = g('UnitMetaData.slk')
        self.slks = {
            'UnitBalance': g('UnitBalance.slk'), 'UnitData': g('UnitData.slk'),
            'UnitUI': g('UnitUI.slk'), 'UnitWeapons': g('UnitWeapons.slk'),
            'UnitAbilities': g('UnitAbilities.slk'), 'ItemData': g('ItemData.slk'),
        }
        txts = glob.glob(os.path.join(GAME, 'Units', '*Unit*.txt')) + glob.glob(os.path.join(GAME, 'Units', 'Item*.txt'))
        self.profile = parse_txt(sorted(txts))

    def base_value(self, base, fid):
        m = self.meta.get(fid)
        if not m:
            return None
        slk = m.get('slk'); field = m.get('field')
        if slk == 'Profile':
            v = self.profile.get(base, {}).get(field)
            idx = m.get('index', -1)
            if v is not None and isinstance(idx, int) and idx >= 0:
                parts = v.split(',')
                v = parts[idx] if idx < len(parts) else None
            return v
        t = self.slks.get(slk)
        if t is None:
            return None
        return t.get(base, {}).get(field)


class AbilDB:
    def __init__(self):
        g = lambda n: parse_slk(os.path.join(GAME, 'Units', n))
        self.meta = g('AbilityMetaData.slk')
        self.slks = {'AbilityData': g('AbilityData.slk'), 'AbilityBuffData': g('AbilityBuffData.slk')}
        txts = glob.glob(os.path.join(GAME, 'Units', '*Ability*.txt'))
        self.profile = parse_txt(sorted(txts))

    def base_value(self, base, fid, level):
        m = self.meta.get(fid)
        if not m:
            return None
        slk = m.get('slk'); field = m.get('field')
        data = m.get('data', 0) or 0
        rep = m.get('repeat', 0) or 0
        if slk == 'Profile':
            v = self.profile.get(base, {}).get(field)
            if v is not None and rep and level:
                parts = v.split(',')
                v = parts[level - 1] if level - 1 < len(parts) else parts[-1]
            return v
        t = self.slks.get(slk)
        if t is None:
            return None
        col = field
        if data:
            col += 'ABCDEFGHI'[data - 1]
        if rep and level:
            col += str(level)
        return t.get(base, {}).get(col)


def main():
    wes = load_strings()
    wts = load_wts(os.path.join(MAPD, 'war3map.wts'))

    def tr(v):
        if isinstance(v, str):
            v2 = wts.get(v, v)
            return wes.get(v2, v2) if v2.startswith('WESTRING') else v2
        return v

    udb = UnitDB()
    adb = AbilDB()
    out = {}
    for fname, levels, kind in [('war3map.w3u', False, 'unit'), ('war3map.w3t', False, 'unit'),
                                ('war3map.w3a', True, 'abil'), ('war3map.w3h', False, 'buff'),
                                ('war3map.w3q', True, 'upgrade')]:
        p = os.path.join(MAPD, fname)
        if not os.path.exists(p):
            continue
        ver, tables = read_objfile(p, levels)
        res = {'version': ver}
        for tname, objs in tables.items():
            lst = []
            for o in objs:
                mods = []
                for m in o['mods']:
                    fid = m['field']
                    if kind == 'unit':
                        meta = udb.meta.get(fid, {})
                        base = udb.base_value(o['base'], fid)
                    elif kind == 'abil':
                        meta = adb.meta.get(fid, {})
                        base = adb.base_value(o['base'], fid, m.get('level'))
                    else:
                        meta = {}
                        base = None
                    e = {'field': fid, 'name': meta.get('field'),
                         'display': tr(meta.get('displayName')) if meta.get('displayName') else None,
                         'slk': meta.get('slk'), 'value': tr(m['value']), 'base_value': base}
                    if 'level' in m:
                        e['level'] = m['level']
                        if m.get('data'):
                            e['data_index'] = m['data']
                    mods.append(e)
                lst.append({'base': o['base'], 'id': o['id'], 'mods': mods})
            res[tname] = lst
        out[fname] = res
        with open(os.path.join(HERE, fname.replace('.', '_') + '.json'), 'w', encoding='utf-8') as f:
            json.dump(res, f, indent=1, ensure_ascii=False)
    return out, udb, adb


if __name__ == '__main__':
    out, udb, adb = main()
    for fn, res in out.items():
        for tname in ('original', 'custom'):
            for o in res.get(tname, []):
                print(fn, tname, o['base'], '->', o['id'], len(o['mods']), 'mods')
