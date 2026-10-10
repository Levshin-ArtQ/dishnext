"""Merge human catalog edits from public/data/overrides.json onto a catalog dict."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OVERRIDES = ROOT / "public" / "data" / "overrides.json"

DISH_KEYS = (
    "canonicalName",
    "description",
    "ingredients",
    "cuisine",
    "categories",
    "aliases",
    "allergens",
)
RECIPE_KEYS = ("title", "ingredients", "instructions")


def load_overrides() -> dict[str, Any]:
    if not OVERRIDES.exists():
        return {"version": 1, "dishes": {}, "recipes": {}}
    data = json.loads(OVERRIDES.read_text())
    if not isinstance(data, dict):
        return {"version": 1, "dishes": {}, "recipes": {}}
    data.setdefault("dishes", {})
    data.setdefault("recipes", {})
    return data


def apply_overrides(catalog: dict[str, Any], overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    data = overrides or load_overrides()
    dish_patches = data.get("dishes") or {}
    recipe_patches = data.get("recipes") or {}
    for dish in catalog.get("dishes") or []:
        patch = dish_patches.get(dish.get("id"))
        if not patch:
            continue
        for key in DISH_KEYS:
            if key in patch and patch[key] is not None:
                dish[key] = patch[key]
        name = patch.get("canonicalName")
        if name:
            aliases = [a for a in (dish.get("aliases") or []) if a != name]
            dish["aliases"] = [name, *aliases]
    for recipe in catalog.get("recipes") or []:
        patch = recipe_patches.get(recipe.get("id"))
        if not patch:
            continue
        for key in RECIPE_KEYS:
            if key in patch and patch[key] is not None:
                recipe[key] = patch[key]
    return catalog
