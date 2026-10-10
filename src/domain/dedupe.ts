import type { DedupeRelation, Dish } from "../types";
import { jaccard, normalizeName, tokens } from "./text";

export type DedupeHit = {
  a: string;
  b: string;
  relation: DedupeRelation;
  reason: string;
};

function namesOf(dish: Dish): string[] {
  return [dish.canonicalName, dish.originalName ?? "", ...dish.aliases]
    .map(normalizeName)
    .filter(Boolean);
}

function imageKey(url?: string): string {
  if (!url) return "";
  try {
    const path = new URL(url).pathname;
    return path.split("/").filter(Boolean).slice(-1)[0] ?? "";
  } catch {
    return url;
  }
}

export function relateDishes(a: Dish, b: Dish): DedupeHit {
  if (a.id === b.id) {
    return { a: a.id, b: b.id, relation: "sameDish", reason: "id" };
  }
  if (a.source && a.sourceId && a.source === b.source && a.sourceId === b.sourceId) {
    return { a: a.id, b: b.id, relation: "sameDish", reason: "source+sourceId" };
  }

  const namesA = namesOf(a);
  const namesB = namesOf(b);
  for (const left of namesA) {
    for (const right of namesB) {
      if (left && left === right) {
        return { a: a.id, b: b.id, relation: "sameDish", reason: "normalized-name" };
      }
    }
  }

  const tokenA = uniqueTokens(namesA);
  const tokenB = uniqueTokens(namesB);
  const nameScore = jaccard(tokenA, tokenB);
  const ingScore = jaccard(a.originalIngredients.length ? a.originalIngredients : a.ingredients, b.originalIngredients.length ? b.originalIngredients : b.ingredients);
  const sameImage = Boolean(imageKey(a.imageUrl) && imageKey(a.imageUrl) === imageKey(b.imageUrl));
  const sameCuisine = a.cuisine === b.cuisine;

  if (nameScore >= 0.72 && (ingScore >= 0.55 || sameImage)) {
    return { a: a.id, b: b.id, relation: "sameDish", reason: "name+ingredients-or-image" };
  }

  if (sameCuisine && nameScore >= 0.5 && ingScore >= 0.72) {
    return { a: a.id, b: b.id, relation: "variantOf", reason: "variant-ingredients" };
  }

  if (sameImage && sameCuisine && nameScore >= 0.4) {
    return { a: a.id, b: b.id, relation: "variantOf", reason: "shared-image" };
  }

  return { a: a.id, b: b.id, relation: "unrelated", reason: "no-match" };
}

function uniqueTokens(names: string[]): string[] {
  return [...new Set(names.flatMap(tokens))];
}

export function canonicalGroups(dishes: Dish[]): Map<string, Dish[]> {
  const groups = new Map<string, Dish[]>();
  const parent = new Map<string, string>();

  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current !== id) {
      const root = find(current);
      parent.set(id, root);
      return root;
    }
    return current;
  };

  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (const dish of dishes) parent.set(dish.id, dish.id);

  for (let i = 0; i < dishes.length; i += 1) {
    for (let j = i + 1; j < dishes.length; j += 1) {
      const hit = relateDishes(dishes[i], dishes[j]);
      if (hit.relation === "sameDish") union(dishes[i].id, dishes[j].id);
    }
  }

  for (const dish of dishes) {
    const root = find(dish.id);
    const list = groups.get(root) ?? [];
    list.push(dish);
    groups.set(root, list);
  }
  return groups;
}

export function oneCardPerDish(dishes: Dish[]): Dish[] {
  const groups = canonicalGroups(dishes);
  const picked: Dish[] = [];
  for (const group of groups.values()) {
    const sorted = group.slice().sort((a, b) => {
      const img = Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl));
      if (img) return img;
      return a.canonicalName.localeCompare(b.canonicalName, "ru");
    });
    picked.push(sorted[0]);
  }
  return picked;
}
