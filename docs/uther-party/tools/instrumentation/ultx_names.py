"""ultx_names.py : file names for Uther Party vUltima-X, whose archive has no (listfile).
names() returns every name that resolves to a block; run it to see coverage."""
import os, sys
sys.path.insert(0, r"E:\AI\Games\Arcane Arena\docs\wc3-instrumentation")
import mpq

BS = chr(92)
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = r"E:\Games\Warcraft III\Maps\Download\Uther Party vUltima-X.w3x"
GUESS = ["(attributes)", "(signature)", "war3map.w3u", "war3map.w3a", "war3map.w3t", "war3map.w3h", "war3map.w3q", "war3map.imp",
         "war3map.wct", "war3map.wtg", "war3map.w3r", "war3map.w3c", "war3map.w3s", "war3mapImported.txt",
         "Units/UpgradeData.slk", "Units/AbilityBuffData.slk", "Units/UnitMetaData.slk", "Units/AbilityMetaData.slk",
         "Units/DestructableData.slk", "Units/DestructableMetaData.slk", "Doodads/Doodads.slk", "Units/MiscData.txt",
         "Units/MiscGame.txt", "UI/MiscData.txt", "Units/UnitGlobalStrings.txt", "Units/CommandFunc.txt",
         "Units/CommandStrings.txt", "UI/WorldEditStrings.txt", "Scripts/Blizzard.j", "Scripts/common.j", "war3map.j"]


def names(arc=None):
    arc = arc or mpq.MPQArchive(SRC)
    arc.add_known_names(mpq.STANDARD_NAMES)
    extra = ["Units" + BS + f for f in os.listdir(os.path.join(HERE, "..", "ultx", "Units"))]
    extra += [g.replace("/", BS) for g in GUESS]
    arc.add_known_names(extra)
    return arc, arc.names()


if __name__ == "__main__":
    arc, ns = names()
    used = {arc.find_block(x) for x in ns}
    print(len(ns), "names cover", len(used), "of", len(arc.block_entries), "blocks")
    un = [i for i in range(len(arc.block_entries)) if i not in used]
    print("unnamed:", [(i, arc.block_entries[i]) for i in un])
