import type { Appetite, Budget, Difficulty, DishStyle, Mode, Protein } from "./types";

export const MODE_META: Record<Mode, { title: string; lede: string; num: string }> = {
  feed: { num: "01", title: "Быстрый ужин", lede: "Короткая подборка и сразу к делу." },
  explore: { num: "02", title: "Поискать новое", lede: "Другие кухни, если надоело привычное." },
  tournament: { num: "03", title: "Сравнить два", lede: "Оставляете фаворитов и выбираете пару." }
};

export const PANTRY_CHIPS = [
  "курица",
  "свинина",
  "яйца",
  "картофель",
  "лук",
  "чеснок",
  "морковь",
  "помидоры",
  "капуста",
  "перец",
  "кабачок",
  "баклажан",
  "брокколи",
  "грибы",
  "рис",
  "паста",
  "лапша"
];

export const AVOID_CHIPS = [
  "говядина",
  "рыба",
  "креветки",
  "грибы",
  "баклажан",
  "острое",
  "сливки",
  "сыр",
  "орехи"
];

export const WANT_CHIPS = [
  "курица",
  "свинина",
  "картофель",
  "овощи",
  "рис",
  "паста",
  "грибы",
  "чеснок",
  "помидоры"
];

/** First-class kitchens on setup; remaining catalog cuisines follow. */
export const FEATURED_CUISINES = [
  "Итальянская",
  "Русская",
  "Украинская",
  "Французская",
  "Японская",
  "Китайская",
  "Индийская",
  "Мексиканская",
  "Испанская",
  "Американская",
  "Британская",
  "Турецкая",
  "Вьетнамская",
  "Греческая",
  "Тайская"
];

export function orderCuisines(all: string[]): string[] {
  const unique = [...new Set(all.filter(Boolean))];
  const featured = FEATURED_CUISINES.filter((c) => unique.includes(c));
  const rest = unique
    .filter((c) => !FEATURED_CUISINES.includes(c))
    .sort((a, b) => a.localeCompare(b, "ru"));
  return [...featured, ...rest];
}

export function difficultyLabel(value?: Difficulty) {
  if (value === "easy") return "простое";
  if (value === "hard") return "повозиться";
  if (value === "medium") return "среднее";
  return "как получится";
}

export function budgetLabel(value?: Budget) {
  if (value === "low") return "скромный бюджет";
  if (value === "high") return "можно подороже";
  if (value === "medium") return "средний бюджет";
  return "бюджет не важен";
}

export function minutesLabel(n?: number) {
  if (!n) return "время примерно";
  return `около ${n} мин`;
}

export function minutesShort(n?: number) {
  if (!n) return "";
  return String(n);
}

export function appetiteLabel(value?: Appetite) {
  if (value === "healthy") return "Правильное питание";
  if (value === "hearty") return "Сытные блюда";
  return "Как получится";
}

export function styleLabel(value?: DishStyle) {
  if (value === "healthy") return "легче";
  if (value === "hearty") return "сытно";
  return "";
}

export function proteinLabel(value?: Protein) {
  if (value === "chicken") return "курица";
  if (value === "pork") return "свинина";
  if (value === "beef") return "говядина";
  if (value === "fish") return "рыба";
  if (value === "veg") return "без мяса";
  return "";
}
