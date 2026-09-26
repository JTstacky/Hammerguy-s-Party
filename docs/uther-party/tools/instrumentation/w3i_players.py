"""w3i_players.py : read (and optionally patch) the player/force records of a TFT war3map.w3i (version 25).
players(data) -> (flags, flag_offset, [dict(num, type, type_off, race, fixed, name, ...)], forces)"""
import struct, sys


def players(data):
    pos = 0

    def i():
        nonlocal pos
        v = struct.unpack_from('<i', data, pos)[0]; pos += 4; return v

    def s():
        nonlocal pos
        e = data.index(b'\0', pos); v = data[pos:e].decode('utf-8', 'replace'); pos = e + 1; return v

    ver = i(); assert ver == 25, ver
    i(); i()
    s(); s(); s(); s()
    pos += 8 * 4 + 4 * 4 + 8
    flag_off = pos
    flags = i()
    pos += 1
    i(); s(); s(); s(); s()
    i(); s(); s(); s(); s()
    i(); pos += 12 + 4
    pos += 4
    s(); pos += 1 + 4
    out = []
    for _ in range(i()):
        p = {'num': i(), 'type_off': pos}
        p['type'] = i(); p['race'] = i(); p['fixed'] = i(); p['name'] = s()
        pos += 8
        p['ally_low'] = i(); p['ally_high'] = i()
        out.append(p)
    forces = []
    for _ in range(i()):
        fo = pos
        fl = i(); mask = i(); name = s()
        forces.append({'flag_off': fo, 'flags': fl, 'players': [k for k in range(32) if mask & (1 << k)], 'name': name})
    return flags, flag_off, out, forces


if __name__ == '__main__':
    d = open(sys.argv[1], 'rb').read()
    flags, fo, ps, fs = players(d)
    print('flags', hex(flags))
    for p in ps:
        print(p)
    for f in fs:
        print(f)
