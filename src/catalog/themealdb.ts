import type { Dish } from "../types";

/**
 * Адаптер TheMealDB. В runtime приложения не вызывается:
 * каталог собирается скриптом scripts/build_catalog.py и кладётся в public/data/catalog.json.
 * Ключ API в frontend не попадает.
 */
export const THEMEALDB_ATTRIBUTION =
  "Данные блюд: TheMealDB (themealdb.com). Фотографии принадлежат источнику; приложение не копирует их на свой сервер.";

export function mealToStub(meal: {
  idMeal: string;
  strMeal: string;
  strCategory?: string;
  strArea?: string;
  strMealThumb?: string;
  strSource?: string;
}): Dish {
  return {
    id: `themealdb_${meal.idMeal}`,
    canonicalName: meal.strMeal,
    originalName: meal.strMeal,
    aliases: [],
    cuisine: meal.strArea || "Международная",
    categories: meal.strCategory ? [meal.strCategory] : [],
    description: meal.strMeal,
    imageUrl: meal.strMealThumb,
    ingredients: [],
    originalIngredients: [],
    allergens: [],
    recipeIds: [`recipe_${meal.idMeal}`],
    source: "themealdb",
    sourceId: meal.idMeal,
    sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    imageLicense: "TheMealDB; см. условия источника",
    attribution: THEMEALDB_ATTRIBUTION
  };
}
