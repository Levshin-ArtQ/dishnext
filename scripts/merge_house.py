#!/usr/bin/env python3
"""Merge house recipes into the existing public/data/catalog.json without a TheMealDB dump.

Keeps every existing dish/recipe, replaces previous house_* entries, downloads
thumbs from the recipe's own photo and re-applies catalog overrides.
"""
from __future__ import annotations
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from house_lib import house_catalog, fetch_thumbs, ROOT

CATALOG = ROOT / "public" / "data" / "catalog.json"

def main() -> int:
    bad = fetch_thumbs()
    for b in bad:
        print("thumb fail", b, file=sys.stderr)
    cat = json.loads(CATALOG.read_text())
    ds, rs = house_catalog()
    cat["dishes"] = [d for d in cat["dishes"] if d.get("source") != "house"] + ds
    cat["recipes"] = [r for r in cat["recipes"] if not r["id"].startswith("recipe_house_")] + rs
    cat["dishes"].sort(key=lambda d: (d["cuisine"], d["canonicalName"]))
    try:
        from overrides_lib import apply_overrides
        cat = apply_overrides(cat)
    except ImportError:
        pass
    if "+house" not in cat.get("source", ""):
        cat["source"] = cat.get("source", "") + "+house"
    CATALOG.write_text(json.dumps(cat, ensure_ascii=False, indent=2))
    print(f"catalog dishes={len(cat['dishes'])} house={len(ds)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
