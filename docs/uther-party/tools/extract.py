import os, sys, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mpq import MPQArchive, STANDARD_NAMES
HERE = os.path.dirname(os.path.abspath(__file__))
BS = chr(92)
MAPS = {
    'up40': r"E:\Games\Warcraft III\Maps\Download\UtherParty 4.0 OFFICIAL.w3x",
    'ultx': r"E:\Games\Warcraft III\Maps\Download\Uther Party vUltima-X.w3x",
}
for key, path in MAPS.items():
    print('==', key, hashlib.sha256(open(path, 'rb').read()).hexdigest()[:16])
    a = MPQArchive(path)
    a.add_known_names(STANDARD_NAMES)
    outdir = os.path.join(HERE, key)
    os.makedirs(outdir, exist_ok=True)
    used = set()
    for n in a.names():
        try:
            b = a.read_file(n)
        except Exception as e:
            print('  FAIL', n, e); continue
        if b is None:
            print('  NONE', n); continue
        info = a.file_info(n)
        used.add(info['block'])
        p = os.path.join(outdir, n.replace(BS, os.sep))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(b)
        print('  %-40s %8d' % (n, len(b)))
    un = [i for i in range(len(a.block_entries)) if i not in used]
    print('  unnamed blocks:', len(un), [a.block_entries[i] for i in un][:20])
    open(os.path.join(outdir, 'map_header_512.bin'), 'wb').write(a.data[:512])
