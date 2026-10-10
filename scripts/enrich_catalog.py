#!/usr/bin/env python3
"""Reclassify protein from ingredients and fill descriptions from recipe pages."""
from __future__ import annotations

import gzip
import json
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "data" / "catalog.json"
CACHE = Path("/tmp/dishnext-blurbs.json")

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()

SEASONING = re.compile(
    r"\b(stock|broth|bouillon|cube|powder|sauce|seasoning|dripping|ghee|fat|oil|paste|puree|purée|flavour|flavor|dashi)\b",
    re.I,
)
SKIP_SAUCE = re.compile(r"\b(fish sauce|oyster sauce|worcestershire|soy sauce|hot sauce)\b", re.I)

MEAT_EN = [
    ("chicken", re.compile(r"\b(chicken|turkey|hen)\b", re.I)),
    ("pork", re.compile(r"\b(pork|bacon|pancetta|prosciutto|guanciale|chorizo|lardons?|gammon|kielbasa)\b", re.I)),
    ("pork", re.compile(r"\bham\b", re.I)),
    ("pork", re.compile(r"\bsausages?\b", re.I)),
    ("beef", re.compile(r"\b(beef|steak|brisket|oxtail|veal)\b", re.I)),
    ("fish", re.compile(r"\b(salmon|cod|tuna|trout|mackerel|haddock|sardine|anchov)", re.I)),
    ("fish", re.compile(r"\b(prawn|shrimp|clam|mussel|squid|calamari|scallop|lobster|crab|oyster|fish)\b", re.I)),
]

MEAT_MENTION = {
    "pork": re.compile(r"\b(pork|bacon|ham|chorizo|sausage|pancetta|prosciutto)\b", re.I),
    "chicken": re.compile(r"\b(chicken|turkey)\b", re.I),
    "beef": re.compile(r"\b(beef|steak|brisket)\b", re.I),
    "lamb": re.compile(r"\b(lamb|mutton)\b", re.I),
}


def weight(protein: str, token: str, title: bool) -> int:
    t = token.lower()
    if title:
        return 8
    if protein == "pork" and re.search(r"\b(bacon|ham|pancetta|prosciutto|chorizo|lardon)", t):
        return 2
    if protein == "pork" and "sausage" in t:
        return 3
    if re.search(r"\b(breast|thigh|chop|chops|fillet|shoulder|mince|minced|ground|ribs|wing|wings|liver|leg|legs|whole)\b", t):
        return 6
    return 4


def classify_protein(dish: dict) -> str:
    scores: dict[str, int] = {}
    ings = [*(dish.get("originalIngredients") or []), *(dish.get("ingredients") or [])]
    title = f"{dish.get('originalName') or ''} {dish.get('canonicalName') or ''}"

    def add(p: str, w: int) -> None:
        scores[p] = scores.get(p, 0) + w

    for ing in ings:
        low = ing.lower()
        if SEASONING.search(low) and not re.search(r"\b(chop|chops|breast|thigh|fillet|shoulder|mince)\b", low):
            continue
        if SKIP_SAUCE.search(low):
            continue
        for protein, rx in MEAT_EN:
            if rx.search(low):
                add(protein, weight(protein, low, False))
        if re.search(r"куриц|курочк", low) and "бульон" not in low:
            add("chicken", weight("chicken", low, False))
        if re.search(r"свинин|бекон|ветчин|чоризо|колбас", low):
            add("pork", weight("pork", low, False))
        if "говяд" in low:
            add("beef", weight("beef", low, False))
        if re.search(r"лосос|кревет|миди|тунц|треск|моллюск", low) or (re.search(r"рыб", low) and "соус" not in low):
            add("fish", weight("fish", low, False))

    for protein, rx in MEAT_EN:
        if rx.search(title):
            add(protein, 8)
    if re.search(r"свинин", title, re.I):
        add("pork", 8)
    if re.search(r"куриц|курочк", title, re.I):
        add("chicken", 8)
    if re.search(r"говяд", title, re.I):
        add("beef", 8)
    if re.search(r"рыб|лосос|кревет|миди", title, re.I):
        add("fish", 8)

    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    if ranked and ranked[0][1] > 0:
        top, top_s = ranked[0]
        if len(ranked) > 1 and top_s - ranked[1][1] <= 1 and top == "pork":
            cats = " ".join(dish.get("categories") or []).lower()
            if re.search(r"говяд|морепродукт|рыб", cats):
                return ranked[1][0]
        return top

    cats = " ".join(dish.get("categories") or []).lower()
    all_text = " ".join(ings).lower() + " " + title.lower() + " " + cats
    if re.search(r"\b(lamb|mutton|goat|duck|goose|rabbit|venison)\b", all_text) or re.search(
        r"ягнён|баран|утин|\bутка\b|козел|козля", all_text
    ):
        return "other"
    if "куриц" in cats:
        return "chicken"
    if "свинин" in cats:
        return "pork"
    if "говяд" in cats:
        return "beef"
    if "морепродукт" in cats or "рыб" in cats:
        return "fish"
    if "вегетариан" in cats or "веган" in cats:
        return "veg"
    return "veg"


