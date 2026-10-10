import { difficultyLabel } from "../copy";
import type { Dish, Recipe } from "../types";
import { cookSteps, isStaple } from "./pantry";
import { classifyProtein, isTemplateDescription, meatPhrase } from "./protein";
import { normalizeName } from "./text";

export type CookMethod =
  | "fry"
  | "stew"
  | "bake"
  | "boil"
  | "grill"
  | "steam"
  | "wok"
  | "salad"
  | "mix"
  | "other";

export const METHOD_LABEL: Record<CookMethod, string> = {
  fry: "жарим",
  stew: "тушим",
  bake: "запекаем",
  boil: "варим",
  grill: "на гриле",
  steam: "на пару",
  wok: "в воке",
  salad: "собираем",
  mix: "смешиваем",
  other: "готовим"
};

export const METHOD_NOUN: Record<CookMethod, string> = {
  fry: "на сковороде",
  stew: "тушение",
  bake: "в духовке",
  boil: "варка",
  grill: "гриль",
  steam: "на пару",
  wok: "вок",
  salad: "без плиты",
  mix: "смешать",
  other: "по рецепту"
};

const METHOD_RULES: { method: CookMethod; needles: string[]; weight: number }[] = [
  { method: "salad", needles: ["salad", "салат"], weight: 6 },
  { method: "wok", needles: ["wok", "stir-fry", "stir fry", "stirfry"], weight: 6 },
  { method: "grill", needles: ["grill", "grilled", "barbecue", "bbq"], weight: 5 },
  { method: "steam", needles: ["steam", "steamed", "steamer"], weight: 5 },
  { method: "bake", needles: ["oven", "bake", "baked", "roast", "roasted", "запеч", "духовк"], weight: 5 },
  { method: "stew", needles: ["stew", "braise", "simmer", "casserole", "curry", "туш", "томи"], weight: 4 },
  { method: "boil", needles: ["boil", "soup", "broth", "poach", "вар"], weight: 3 },
  { method: "fry", needles: ["fry", "fried", "skillet", "sauté", "saute", "pan-fry", "жарен", "сковород"], weight: 3 },
  { method: "mix", needles: ["blend", "whisk", "shake", "smoothie"], weight: 2 }
];

const PROTEIN_STEM: Record<string, string[]> = {
  chicken: ["кури", "курочк", "chicken", "turkey"],
  pork: ["свин", "бекон", "ветчин", "чоризо", "колбас", "pork", "bacon", "chorizo", "sausage", "pancetta"],
  beef: ["говяд", "beef", "steak"],
  fish: ["рыб", "лосос", "тунц", "кревет", "миди", "fish", "salmon", "prawn", "shrimp", "clam", "mussel"]
};

export type CardCopy = {
  method: CookMethod;
  methodLabel: string;
  methodHow: string;
  difficulty: string;
  steps: number;
  heroes: string[];
  blurb: string;
};

function cap(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function detectMethod(dish: Dish, recipe?: Recipe): CookMethod {
  const title = `${dish.originalName ?? ""} ${dish.canonicalName}`.toLowerCase();
  const steps = (recipe?.instructions ?? []).join("\n").toLowerCase();
  const extra = [...(dish.categories ?? []), ...(dish.originalIngredients ?? [])].join(" ").toLowerCase();
  const scores: Partial<Record<CookMethod, number>> = {};
  for (const rule of METHOD_RULES) {
    let score = 0;
    for (const needle of rule.needles) {
      if (title.includes(needle)) score += rule.weight * 3;
      if (steps.includes(needle)) score += rule.weight;
      else if (extra.includes(needle)) score += Math.max(1, rule.weight - 2);
    }
    if (score) scores[rule.method] = (scores[rule.method] ?? 0) + score;
  }
  if (/heat oven|preheat|transfer to the oven|в духовк/.test(steps)) scores.bake = (scores.bake ?? 0) + 12;
  if (/cover.{0,40}simmer|gentle simmer|leave to simmer/.test(steps)) scores.stew = (scores.stew ?? 0) + 8;
  let best: CookMethod = "other";
  let bestScore = 0;
  for (const [method, score] of Object.entries(scores) as [CookMethod, number][]) {
    if (score > bestScore) {
      best = method;
      bestScore = score;
    }
  }
  return best;
}

export function heroIngredients(dish: Dish, limit = 3) {
  const stems = PROTEIN_STEM[classifyProtein(dish) ?? ""] ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  const preferRu = dish.ingredients.filter((name) => /[а-яё]/i.test(name));
  const pool = preferRu.length >= 2 ? preferRu : dish.ingredients;
  for (const raw of pool) {
    const name = raw.trim();
    const n = normalizeName(name);
    if (!n || isStaple(name)) continue;
    if (stems.some((s) => n.includes(s))) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

export function cardBlurb(dish: Dish, recipe?: Recipe) {
  if (!isTemplateDescription(dish.description, dish)) {
    return dish.description.replace(/\s+/g, " ").trim();
  }
  const method = detectMethod(dish, recipe);
  const verb = METHOD_LABEL[method];
  const obj = meatPhrase(dish);
  let lead = "";
  if (method === "salad") lead = "Собираем салат";
  else if (obj) lead = `${cap(verb)} ${obj}`;
  else lead = cap(verb);
  if (method === "bake") lead += " в духовке";
  else if (method === "fry") lead += " на сковороде";
  else if (method === "wok") lead += " в воке";
  else if (method === "grill") lead += " на гриле";
  else if (method === "steam") lead += " на пару";
  else if (method === "boil") lead += " в кастрюле";
  lead += ".";
  if (dish.cuisine) lead += ` ${dish.cuisine} кухня.`;
  return lead.replace(/\s+/g, " ").trim();
}

export function cardCopy(dish: Dish, recipe?: Recipe): CardCopy {
  const method = detectMethod(dish, recipe);
  const diff = difficultyLabel(dish.difficulty);
  return {
    method,
    methodLabel: METHOD_LABEL[method],
    methodHow: METHOD_NOUN[method],
    difficulty: diff === "как получится" ? "" : diff,
    steps: cookSteps(recipe?.instructions).length,
    heroes: heroIngredients(dish, 3),
    blurb: cardBlurb(dish, recipe)
  };
}
