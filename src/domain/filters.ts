import type { Constraints, Dish } from "../types";
import { dishHasAny, hasIngredient } from "./pantry";

export const OPTIONAL_FILTERS = [
  "maxMinutes",
  "budget",
  "avoidRecent",
  "excludedCuisines",
  "selectedCuisines",
  "excludedCategories",
  "selectedCategories",
  "excludedIngredients"
] as const;

export type FilterReason =
  | "allergen"
  | "ingredient"
  | "cuisine"
  | "category"
  | "time"
  | "budget"
  | "recent"
  | "selected-category"
  | "selected-cuisine";

export type FilterHit = {
  dish: Dish;
  ok: boolean;
  reasons: FilterReason[];
};

export function dishMatchesConstraints(
  dish: Dish,
  constraints: Constraints,
  recentIds: string[] = []
): FilterHit {
  const reasons: FilterReason[] = [];
  const ings = [...dish.ingredients, ...dish.originalIngredients];

  for (const allergen of constraints.allergens) {
    if (hasIngredient(dish.allergens, allergen) || hasIngredient(ings, allergen)) {
      reasons.push("allergen");
      break;
    }
  }
  for (const ingredient of constraints.excludedIngredients) {
    if (dishHasAny(dish, [ingredient])) {
      reasons.push("ingredient");
      break;
    }
  }
  if (constraints.excludedCuisines.includes(dish.cuisine)) reasons.push("cuisine");
  if (constraints.selectedCuisines.length && !constraints.selectedCuisines.includes(dish.cuisine)) {
    reasons.push("selected-cuisine");
  }
  if (dish.categories.some((c) => constraints.excludedCategories.includes(c))) {
    reasons.push("category");
  }
  if (
    constraints.selectedCategories.length &&
    !dish.categories.some((c) => constraints.selectedCategories.includes(c))
  ) {
    reasons.push("selected-category");
  }
  if (constraints.maxMinutes && (dish.preparationMinutes ?? 999) > constraints.maxMinutes) {
    reasons.push("time");
  }
  if (constraints.budget && budgetRank(dish.budget) > budgetRank(constraints.budget)) {
    reasons.push("budget");
  }
  if (constraints.avoidRecent && recentIds.includes(dish.id)) reasons.push("recent");

  return { dish, ok: reasons.length === 0, reasons };
}

function budgetRank(budget?: string): number {
  if (budget === "low") return 1;
  if (budget === "medium") return 2;
  if (budget === "high") return 3;
  return 2;
}

export function applyHardFilters(
  dishes: Dish[],
  constraints: Constraints,
  recentIds: string[] = []
): { passed: Dish[]; rejected: FilterHit[]; tooFew: boolean } {
  const rejected: FilterHit[] = [];
  const passed: Dish[] = [];
  for (const dish of dishes) {
    const hit = dishMatchesConstraints(dish, constraints, recentIds);
    if (hit.ok) passed.push(dish);
    else rejected.push(hit);
  }
  return { passed, rejected, tooFew: passed.length < 8 };
}

export function relaxOptional(constraints: Constraints): Constraints {
  return {
    ...constraints,
    maxMinutes: undefined,
    budget: undefined,
    vegetarian: false,
    vegan: false,
    avoidRecent: false,
    excludedCuisines: [],
    selectedCuisines: [],
    excludedCategories: [],
    selectedCategories: [],
    excludedIngredients: []
  };
}

export function allergiesIntact(before: Constraints, after: Constraints): boolean {
  const a = [...before.allergens].sort().join("|");
  const b = [...after.allergens].sort().join("|");
  return a === b;
}