def classify_style(dish: dict, protein: str) -> str:
    blob = " ".join(dish.get("originalIngredients") or []) + " " + (dish.get("originalName") or "")
    blob = blob.lower()
    hearty_bits = ["stew", "pie", "fried", "bacon", "sausage", "cream", "butter", "cheese", "pastry", "dumpling", "roast", "curry", "hotpot"]
    light_bits = ["salad", "grilled", "steam", "quinoa", "yogurt", "yoghurt", "broccoli", "spinach", "lemon"]
    hearty = sum(1 for w in hearty_bits if w in blob)
    light = sum(1 for w in light_bits if w in blob)
    cats = " ".join(dish.get("categories") or []).lower()
    if re.search(r"вегетариан|веган|закуск", cats) and hearty < 2:
        return "healthy"
    if protein == "pork" and hearty >= 1:
        return "hearty"
    if hearty >= light + 1:
        return "hearty"
    if protein == "chicken" and light >= hearty:
        return "healthy"
    if protein in {"veg", "fish"}:
        return "healthy" if light >= hearty else "hearty"
    return "hearty" if protein == "beef" else "healthy"


def proteins_in_ings(dish: dict) -> set[str]:
    found = set()
    for ing in dish.get("originalIngredients") or []:
        low = ing.lower()
        if SKIP_SAUCE.search(low) or (SEASONING.search(low) and "chop" not in low):
            continue
        for p, rx in MEAT_EN:
            if rx.search(low):
                found.add(p)
        if re.search(r"куриц|курочк", low) and "бульон" not in low:
            found.add("chicken")
        if re.search(r"свинин|бекон|ветчин|чоризо|колбас", low):
            found.add("pork")
        if "говяд" in low:
            found.add("beef")
    title = f"{dish.get('originalName') or ''} {dish.get('canonicalName') or ''}"
    for p, rx in MEAT_EN:
        if rx.search(title):
            found.add(p)
    return found


def verify_blurb(text: str, dish: dict) -> bool:
    if not text or len(text) < 24:
        return False
    present = proteins_in_ings(dish)
    low = text.lower()
    for protein, rx in MEAT_MENTION.items():
        if rx.search(low) and protein not in present and protein != "lamb":
            if protein == "pork" and "pork" not in present:
                return False
            if protein == "chicken" and "chicken" not in present:
                return False
            if protein == "beef" and "beef" not in present:
                return False
    return True


