"""mpq_inplace.py : replace files inside a WC3 map without rebuilding the archive.

Every original block keeps its raw bytes at its original offset, so files whose names are unknown
(and encrypted with a name-derived key) survive untouched. Replacement files are compressed and
appended after the archive; the hash table is kept, the block table gets the new entries, and both
tables are written after the new data. (attributes) is marked deleted because its CRCs would be stale."""
import struct, sys, zlib
sys.path.insert(0, r"E:\AI\Games\Arcane Arena\docs\wc3-instrumentation")
import mpq

F_EXISTS, F_COMPRESS = 0x80000000, 0x00000200
DELETED = 0xFFFFFFFE


def _blob(data, sector_size):
    nsec = (len(data) + sector_size - 1) // sector_size
    sectors = []
    for i in range(nsec):
        chunk = data[i * sector_size:(i + 1) * sector_size]
        c = zlib.compress(chunk, 9)
        sectors.append(b"\x02" + c if len(c) + 1 < len(chunk) else chunk)
    offs = [(nsec + 1) * 4]
    for s in sectors:
        offs.append(offs[-1] + len(s))
    return struct.pack("<%dI" % (nsec + 1), *offs) + b"".join(sectors)


def patch(arc, out_path, replace, header_name=None):
    """arc: an MPQArchive with names added. replace: {name: bytes} (each name must already exist)."""
    base = arc.base
    out = bytearray(arc.data)
    hashes = [list(e) for e in arc.hash_entries]
    blocks = [list(e) for e in arc.block_entries]
    for name, data in replace.items():
        bi = arc.find_block(name)
        if bi is None:
            raise KeyError(name)
        blob = _blob(bytes(data), arc.sector_size)
        off = len(out) - base
        out += blob
        blocks[bi] = [off, len(blob), len(data), F_EXISTS | F_COMPRESS]
    att = arc.find_block("(attributes)")
    if att is not None:
        for e in hashes:
            if e[3] == att:
                e[3] = DELETED
    ht_raw = b"".join(struct.pack("<4I", *e) for e in hashes)
    bt_raw = b"".join(struct.pack("<4I", *e) for e in blocks)
    ht_off = len(out) - base
    out += mpq.encrypt(ht_raw, mpq.hash_string("(hash table)", 3))
    bt_off = len(out) - base
    out += mpq.encrypt(bt_raw, mpq.hash_string("(block table)", 3))
    struct.pack_into("<4sIIHHIIII", out, base, b"MPQ\x1a", 32, len(out) - base, 0, arc.sector_shift,
                     ht_off, bt_off, len(hashes), len(blocks))
    if header_name is not None and out[:4] == b"HM3W":
        end = out.index(b"\0", 8)
        rest = bytes(out[end + 1:end + 9])
        out[:512] = (b"HM3W\0\0\0\0" + header_name.encode("latin-1") + b"\0" + rest).ljust(512, b"\0")
    open(out_path, "wb").write(out)
    return len(out)
