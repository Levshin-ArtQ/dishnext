import type { Dish, DishStyle, Protein } from "../types";

const SEASONING =
  /\b(stock|broth|bouillon|cube|powder|sauce|seasoning|dripping|ghee|fat|oil|paste|puree|purée|flavour|flavor|dashi|demi[- ]glace)\b/i;

type Meat = Exclude<Protein, "veg" | "other">;

const MEAT_RULES: { protein: Meat; re: RegExp; garnish?: boolean }[] = [
  { protein: "chicken", re: /\b(chicken|turkey|hen)\b/ },
  { protein: "pork", re: /\b(pork|bacon|pancetta|prosciutto|guanciale|chorizo|lardons?|gammon|kielbasa)\b/ },
  { protein: "pork", re: /\bham\b/ },
  { protein: "pork", re: /\bsausages?\b/ },
  { protein: "beef", re: /\b(beef|steak|brisket|oxtail|veal)\b/ },
  { protein: "fish", re: /\b(salmon|cod|tuna|trout|mackerel|haddock|sardine|anchov)/ },
  { protein: "fish", re: /\b(prawn|shrimp|clam|mussel|squid|calamari|scallop|lobster|crab|oyster|fish)\b/ }
];

function blobOf(dish: Pick<Dish, "originalIngredients" | "ingredients" | "originalName" | "canonicalName">) {
  return {
    ings: [...(dish.originalIngredients ?? []), ...(dish.ingredients ?? [])].map((x) => x.toLowerCase()),
    title: `${dish.originalName ?? ""} ${dish.canonicalName}`.toLowerCase()
  };
}

function weightFor(protein: Meat, token: string, fromTitle: boolean) {
  const t = token.toLowerCase();
  if (fromTitle) return 8;
  if (protein === "pork" && /\b(bacon|ham|pancetta|prosciutto|chorizo|lardon)/.test(t)) return 2;
  if (protein === "pork" && /\bsausage/.test(t)) return 3;
  if (/\b(breast|thigh|chop|chops|fillet|shoulder|mince|minced|ground|ribs|wing|wings|liver|leg|legs|whole)\b/.test(t)) {
    return 6;
  }
  return 4;
}

function add(scores: Record<string, number>, protein: Meat, w: number) {
  scores[protein] = (scores[protein] ?? 0) + w;
}

/** Primary protein from ingredients and the dish name. Stocks, sauces and 'ham' inside other words do not count. */
export function classifyProtein(
  dish: Pick<Dish, "originalIngredients" | "ingredients" | "originalName" | "canonicalName" | "categories" | "protein">
): Protein {
  const { ings, title } = blobOf(dish);
  const scores: Record<string, number> = {};

  for (const ing of ings) {
    if (SEASONING.test(ing) && !/\b(chop|chops|breast|thigh|fillet|shoulder|mince)\b/.test(ing)) continue;
    if (/\b(fish sauce|oyster sauce|worcestershire|soy sauce|hot sauce)\b/.test(ing)) continue;
    for (const rule of MEAT_RULES) {
      if (rule.re.test(ing)) add(scores, rule.protein, weightFor(rule.protein, ing, false));
    }
    if (/куриц|курочк/.test(ing) && !/бульон/.test(ing)) add(scores, "chicken", weightFor("chicken", ing, false));
    if (/свинин|бекон|ветчин|чоризо|колбас/.test(ing)) add(scores, "pork", weightFor("pork", ing, false));
    if (/говяд/.test(ing)) add(scores, "beef", weightFor("beef", ing, false));
    if (/(лосос|кревет|миди|тунц|треск|моллюск)/.test(ing) || (/\bрыб/.test(ing) && !/соус/.test(ing))) {
      add(scores, "fish", weightFor("fish", ing, false));
    }
  }

  for (const rule of MEAT_RULES) {
    if (rule.re.test(title)) add(scores, rule.protein, 8);
  }
  if (/свинин/.test(title)) add(scores, "pork", 8);
  if (/куриц|курочк/.test(title)) add(scores, "chicken", 8);
  if (/говяд/.test(title)) add(scores, "beef", 8);
  if (/рыб|лосос|кревет|миди/.test(title)) add(scores, "fish", 8);

  const ranked = (Object.entries(scores) as [Meat, number][]).sort((a, b) => b[1] - a[1]);
  if (ranked.length && ranked[0][1] > 0) {
    const [top, topScore] = ranked[0];
    const second = ranked[1];
    if (second && topScore - second[1] <= 1) {
      const cats = (dish.categories ?? []).join(" ").toLowerCase();
      if (top === "pork" && second[0] !== "pork" && /говяд|beef|морепродукт|seafood|рыб/.test(cats)) {
        return second[0];
      }
    }
    return top;
  }

  const cats = (dish.categories ?? []).join(" ").toLowerCase();
  const all = `${ings.join(" ")} ${title} ${cats}`;
  if (/\b(lamb|mutton|goat|duck|goose|rabbit|venison)\b/.test(all) || /ягнён|баран|утин|\bутка\b|козел|козля/.test(all)) {
    return "other";
  }
  if (/куриц/.test(cats)) return "chicken";
  if (/свинин/.test(cats)) return "pork";
  if (/говяд/.test(cats)) return "beef";
  if (/морепродукт|рыб/.test(cats)) return "fish";
  if (/вегетариан|веган/.test(cats)) return "veg";
  return dish.protein && dish.protein !== "pork" && dish.protein !== "chicken" ? dish.protein : "veg";
}

