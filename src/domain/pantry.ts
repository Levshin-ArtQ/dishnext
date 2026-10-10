import type { Dish, Recipe } from "../types";
import { classifyProtein } from "./protein";
import { normalizeName } from "./text";

const STAPLES = [
  "соль",
  "сахар",
  "вода",
  "чёрный перец",
  "белый перец",
  "масло",
  "оливковое масло",
  "растительное масло",
  "salt",
  "sugar",
  "water",
  "black pepper",
  "white pepper",
  "oil",
  "olive oil",
  "vegetable oil"
];

const GROUPS: { keys: string[]; stems: string[] }[] = [
  { keys: ["курица", "chicken"], stems: ["кури", "курочк", "chicken"] },
  {
    keys: ["свинина", "pork"],
    stems: ["свин", "pork", "bacon", "бекон", "ham", "ветчин", "chorizo", "чоризо", "sausage", "колбас"]
  },
  { keys: ["говядина", "beef"], stems: ["говяд", "beef"] },
  { keys: ["картофель", "potato"], stems: ["картофел", "картошк", "potato"] },
  { keys: ["лук", "onion"], stems: ["лук", "onion"] },
  { keys: ["чеснок", "garlic"], stems: ["чеснок", "чесноч", "garlic"] },
  { keys: ["помидоры", "tomato"], stems: ["помидор", "томат", "tomato"] },
  { keys: ["морковь", "carrot"], stems: ["морков", "carrot"] },
  { keys: ["капуста", "cabbage"], stems: ["капуст", "cabbage"] },
  { keys: ["перец", "pepper"], stems: ["перец", "перц", "pepper"] },
  { keys: ["кабачок", "zucchini"], stems: ["кабач", "zucchini", "courgette"] },
  { keys: ["баклажан", "eggplant"], stems: ["баклажан", "eggplant", "aubergine"] },
  { keys: ["грибы", "mushroom"], stems: ["гриб", "mushroom"] },
  { keys: ["рис", "rice"], stems: ["рис", "rice"] },
  { keys: ["паста", "pasta"], stems: ["паста", "pasta", "spaghetti", "спагетти", "penne", "пенне"] },
  { keys: ["лапша", "noodles"], stems: ["лапш", "noodle", "udon", "удон"] },
  { keys: ["яйца", "egg"], stems: ["яйц", "egg"] },
  { keys: ["сыр", "cheese"], stems: ["сыр", "cheese"] },
  { keys: ["сливки", "cream"], stems: ["сливк", "cream"] },
  { keys: ["рыба", "fish"], stems: ["рыб", "fish", "salmon", "лосос", "tuna", "тунц", "cod"] },
  { keys: ["креветки", "prawns"], stems: ["кревет", "prawn", "shrimp"] },
  { keys: ["орехи", "nuts"], stems: ["орех", "almond", "walnut", "cashew", "pistachio", "hazelnut"] }
];

function expand(needle: string): string[] {
  const n = normalizeName(needle);
  if (!n) return [];
  const extra = [n];
  for (const group of GROUPS) {
    const hit =
      group.keys.some((k) => n === k || n.includes(k) || k.includes(n)) || group.stems.some((s) => n.includes(s));
    if (hit) extra.push(...group.keys, ...group.stems);
  }
  return [...new Set(extra)];
}

function valueHitsNeedle(value: string, needle: string): boolean {
  if (!value || !needle) return false;
  if (value === needle) return true;
  if (needle.length <= 4 && /^[a-z]+$/.test(needle)) {
    return new RegExp(`(?:^| )${needle}(?: |$)`).test(` ${value} `);
  }
  if (value.includes(needle)) return true;
  if (needle.length >= 4 && needle.includes(value)) return true;
  return false;
}

export function hasIngredient(haystack: string[], needle: string): boolean {
  const n = normalizeName(needle);
  if (!n) return false;
  if (n === "овощи") {
    return haystack.some((item) =>
      [
        "морковь",
        "лук",
        "помидор",
        "капуст",
        "перец",
        "кабачок",
        "баклажан",
        "огурец",
        "шпинат",
        "картофель",
        "чеснок",
        "брокколи",
        "carrot",
        "onion",
        "tomato",
        "cabbage",
        "pepper",
        "zucchini",
        "eggplant",
        "spinach",
        "potato",
        "garlic",
        "broccoli"
      ].some((v) => normalizeName(item).includes(v))
    );
  }
  if (n === "острое") {
    return haystack.some((item) => /чили|перец чили|chili|chilli|cayenne|hot sauce|paprika/.test(normalizeName(item)));
  }
  const needles = expand(n);
  const meatAsk = /кури|chicken|свин|pork|bacon|бекон/.test(n) && !/бульон|stock|broth|соус|sauce/.test(n);
  return haystack.some((item) => {
    const value = normalizeName(item);
    if (meatAsk && /бульон|stock|broth|соус|sauce/.test(value)) return false;
    return needles.some((part) => valueHitsNeedle(value, part));
  });
}

export function dishHasAny(dish: Dish, needles: string[]): boolean {
  const pool = [...dish.ingredients, ...dish.originalIngredients, ...dish.categories, dish.canonicalName];
  return needles.some((n) => hasIngredient(pool, n));
}

export function matchingNeedles(dish: Dish, needles: string[]): string[] {
  const pool = [...dish.ingredients, ...dish.originalIngredients, ...dish.categories];
  return needles.filter((n) => hasIngredient(pool, n));
}

export function isStaple(name: string): boolean {
  const n = normalizeName(name);
  if (["соль", "сахар", "вода", "salt", "sugar", "water"].includes(n)) return true;
  if (n.includes("черный перец") || n.includes("белый перец") || n.includes("black pepper") || n.includes("white pepper")) {
    return true;
  }
  if (n === "масло" || n === "oil" || n.endsWith(" масло") || n.endsWith(" oil")) return true;
  return STAPLES.some((s) => n === normalizeName(s));
}

export type CookLine = {
  name: string;
  original: string;
  measure: string;
  have: boolean;
  staple: boolean;
  wanted: boolean;
};

export function cookLines(
  dish: Dish,
  recipe: Recipe | undefined,
  haveIngredients: string[],
  wantedIngredients: string[] = []
): CookLine[] {
  const names = recipe?.ingredients ?? dish.ingredients;
  const measures = recipe?.measures ?? [];
  const originals = dish.originalIngredients;
  return names.map((name, i) => {
    const original = originals[i] ?? "";
    const staple = isStaple(name) || isStaple(original);
    return {
      name,
      original,
      measure: measures[i] ?? "",
      staple,
      have: staple || hasIngredient(haveIngredients, name) || hasIngredient(haveIngredients, original),
      wanted: hasIngredient(wantedIngredients, name) || hasIngredient(wantedIngredients, original)
    };
  });
}

export function cookSteps(instructions?: string[]): string[] {
  if (!instructions?.length) return [];
  if (instructions.length >= 4) return instructions.map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of instructions) {
    const parts = block
      .split(/(?<=[.!?])\s+(?=[A-ZА-Я«"0-9])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 24);
    if (parts.length > 1) out.push(...parts);
    else if (block.trim()) out.push(block.trim());
  }
  return out;
}

export function householdProtein(dish: Dish): boolean {
  const kind = classifyProtein(dish);
  return kind === "chicken" || kind === "pork";
}
