#!/usr/bin/env python3
"""Import curated house recipes from real recipe pages (eda.ru JSON-LD).

house_meta.py holds hand-written metadata and condensed Russian steps; this script
fetches each source page, takes the title, ingredients and the real photo URL from
the page's schema.org Recipe and writes scripts/house_recipes.json.
"""
from __future__ import annotations
import json, re, subprocess, sys
from pathlib import Path
from house_meta import HOUSE

OUT = Path(__file__).with_name("house_recipes.json")
UNITS = [
    (r"столов\w* лож\w*", "ст. л."), (r"чайн\w* лож\w*", "ч. л."), (r"штук\w*", "шт."),
    (r"зубч\w*", "зубч."), (r"головк\w*", "головки"), (r"стакан\w*", "стак."),
    (r"щепотк\w*", "щепотка"), (r"пучк\w*|пучок", "пучок"), (r"стеб\w*", "стеб."),
]

def fetch(url: str) -> dict:
    h = subprocess.run(["curl", "-sL", "-m", "30", "-A", "Mozilla/5.0", url], capture_output=True, text=True).stdout
    for m in re.findall(r"<script[^>]*ld\+json[^>]*>(.*?)</script>", h, re.S):
        try:
            d = json.loads(m)
        except ValueError:
            continue
        if d.get("@type") == "Recipe":
            og = re.search(r'property="og:image" content="([^"]+)"', h)
            d["_og"] = og.group(1) if og else None
            return d
    raise RuntimeError(f"no Recipe JSON-LD at {url}")

def measure(q: str) -> str:
    q = q.strip()
    if not q:
        return "по вкусу"
    q = re.sub(r"(\d)\.(\d)", r"\1,\2", q)
    q = q.replace("0,5 ", "½ ").replace("0,25 ", "¼ ")
    for pat, rep in UNITS:
        q = re.sub(pat, rep, q)
    return q

def image_of(d: dict) -> str:
    img = d.get("image")
    if isinstance(img, list) and img:
        img = img[0]
    if isinstance(img, dict):
        img = img.get("url")
    return img or d.get("_og") or ""

def minutes_of(d: dict, fallback: int) -> int:
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", d.get("totalTime") or "")
    if not m:
        return fallback
    v = int(m.group(1) or 0) * 60 + int(m.group(2) or 0)
    return v or fallback

def main() -> int:
    old = {r["id"]: r for r in json.loads(OUT.read_text())} if OUT.exists() else {}
    only = set(sys.argv[1:])
    out = []
    for meta in HOUSE:
        if meta["id"] in old and meta["id"] not in only and old[meta["id"]].get("sourceUrl") == meta["url"]:
            rec = dict(old[meta["id"]])
            rec.update({k: meta[k] for k in ("cuisine", "categories", "protein", "style", "difficulty", "description", "instructions") if k in meta})
            out.append(rec)
            continue
        d = fetch(meta["url"])
        ings, meas = [], []
        for line in d.get("recipeIngredient", []):
            name, _, q = line.partition(",")
            name = name.strip()
            ings.append(name[:1].lower() + name[1:])
            meas.append(measure(q))
        rec = {
            "id": meta["id"],
            "canonicalName": meta.get("name") or d["name"].strip(),
            "cuisine": meta["cuisine"],
            "categories": meta["categories"],
            "protein": meta["protein"],
            "style": meta["style"],
            "difficulty": meta["difficulty"],
            "minutes": meta.get("minutes") or minutes_of(d, 40),
            "servings": str(d.get("recipeYield") or ""),
            "description": meta["description"],
            "ingredients": ings,
            "originalIngredients": ings,
            "measures": meas,
            "instructions": meta["instructions"],
            "imageUrl": image_of(d),
            "sourceUrl": meta["url"],
            "sourceName": "Еда.ру",
        }
        out.append(rec)
        print("ok", rec["id"], rec["canonicalName"])
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print("house recipes:", len(out))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
