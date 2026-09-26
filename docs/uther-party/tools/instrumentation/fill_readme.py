"""fill_readme.py README.md : fill the README's generated sections from the research notes.
<!-- TOUR --> ... <!-- /TOUR -->     live tour results (notes/tour.json)
<!-- TABLES --> ... <!-- /TABLES --> all minigames (notes/tables.md)
The markers are kept, so the script can be re-run after new tours."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
NOTES = os.path.join(HERE, "..", "notes")
readme = sys.argv[1]
cat = {e["n"]: e for e in json.load(open(os.path.join(NOTES, "catalog.json"), encoding="utf-8")) if e["map"] == "4.0"}
tour = json.load(open(os.path.join(NOTES, "tour.json"), encoding="utf-8"))
tables = open(os.path.join(NOTES, "tables.md"), encoding="utf-8").read().strip()

rows = []
for k in sorted(tour, key=int):
    t, e = tour[k], cat[int(k)]
    paid = len(t["scores"])
    if t.get("invalid"):
        how = "not valid: " + t["invalid"]
    elif t["end"] == "cap":
        how = "stopped at 150 s"
    else:
        how = "played to the end"
    rows.append(f"| {k} | {e['name']} | {e['type']} | {t['dur']:.0f} s | {how} | {paid} | {t['note']} |")
played = sum(1 for k in tour if 1 <= int(k) <= 52)
tour_md = (f"All {played} Uther Party 4.0 minigames were played with 8 computer contestants and the logging map, one after another "
           "(`-cl tour`, 150 s cap). \"Decided\" is the time from the start to the last payout, or to the last contestant leaving play. "
           "\"Paid\" is how many of the 8 players scored. Computer players are weak at races: in several of them they all died "
           "within seconds, so nobody scored. That is a fact about the bots, not the game.\n\n"
           "| # | Game | Type | Decided | How it ended | Paid | Notes |\n|---|---|---|---|---|---|---|\n" + "\n".join(rows))


def fill(text, name, body):
    pat = re.compile(rf"<!-- {name} -->.*?(<!-- /{name} -->|$)", re.S) if f"<!-- /{name} -->" in text else re.compile(rf"<!-- {name} -->")
    return pat.sub(lambda m: f"<!-- {name} -->\n{body}\n<!-- /{name} -->", text, count=1)


s = open(readme, encoding="utf-8").read()
assert "<!-- TOUR -->" in s and "<!-- TABLES -->" in s
s = fill(s, "TOUR", tour_md)
s = fill(s, "TABLES", tables)
open(readme, "w", encoding="utf-8").write(s)
print("README filled:", len(rows), "tour rows")
