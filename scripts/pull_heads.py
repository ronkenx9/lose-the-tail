"""Pull zkSNARKs art from zilkroad.com, downscale 520->26 (exact 20x pixel grid), pack an atlas.
Art credit: zkSNARKs (zksnarks.net / zilkroad.com)."""
import json, random, time, urllib.request, io, os
UA={"User-Agent":"Mozilla/5.0 (lose-the-tail asset pull; credit zkSNARKs)"}
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA)).read()
from PIL import Image

BASE = "https://zilkroad.com"
tokens = json.loads(get(BASE + "/api/market/tokens"))["tokens"]
random.seed(7)

def pick(pred, n=1):
    c = [t for t in tokens if pred(t["traits"])]
    random.shuffle(c)
    return c[:n]

T = lambda k, v: (lambda tr: tr.get(k) == v)
roles = {
    "you_bare":   pick(lambda tr: tr["Lineage"] == "Bare" and tr["Head"] == "None" and tr["Skin"] in ("Earthtone", "Latte", "Brown", "Mocha")),
    "you_hood":   pick(lambda tr: tr["Lineage"] == "Bare" and tr["Head"] == "Hoodie"),
    "you_zk":     pick(T("Lineage", "Zero-Knowledge")),
    "saint_zero": pick(T("Head", "Saint Zero")),
    "tailor":     pick(lambda tr: tr["Head"] == "Recon" and tr["Lineage"] in ("Noir", "Obsidian", "Skele", "Corrosive", "Zombie")),
    "courier":    pick(T("Head", "Courier")),
    "cafe":       pick(T("Head", "Node Captain")),
    "friend":     pick(T("Lineage", "Gemini")),
    "landlord":   pick(lambda tr: tr["Head"] == "Maxi" and tr["Lineage"] in ("Dune", "Bare")),
    "miner":      pick(T("Head", "Miner")),
}
lookouts = pick(T("Head", "Recon"), 6)
used = {t["id"] for v in roles.values() for t in v} | {t["id"] for t in lookouts}
crowd = [t for t in pick(lambda tr: tr["Head"] != "Recon", 200) if t["id"] not in used][:42]

entries = []
for role, ts in roles.items():
    for t in ts: entries.append((role, t))
for t in lookouts: entries.append(("lookout", t))
for t in crowd: entries.append(("crowd", t))

COLS = 8
rows = (len(entries) + COLS - 1) // COLS
atlas = Image.new("RGBA", (COLS * 26, rows * 26), (0, 0, 0, 0))
meta = []
for i, (role, t) in enumerate(entries):
    raw = get(BASE + f"/api/art/{t['id']}")
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    # sample pixel centres of the 20x grid (exact, no resampling blur)
    small = Image.new("RGBA", (26, 26))
    px = im.load(); sp = small.load()
    for y in range(26):
        for x in range(26):
            r, g, b, a = px[x * 20 + 10, y * 20 + 10]
            # background is pure black -> transparent
            sp[x, y] = (r, g, b, 0) if (r, g, b) == (0, 0, 0) else (r, g, b, 255)
    atlas.paste(small, ((i % COLS) * 26, (i // COLS) * 26))
    meta.append({"i": i, "id": t["id"], "role": role, "traits": t["traits"]})
    time.sleep(0.15)
atlas.save("public/heads/atlas.png")
json.dump({"cols": COLS, "size": 26, "count": len(meta), "credit": "zkSNARKs — zksnarks.net / zilkroad.com", "heads": meta},
          open("src/data/heads.json", "w"), indent=1)
print(len(meta), "heads;", {r: [t["id"] for t in v] for r, v in roles.items()})