def fetch(url: str) -> str:
    import subprocess

    proc = subprocess.run(
        [
            "curl",
            "-sL",
            "-A",
            UA,
            "--compressed",
            "--max-time",
            "18",
            "-H",
            "Accept: text/html,application/xhtml+xml",
            url,
        ],
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise OSError(proc.stderr.decode("utf-8", "ignore")[:200] or f"curl {proc.returncode}")
    return proc.stdout.decode("utf-8", "ignore")


def extract_description(html: str) -> str:
    for pat in [
        r'property="og:description" content="([^"]+)"',
        r'name="description" content="([^"]+)"',
        r"property='og:description' content='([^']+)'",
    ]:
        m = re.search(pat, html, re.I)
        if m:
            text = unescape(m.group(1))
            text = re.sub(r"\s+", " ", text).strip()
            if 24 <= len(text) <= 400:
                return text
    for m in re.finditer(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S | re.I):
        raw = m.group(1).strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        found: list[str] = []

        def walk(node) -> None:
            if isinstance(node, dict):
                types = node.get("@type")
                types = types if isinstance(types, list) else [types]
                if "Recipe" in types and node.get("description"):
                    found.append(str(node["description"]))
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(data)
        for text in found:
            text = re.sub(r"\s+", " ", unescape(text)).strip()
            if 24 <= len(text) <= 400:
                return text
    return ""


def first_instruction_intro(recipe: dict) -> str:
    return ""


def wiki_summary(title: str) -> str:
    slug = title.replace(" ", "_")
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(slug)}"
    try:
        raw = fetch(url)
        data = json.loads(raw)
        if data.get("type") == "disambiguation":
            return ""
        text = (data.get("extract") or "").strip()
        sentence = re.split(r"(?<=[.!?])\s+", text)[0].strip() if text else ""
        return sentence if 40 <= len(sentence) <= 320 else ""
    except Exception:
        return ""


def meat_phrase(dish: dict, protein: str) -> str:
    blob = " ".join(dish.get("originalIngredients") or []) + " " + " ".join(dish.get("ingredients") or [])
    blob = blob.lower()
    if protein == "pork":
        if re.search(r"chop|отбивн", blob):
            return "свиные отбивные"
        if re.search(r"mince|minced|ground|фарш", blob):
            return "свиной фарш"
        if re.search(r"ribs|рёбр|ребер", blob):
            return "свиные рёбра"
        if re.search(r"shoulder|лопатк", blob):
            return "свиную лопатку"
        if re.search(r"\bbacon\b|бекон", blob) and not re.search(r"\bpork\b|свинин", blob):
            return "бекон"
        if re.search(r"chorizo|чоризо", blob) and not re.search(r"\bpork\b|свинин", blob):
            return "чоризо"
        if re.search(r"sausage|колбас", blob) and not re.search(r"\bpork\b|свинин", blob):
            return "колбаски"
        return "свинину"
    if protein == "chicken":
        if re.search(r"liver|печен", blob):
            return "куриную печень"
        if re.search(r"wing|крыл", blob):
            return "куриные крылья"
        if re.search(r"thigh|бедр", blob):
            return "куриные бёдра"
        if re.search(r"breast|грудк", blob):
            return "куриную грудку"
        if re.search(r"leg|ножк", blob):
            return "куриные ножки"
        return "курицу"
    if protein == "beef":
        if re.search(r"fillet|вырезк", blob):
            return "говяжью вырезку"
        if re.search(r"mince|minced|ground|фарш", blob):
            return "говяжий фарш"
        return "говядину"
    if protein == "fish":
        if re.search(r"salmon|лосос", blob):
            return "лосось"
        if re.search(r"prawn|shrimp|кревет", blob):
            return "креветки"
        if re.search(r"\bclams?\b|моллюск", blob):
            return "моллюски"
        if re.search(r"mussel|миди", blob):
            return "мидии"
        if re.search(r"\bcod\b|треск", blob):
            return "треску"
        return "рыбу"
    return ""


STAPLE = re.compile(r"^(соль|сахар|вода|salt|sugar|water|масло|oil|olive oil|оливковое масло|растительное масло|перец|pepper)$", re.I)


def heroes(dish: dict, protein: str, limit=3) -> list[str]:
    skip = {
        "chicken": ("кури", "курочк", "chicken"),
        "pork": ("свин", "бекон", "ветчин", "чоризо", "колбас", "pork", "bacon", "chorizo", "sausage"),
        "beef": ("говяд", "beef", "steak"),
        "fish": ("рыб", "лосос", "кревет", "миди", "fish", "salmon", "prawn", "shrimp", "clam"),
    }.get(protein, ())
    out = []
    seen = set()
    for name in dish.get("ingredients") or []:
        n = name.strip()
        low = n.lower()
        if not n or STAPLE.match(low):
            continue
        if any(s in low for s in skip):
            continue
        if low in seen:
            continue
        seen.add(low)
        out.append(n)
        if len(out) >= limit:
            break
    return out


