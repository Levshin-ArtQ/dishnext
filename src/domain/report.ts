import type { Dish, Session, SessionReport, TasteProfile } from "../types";

export function likedReactions(session: Session) {
  return session.reactions.filter((r) => r.kind === "yes" || r.kind === "love");
}

export function viewedCount(session: Session): number {
  return session.reactions.filter((r) => r.kind !== "skip").length + session.reactions.filter((r) => r.kind === "skip").length;
}

export function buildReport(
  session: Session,
  dishesById: Map<string, Dish>,
  profile: TasteProfile
): SessionReport {
  const liked = likedReactions(session);
  const loves = session.reactions.filter((r) => r.kind === "love");
  const cuisineMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const newInteresting: string[] = [];

  for (const reaction of liked) {
    const dish = dishesById.get(reaction.dishId);
    if (!dish) continue;
    cuisineMap.set(dish.cuisine, (cuisineMap.get(dish.cuisine) ?? 0) + (reaction.kind === "love" ? 2 : 1));
    for (const cat of dish.categories) {
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
    }
    const wasSeen = profile.seenDishIds.includes(dish.id) && profile.seenDishIds.indexOf(dish.id) < profile.seenDishIds.length - liked.length;
    if (!wasSeen) newInteresting.push(dish.id);
  }

  const cuisines = [...cuisineMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const categories = [...categoryMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const alternativeIds = session.runnerUpIds.filter((id) => id !== session.winnerId).slice(0, 3);
  const comparisons = session.tournament?.history.filter((h) => !h.skipped).length ?? 0;

  const observations = observationsFor(session, dishesById, cuisines, newInteresting);

  return {
    winnerId: session.winnerId,
    alternativeIds,
    viewed: session.reactions.length,
    likes: liked.length,
    loves: loves.length,
    comparisons,
    cuisines,
    categories,
    newInteresting: [...new Set(newInteresting)].slice(0, 6),
    observations
  };
}

function observationsFor(
  session: Session,
  dishesById: Map<string, Dish>,
  cuisines: { name: string; count: number }[],
  newInteresting: string[]
): SessionReport["observations"] {
  const facts: SessionReport["observations"] = [];
  const hypotheses: SessionReport["observations"] = [];
  const liked = likedReactions(session);
  const likedDishes = liked.map((r) => dishesById.get(r.dishId)).filter(Boolean) as Dish[];

  if (session.winnerId) {
    const winner = dishesById.get(session.winnerId);
    if (winner) {
      facts.push({ kind: "fact", text: `Сегодня победило блюдо «${winner.canonicalName}».` });
    }
  }

  facts.push({
    kind: "fact",
    text: `Просмотрено карточек: ${session.reactions.length}, сравнений в турнире: ${session.tournament?.history.filter((h) => !h.skipped).length ?? 0}.`
  });

  if (cuisines[0] && cuisines[0].count >= 2) {
    facts.push({
      kind: "fact",
      text: `Сегодня чаще выбирались блюда ${cuisinePhrase(cuisines[0].name)} кухни (${cuisines[0].count} положительные реакции).`
    });
  }

  const proteins = countIngredients(likedDishes, ["курица", "рис", "говядина", "креветки", "нут", "помидоры", "картофель", "лосось", "свинина"]);
  const topIng = [...proteins.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topIng && topIng[1] >= 2) {
    facts.push({ kind: "fact", text: `Среди выбранных блюд чаще встречались ${topIng[0]}.` });
  }

  if (newInteresting.length) {
    facts.push({
      kind: "fact",
      text: `Из новых блюд заинтересовали ${newInteresting.length} ${plural(newInteresting.length, "вариант", "варианта", "вариантов")}.`
    });
  }

  if (cuisines[0] && cuisines[0].count >= 2) {
    hypotheses.push({
      kind: "hypothesis",
      text: `В следующий раз можно сравнить победителя с другими блюдами ${cuisinePhrase(cuisines[0].name)} кухни.`
    });
  } else if (likedDishes.length) {
    hypotheses.push({
      kind: "hypothesis",
      text: "Пока рано говорить о любимой кухне: сегодня выбор был смешанный."
    });
  }

  const nos = session.reactions.filter((r) => r.kind === "no");
  if (nos.length && liked.length) {
    hypotheses.push({
      kind: "hypothesis",
      text: "Отказ от карточки ещё не значит, что не нравится вся кухня — возможно, сегодня хотелось другое."
    });
  }

  return [...facts, ...hypotheses];
}

function countIngredients(dishes: Dish[], watch: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const dish of dishes) {
    for (const item of watch) {
      if (dish.ingredients.some((ing) => ing.toLowerCase().includes(item))) {
        map.set(item, (map.get(item) ?? 0) + 1);
      }
    }
  }
  return map;
}

function cuisinePhrase(name: string): string {
  return name.replace(/ская$/i, "ской").replace(/ая$/i, "ой");
}

function plural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}
