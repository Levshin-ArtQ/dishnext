import type { Catalog, Dish, Recipe } from "../types";

export type DishPatch = Partial<
  Pick<Dish, "canonicalName" | "description" | "ingredients" | "cuisine" | "categories" | "aliases" | "allergens">
>;

export type RecipePatch = Partial<Pick<Recipe, "title" | "ingredients" | "instructions">>;

export type CatalogOverrides = {
  version: 1;
  updatedAt: string;
  dishes: Record<string, DishPatch>;
  recipes: Record<string, RecipePatch>;
};

const DISH_KEYS = [
  "canonicalName",
  "description",
  "ingredients",
  "cuisine",
  "categories",
  "aliases",
  "allergens"
] as const;

const RECIPE_KEYS = ["title", "ingredients", "instructions"] as const;

export function emptyOverrides(): CatalogOverrides {
  return { version: 1, updatedAt: new Date().toISOString(), dishes: {}, recipes: {} };
}

export function normalizeOverrides(raw?: Partial<CatalogOverrides> | null): CatalogOverrides {
  const base = emptyOverrides();
  if (!raw || typeof raw !== "object") return base;
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
    dishes: raw.dishes && typeof raw.dishes === "object" ? { ...raw.dishes } : {},
    recipes: raw.recipes && typeof raw.recipes === "object" ? { ...raw.recipes } : {}
  };
}

export function overrideCount(overrides: CatalogOverrides): number {
  return Object.keys(overrides.dishes).length + Object.keys(overrides.recipes).length;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function dishPatchFrom(base: Dish, next: Dish): DishPatch | null {
  const patch: DishPatch = {};
  for (const key of DISH_KEYS) {
    if (!sameValue(base[key], next[key])) {
      (patch as Record<string, unknown>)[key] = next[key];
    }
  }
  return Object.keys(patch).length ? patch : null;
}

export function recipePatchFrom(base: Recipe, next: Recipe): RecipePatch | null {
  const patch: RecipePatch = {};
  for (const key of RECIPE_KEYS) {
    if (!sameValue(base[key], next[key])) {
      (patch as Record<string, unknown>)[key] = next[key];
    }
  }
  return Object.keys(patch).length ? patch : null;
}

function applyDishPatch(dish: Dish, patch: DishPatch): Dish {
  const next: Dish = { ...dish, ...patch };
  if (patch.canonicalName) {
    const aliases = next.aliases.filter((a) => a !== patch.canonicalName && a !== dish.canonicalName);
    next.aliases = [patch.canonicalName, ...aliases];
  }
  return next;
}

export function applyOverrides(catalog: Catalog, overrides: CatalogOverrides): Catalog {
  const dishPatches = overrides.dishes ?? {};
  const recipePatches = overrides.recipes ?? {};
  if (!Object.keys(dishPatches).length && !Object.keys(recipePatches).length) return catalog;
  return {
    ...catalog,
    dishes: catalog.dishes.map((dish) => {
      const patch = dishPatches[dish.id];
      return patch ? applyDishPatch(dish, patch) : dish;
    }),
    recipes: catalog.recipes.map((recipe) => {
      const patch = recipePatches[recipe.id];
      return patch ? { ...recipe, ...patch } : recipe;
    })
  };
}

export function upsertOverrides(
  current: CatalogOverrides,
  dishId: string,
  dishPatch: DishPatch | null,
  recipeId: string | undefined,
  recipePatch: RecipePatch | null
): CatalogOverrides {
  const dishes = { ...current.dishes };
  const recipes = { ...current.recipes };
  if (dishPatch) dishes[dishId] = dishPatch;
  else delete dishes[dishId];
  if (recipeId) {
    if (recipePatch) recipes[recipeId] = recipePatch;
    else delete recipes[recipeId];
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    dishes,
    recipes
  };
}

/** Latin leftovers in the Russian title or a description that never got translated. */
export function looksUntranslated(dish: Dish): boolean {
  const name = dish.canonicalName || "";
  if (/[A-Za-z]{3,}/.test(name)) return true;
  if (dish.originalName && name.trim() === dish.originalName.trim()) return true;
  const desc = dish.description || "";
  if (/[A-Za-z]{4,}/.test(desc) && !/[А-Яа-яЁё]{8,}/.test(desc)) return true;
  return false;
}

export function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
