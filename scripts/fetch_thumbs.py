#!/usr/bin/env python3
"""Download TheMealDB meal photos and write same-origin thumbs."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "data" / "catalog.json"
OUT = ROOT / "public" / "thumbs"
UA = "Mozilla/5.0 (DishNext thumbs)"
MEAL_RE = re.compile(r"/meals/([^/?]+)\.(jpg|jpeg|png|webp)$", re.I)


def curl(url: str, dest: Path, timeout: int = 18) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    cmd = [
        "curl",
        "-fsSL",
        "--retry",
        "2",
        "--retry-delay",
        "1",
        "-m",
        str(timeout),
        "-A",
        UA,
        "-o",
        str(tmp),
        url,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and tmp.exists() and tmp.stat().st_size > 400:
            tmp.replace(dest)
            return True
    except OSError:
        pass
    if tmp.exists():
        tmp.unlink(missing_ok=True)
    return False


def weserv(meal_url: str, width: int) -> str:
    host = meal_url.replace("https://", "").replace("http://", "")
    return f"https://images.weserv.nl/?url={host}&w={width}&output=jpg&q=72"


def stem_of(url: str) -> str | None:
    m = MEAL_RE.search(url.split("?")[0])
    return m.group(1) if m else None


def save_jpeg(im: Image.Image, dest: Path, max_w: int, quality: int) -> None:
    img = im.copy()
    img.thumbnail((max_w, int(max_w * 1.4)), Image.Resampling.LANCZOS)
    if img.mode != "RGB":
        img = img.convert("RGB")
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)


def process(url: str) -> str:
    stem = stem_of(url)
    if not stem:
        return f"skip-name {url}"
    sm = OUT / f"{stem}.jpg"
    md = OUT / f"{stem}-md.jpg"
    if sm.exists() and sm.stat().st_size > 400 and md.exists() and md.stat().st_size > 400:
        return f"cached {stem}"
    raw = OUT / f".raw-{stem}.jpg"
    ok = (
        curl(f"{url}/medium", raw, 16)
        or curl(f"{url}/small", raw, 12)
        or curl(weserv(f"{url}/medium", 540), raw, 20)
        or curl(weserv(url, 540), raw, 20)
    )
    if not ok:
        return f"fail {stem}"
    try:
        with Image.open(raw) as im:
            im.load()
            if not md.exists() or md.stat().st_size < 400:
                save_jpeg(im, md, 540, 72)
            if not sm.exists() or sm.stat().st_size < 400:
                save_jpeg(im, sm, 180, 62)
    except OSError as e:
        return f"decode {stem} {e}"
    finally:
        raw.unlink(missing_ok=True)
    return f"ok {stem}"


def main() -> int:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    urls = [
        d["imageUrl"]
        for d in data["dishes"]
        if d.get("imageUrl") and "themealdb.com" in d["imageUrl"]
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    ok = fail = cached = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(process, u) for u in urls]
        for fut in as_completed(futs):
            msg = fut.result()
            if msg.startswith("ok"):
                ok += 1
            elif msg.startswith("cached"):
                cached += 1
            else:
                fail += 1
                print(msg, file=sys.stderr)
    sm = list(OUT.glob("*.jpg"))
    sm = [p for p in sm if not p.name.endswith("-md.jpg") and not p.name.startswith(".raw")]
    md = list(OUT.glob("*-md.jpg"))
    print(f"thumbs small={len(sm)} medium={len(md)} new={ok} cached={cached} fail={fail}")
    return 0 if fail == 0 and len(sm) >= 50 else 1


if __name__ == "__main__":
    raise SystemExit(main())
