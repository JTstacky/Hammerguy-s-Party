"""gen_guide.py : build the Uther Party field guide page (one self-contained HTML file) from
notes/catalog.json, the arena renders (up40/arenas/*.png) and the live tour summary (notes/tour.json if present)."""
import base64, io, json, os, re
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
UP = os.path.join(HERE, "..")
OUT = os.path.join(UP, "..", "site", "uther-party-field-guide.html")
cat = json.load(open(os.path.join(UP, "notes", "catalog.json"), encoding="utf-8"))
tour_p = os.path.join(UP, "notes", "tour.json")
tour = json.load(open(tour_p, encoding="utf-8")) if os.path.exists(tour_p) else {}

# arena images for 4.0 games: match region names to game names by word overlap
arena_dir = os.path.join(UP, "up40", "arenas")
def words(s):
    return set(w for w in re.split(r"[^a-z]+", s.lower()) if w and w not in ("the", "of", "a", "s"))
regions = {f[:-4]: words(f[:-4].replace("_", " ")) for f in os.listdir(arena_dir) if f.endswith(".png")}
imgs = {}
for e in cat:
    if e["map"] != "4.0":
        continue
    gw = words(e["name"])
    best = max(regions.items(), key=lambda kv: (len(kv[1] & gw) / len(kv[1]), len(kv[1] & gw)))
    if best[1] and best[1] <= gw | {"crew", "clean"} and len(best[1] & gw) == len(best[1]):
        im = Image.open(os.path.join(arena_dir, best[0] + ".png")).convert("RGB")
        w, h = im.size
        im = im.crop((0, 18, w, h))  # drop the caption strip
        im.thumbnail((360, 360))
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=72)
        imgs[e["n"]] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
print("arena images matched:", len(imgs))

SHORT = {("4.0", 22), ("4.0", 19), ("4.0", 20), ("4.0", 18), ("4.0", 24), ("4.0", 29), ("4.0", 37), ("4.0", 21),
         ("ultx", 66), ("ultx", 65), ("ultx", 69), ("ultx", 58)}
games = []
for e in sorted(cat, key=lambda e: (e["map"] != "4.0", e["n"])):
    g = {k: e[k] for k in ("n", "map", "name", "variants", "type", "timer", "goal", "core", "controls", "hazard", "key_numbers", "bots", "remake_fit", "hp_match", "bugs")}
    g["short"] = (e["map"], e["n"]) in SHORT
    g["img"] = imgs.get(e["n"]) if e["map"] == "4.0" else None
    t = tour.get(str(e["n"])) if e["map"] == "4.0" else None
    if t:
        g["live"] = t
    games.append(g)

data = json.dumps(games, ensure_ascii=False, separators=(",", ":"))
html = open(os.path.join(HERE, "guide_template.html"), encoding="utf-8").read()
html = html.replace("/*__DATA__*/[]", data)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(html)
print("wrote", OUT, len(html) // 1024, "KB")
