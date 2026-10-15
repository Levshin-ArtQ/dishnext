#!/usr/bin/env python3
"""House recipes (house_recipes.json) → catalog dishes/recipes; photo thumbs from the source photo."""
from __future__ import annotations
import json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(__file__).with_name("house_recipes.json")
THUMBS = ROOT / "public" / "thumbs"

RU_ALLERGENS = [
    ("глютен", ["мука", "хлеб", "паста", "спагетти", "лапш", "пенне", "феттучини", "лаваш", "тортиль", "сухар", "булгур", "кускус", "соевый соус", "удон", "батон", "орзо", "панко", "макарон"]),
    ("молоко", ["молок", "сыр", "сливк", "сливочн", "йогурт", "сметан", "пармезан", "моцарел", "фета", "рикотт", "кефир", "пекорино", "мацони", "творо"]),
    ("яйца", ["яйц", "яичн", "желток", "майонез"]),
    ("рыба", ["рыб", "треск", "сибас", "дорад", "лосос", "тунец", "тунц", "хек", "форел", "анчоус", "минтай", "семг"]),
    ("моллюски", ["кревет", "кальмар", "мид", "краб"]),
    ("орехи", ["орех", "кедров", "миндал", "кешью", "фисташ", "фундук"]),
    ("арахис", ["арахис"]),
    ("соя", ["соев", "тофу", "мисо"]),
    ("кунжут", ["кунжут"]),
    ("горчица", ["горчиц"]),
    ("сельдерей", ["сельдер"]),
]

def allergens(ings):
    blob = " ".join(ings).lower()
    return [lab for lab, keys in RU_ALLERGENS if any(k in blob for k in keys)]

def load():
    return json.loads(SRC.read_text()) if SRC.exists() else []

def convert(raw):
    dish_id, recipe_id = f"house_{raw['id']}", f"recipe_house_{raw['id']}"
    local = THUMBS / f"house-{raw['id']}.jpg"
    image = f"/thumbs/house-{raw['id']}.jpg" if local.exists() else raw["imageUrl"]
    dish = {
        "id": dish_id, "canonicalName": raw["canonicalName"], "originalName": raw["canonicalName"],
        "aliases": [raw["canonicalName"]], "cuisine": raw["cuisine"], "categories": raw["categories"],
        "description": raw["description"], "imageUrl": image, "sourceImageUrl": raw["imageUrl"],
        "ingredients": raw["ingredients"], "originalIngredients": raw["originalIngredients"],
        "allergens": allergens(raw["ingredients"]), "preparationMinutes": raw["minutes"],
        "difficulty": raw["difficulty"], "budget": "low", "style": raw["style"], "protein": raw["protein"],
        "isNew": True, "recipeIds": [recipe_id], "source": "house", "sourceId": raw["id"],
        "sourceUrl": raw["sourceUrl"],
        "imageLicense": f"Фото со страницы рецепта ({raw.get('sourceName','источник')}); права у автора.",
        "attribution": f"Рецепт: {raw.get('sourceName','источник')} ({raw['sourceUrl']}). Шаги сокращены и пересказаны на русском.",
    }
    recipe = {
        "id": recipe_id, "dishId": dish_id, "title": raw["canonicalName"], "ingredients": raw["ingredients"],
        "measures": raw["measures"], "instructions": raw["instructions"], "sourceUrl": raw["sourceUrl"], "language": "ru",
    }
    return dish, recipe

def house_catalog():
    ds, rs = [], []
    for raw in load():
        d, r = convert(raw)
        ds.append(d); rs.append(r)
    return ds, rs

def fetch_thumbs():
    from PIL import Image
    THUMBS.mkdir(parents=True, exist_ok=True)
    bad = []
    for raw in load():
        sm, md = THUMBS / f"house-{raw['id']}.jpg", THUMBS / f"house-{raw['id']}-md.jpg"
        if sm.exists() and md.exists():
            continue
        tmp = THUMBS / f".raw-house-{raw['id']}"
        r = subprocess.run(["curl", "-fsSL", "-m", "30", "-A", "Mozilla/5.0", "-o", str(tmp), raw["imageUrl"]])
        try:
            with Image.open(tmp) as im:
                im = im.convert("RGB")
                for dest, w, q in ((md, 540, 72), (sm, 180, 62)):
                    c = im.copy(); c.thumbnail((w, int(w * 1.4)), Image.Resampling.LANCZOS)
                    c.save(dest, "JPEG", quality=q, optimize=True, progressive=True)
        except Exception as e:  # noqa: BLE001
            bad.append(f"{raw['id']}: {e} (curl {r.returncode})")
        finally:
            tmp.unlink(missing_ok=True)
    return bad
