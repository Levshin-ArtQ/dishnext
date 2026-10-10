import type { Catalog, Dish, DishProvider, Recipe } from "../types";
import { normalizeName } from "../domain/text";

export class LocalCatalogProvider implements DishProvider {
  constructor(private catalog: Catalog) {}

  async all(): Promise<Dish[]> {
    return this.catalog.dishes.slice();
  }

  async search(query: string): Promise<Dish[]> {
    const q = normalizeName(query);
    if (!q) return this.all();
    return this.catalog.dishes.filter((d) => {
      const blob = [d.canonicalName, d.originalName ?? "", ...d.aliases, d.cuisine, ...d.categories, ...d.ingredients]
        .join(" ")
        .toLowerCase();
      return normalizeName(blob).includes(q);
    });
  }

  async getById(id: string): Promise<Dish | null> {
    return this.catalog.dishes.find((d) => d.id === id) ?? null;
  }

  async getCategories(): Promise<string[]> {
    return [...new Set(this.catalog.dishes.flatMap((d) => d.categories))].sort((a, b) => a.localeCompare(b, "ru"));
  }

  async getCuisines(): Promise<string[]> {
    return [...new Set(this.catalog.dishes.map((d) => d.cuisine))].sort((a, b) => a.localeCompare(b, "ru"));
  }

  recipeFor(dishId: string): Recipe | undefined {
    const dish = this.catalog.dishes.find((d) => d.id === dishId);
    if (!dish) return undefined;
    return this.catalog.recipes.find((r) => dish.recipeIds.includes(r.id));
  }
}

export async function loadCatalog(): Promise<Catalog> {
  const res = await fetch("/data/catalog.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Не удалось загрузить каталог блюд");
  return (await res.json()) as Catalog;
}