export function classifyStyle(
  dish: Pick<Dish, "originalIngredients" | "ingredients" | "originalName" | "canonicalName" | "categories" | "style">
): DishStyle {
  const protein = classifyProtein(dish);
  const blob = `${(dish.originalIngredients ?? []).join(" ")} ${dish.originalName ?? ""} ${dish.canonicalName}`.toLowerCase();
  const heartyBits = ["stew", "pie", "fried", "bacon", "sausage", "cream", "butter", "cheese", "pastry", "dumpling", "roast", "curry", "hotpot", "рагу", "пирог"];
  const lightBits = ["salad", "grilled", "steam", "quinoa", "yogurt", "yoghurt", "broccoli", "spinach", "lemon", "салат", "на гриле"];
  const hearty = heartyBits.reduce((n, w) => n + (blob.includes(w) ? 1 : 0), 0);
  const light = lightBits.reduce((n, w) => n + (blob.includes(w) ? 1 : 0), 0);
  const cats = (dish.categories ?? []).join(" ").toLowerCase();
  if (/вегетариан|веган|закуск/.test(cats) && hearty < 2) return "healthy";
  if (protein === "pork" && hearty >= 1) return "hearty";
  if (hearty >= light + 1) return "hearty";
  if (protein === "chicken" && light >= hearty) return "healthy";
  if (protein === "veg" || protein === "fish") return light >= hearty ? "healthy" : "hearty";
  return protein === "beef" ? "hearty" : dish.style ?? "healthy";
}

export function meatPhrase(
  dish: Pick<Dish, "originalIngredients" | "ingredients" | "originalName" | "canonicalName" | "categories" | "protein">
): string {
  const protein = classifyProtein(dish);
  const blob = `${(dish.originalIngredients ?? []).join(" ")} ${(dish.ingredients ?? []).join(" ")}`.toLowerCase();
  if (protein === "pork") {
    if (/chop|отбивн/.test(blob)) return "свиные отбивные";
    if (/mince|minced|ground|фарш/.test(blob)) return "свиной фарш";
    if (/ribs|рёбр|ребер/.test(blob)) return "свиные рёбра";
    if (/shoulder|лопатк/.test(blob)) return "свиную лопатку";
    if (/\bbacon\b|бекон/.test(blob) && !/\bpork\b|свинин/.test(blob)) return "бекон";
    if (/chorizo|чоризо/.test(blob) && !/\bpork\b|свинин/.test(blob)) return "чоризо";
    if (/sausage|колбас/.test(blob) && !/\bpork\b|свинин/.test(blob)) return "колбаски";
    return "свинину";
  }
  if (protein === "chicken") {
    if (/liver|печен/.test(blob)) return "куриную печень";
    if (/wing|крыл/.test(blob)) return "куриные крылья";
    if (/thigh|бедр/.test(blob)) return "куриные бёдра";
    if (/breast|грудк/.test(blob)) return "куриную грудку";
    if (/leg|ножк/.test(blob)) return "куриные ножки";
    return "курицу";
  }
  if (protein === "beef") {
    if (/fillet|вырезк/.test(blob)) return "говяжью вырезку";
    if (/mince|minced|ground|фарш/.test(blob)) return "говяжий фарш";
    if (/brisket/.test(blob)) return "говяжью грудинку";
    return "говядину";
  }
  if (protein === "fish") {
    if (/salmon|лосос/.test(blob)) return "лосось";
    if (/prawn|shrimp|кревет/.test(blob)) return "креветки";
    if (/\bclams?\b|моллюск/.test(blob)) return "моллюски";
    if (/mussel|миди/.test(blob)) return "мидии";
    if (/\bcod\b|треск/.test(blob)) return "треску";
    if (/tuna|тунц/.test(blob)) return "тунец";
    return "рыбу";
  }
  return "";
}

export function isTemplateDescription(text?: string, dish?: Pick<Dish, "canonicalName" | "originalName">) {
  if (!text) return true;
  const t = text.trim();
  if (/блюдо \S+ кухни \(|Рецепт — пошагово/.test(t)) return true;
  if (dish && (t === dish.canonicalName || t === dish.originalName)) return true;
  if (t.length < 24) return true;
  return false;
}