def kind_of(dish: dict, en: str) -> str:
    blob = f"{dish.get('originalName') or ''} {dish.get('canonicalName') or ''} {en}".lower()
    if re.search(r"salad|салат", blob):
        return "салат"
    if re.search(r"soup|chowder|суп", blob):
        return "суп"
    if re.search(r"pie|пирог", blob):
        return "пирог"
    if re.search(r"curry|карри", blob):
        return "карри"
    if re.search(r"stew|hotpot|рагу|casserole", blob):
        return "рагу"
    if re.search(r"taco", blob):
        return "тако"
    if re.search(r"burger|sandwich|сэндвич", blob):
        return "сэндвич"
    if re.search(r"noodle|лапш", blob):
        return "лапша"
    if re.search(r"pasta|spaghetti|lasagna|паста|лазанья", blob):
        return "паста"
    if re.search(r"rice|рис|paella|risotto|плов", blob):
        return "рис"
    return ""


def grounded_ru(dish: dict, protein: str, source_en: str = "") -> str:
    # Empty description → the client writes method + actual meat from ingredients.
    return ""


def ru_from_en(en: str, dish: dict, protein: str) -> str:
    """Short Russian line grounded in the recipe. Uses the source sentence as a hint, not as a meat oracle."""
    return grounded_ru(dish, protein, en)


def load_cache() -> dict:
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    return {}


def save_cache(cache: dict) -> None:
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def source_text(dish: dict, recipe: dict | None, cache: dict) -> str:
    url = (dish.get("sourceUrl") or "").strip()
    key = dish["id"]
    if key in cache and cache[key].get("text") and not str(cache[key].get("src", "")).startswith("err") and cache[key].get("src") not in {"intro", ""}:
        return cache[key].get("text") or ""
    text = ""
    src = ""
    if url and "instagram.com" not in url:
        try:
            html = fetch(url)
            text = extract_description(html)
            src = "page"
        except Exception as e:
            text = ""
            src = f"err:{type(e).__name__}"
    if not text and recipe:
        intro = first_instruction_intro(recipe)
        if intro:
            text, src = intro, "intro"
    if not text:
        orig = dish.get("originalName") or ""
        if orig and len(orig.split()) <= 4:
            wiki = wiki_summary(orig)
            if wiki:
                text, src = wiki, "wiki"
    cache[key] = {"url": url, "text": text, "src": src, "name": dish.get("originalName")}
    return text


def main() -> None:
    catalog = json.loads(CATALOG.read_text())
    recipes = {r["dishId"]: r for r in catalog.get("recipes") or []}
    cache = load_cache()
    changed_protein = []
    for i, dish in enumerate(catalog["dishes"]):
        old_p = dish.get("protein")
        protein = classify_protein(dish)
        style = classify_style(dish, protein)
        dish["protein"] = protein
        dish["style"] = style
        if old_p != protein:
            changed_protein.append((dish["canonicalName"], old_p, protein, dish.get("originalName")))
        en = source_text(dish, recipes.get(dish["id"]), cache)
        if (i + 1) % 10 == 0:
            save_cache(cache)
            print(f"fetched {i + 1}/{len(catalog['dishes'])}", flush=True)
        if en and verify_blurb(en, dish):
            dish["sourceBlurb"] = en
            dish["description"] = ru_from_en(en, dish, protein)
        else:
            dish.pop("sourceBlurb", None)
            dish["description"] = grounded_ru(dish, protein)
        time.sleep(0.15)
    save_cache(cache)
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print("protein changes", len(changed_protein))
    for row in changed_protein:
        print(f"  {row[1]:8} -> {row[2]:8}  {row[0]}  ({row[3]})")
    with_src = sum(1 for d in catalog["dishes"] if d.get("sourceBlurb"))
    print("source blurbs kept", with_src)
    print("wrote", CATALOG)


if __name__ == "__main__":
    main()
