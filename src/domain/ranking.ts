import type { Constraints, Dish, Mode, RankingWeights, TasteProfile } from "../types";
import { householdProtein, matchingNeedles } from "./pantry";
import { classifyProtein } from "./protein";
import { clamp, jaccard, shuffle, unique } from "./text";

export const DEFAULT_WEIGHTS: RankingWeights = {
  wp: 1,
  wc: 0.85,
  wn: 0.8,
  wv: 0.8,
  wr: 1.25
};

/** How many recently shown cards to hard-drop, and how long recency scoring lasts. */
export const ROTATION = {
  hardWindow: 28,
  softWindow: 56,
  winnerWindow: 10,
  shownCap: 80,
  minPool: 18
} as const;

export const DEFAULT_PROFILE: TasteProfile = {
  cuisineScores: {},
  categoryScores: { Курица: 0.9, Свинина: 0.8 },
  ingredientScores: { курица: 0.7, свинина: 0.6 },
  lovedDishIds: [],
  seenDishIds: [],
  recentShownIds: [],
  difficultyBias: 0,
  noveltyHunger: 0.35,
  exploreShare: 0.32,
  weights: DEFAULT_WEIGHTS
};

export function normalizeProfile(raw?: Partial<TasteProfile> | null): TasteProfile {
  if (!raw) return DEFAULT_PROFILE;
  return {
    ...DEFAULT_PROFILE,
    ...raw,
    cuisineScores: raw.cuisineScores ?? {},
    categoryScores: raw.categoryScores ?? DEFAULT_PROFILE.categoryScores,
    ingredientScores: raw.ingredientScores ?? DEFAULT_PROFILE.ingredientScores,
    lovedDishIds: raw.lovedDishIds ?? [],
    seenDishIds: raw.seenDishIds ?? [],
    recentShownIds: raw.recentShownIds ?? [],
    weights: { ...DEFAULT_WEIGHTS, ...(raw.weights ?? {}) }
  };
}

export function recentShownOf(profile: TasteProfile): string[] {
  return profile.recentShownIds ?? [];
}

export function rememberShown(list: string[] | undefined, id: string, cap = ROTATION.shownCap): string[] {
  return [id, ...(list ?? []).filter((x) => x !== id)].slice(0, cap);
}

export function rotationExcludeIds(profile: TasteProfile, recentWinnerIds: string[]): string[] {
  const shown = recentShownOf(profile).slice(0, ROTATION.hardWindow);
  const winners = recentWinnerIds.filter(Boolean).slice(0, ROTATION.winnerWindow);
  return unique([...winners, ...shown]);
}

export function deckSizeFor(mode: Mode, override?: number): number {
  if (override != null) return override;
  if (mode === "feed") return 16;
  if (mode === "explore") return 22;
  return 16;
}

/** Preference term P of S = wpP + wcC + wnN + wvV − wrR. */
export function preferenceScore(dish: Dish, profile: TasteProfile, constraints: Constraints): number {
  const cuisine = profile.cuisineScores[dish.cuisine] ?? 0;
  const cats = dish.categories.reduce((sum, c) => sum + (profile.categoryScores[c] ?? 0), 0);
  const ings = dish.ingredients.reduce((sum, ing) => sum + (profile.ingredientScores[ing] ?? 0), 0);
  const loved = profile.lovedDishIds.includes(dish.id) ? 1 : 0;
  const haveHits = matchingNeedles(dish, constraints.haveIngredients);
  const wantHits = matchingNeedles(dish, constraints.wantedIngredients);
  const kind = classifyProtein(dish);
  const proteinBoost = householdProtein(dish) ? 0.62 : kind === "veg" ? -0.14 : kind === "other" ? 0 : 0.04;
  const pantry = clamp(haveHits.length * 0.18 + wantHits.length * 0.28, 0, 1);
  return clamp((cuisine * 0.35 + cats * 0.18 + ings * 0.08 + loved * 0.5 + proteinBoost + pantry) / 2.2, 0, 1);
}

export function scoreDish(
  dish: Dish,
  ctx: {
    profile: TasteProfile;
    mode: Mode;
    constraints: Constraints;
    deckSoFar: Dish[];
    recentWinnerIds: string[];
  }
): { total: number; P: number; C: number; N: number; V: number; R: number } {
  const { profile, mode, deckSoFar, recentWinnerIds } = ctx;
  const w = profile.weights;
  const P = preferenceScore(dish, profile, ctx.constraints);
  const kind = classifyProtein(dish);

  let C = 0.5;
  const appetite = ctx.constraints.appetite;
  if (appetite === "healthy") {
    C = dish.style === "healthy" ? 0.82 : dish.style === "hearty" ? 0.28 : 0.5;
  } else if (appetite === "hearty") {
    C = dish.style === "hearty" ? 0.86 : dish.style === "healthy" ? 0.32 : 0.55;
  }
  if (mode === "feed") {
    const easy = dish.difficulty === "easy" ? 0.18 : dish.difficulty === "hard" ? -0.15 : 0.04;
    const fast = (dish.preparationMinutes ?? 45) <= 35 ? 0.18 : (dish.preparationMinutes ?? 45) <= 55 ? 0.08 : -0.06;
    C = clamp(C * 0.7 + 0.3 * (0.5 + easy + fast), 0, 1);
  } else if (mode === "explore") {
    C = clamp(C * 0.6 + 0.35 + profile.noveltyHunger * 0.3, 0, 1);
  } else if (mode === "tournament") {
    const wanted = ctx.constraints.selectedCategories;
    if (wanted.length && dish.categories.some((c) => wanted.includes(c))) C = clamp(C + 0.2, 0, 1);
  }

  const shownAt = recentShownOf(profile).indexOf(dish.id);
  const seen = profile.seenDishIds.includes(dish.id);
  let N: number;
  if (shownAt >= 0 && shownAt < 12) N = 0.04;
  else if (shownAt >= 0 && shownAt < 28) N = 0.12;
  else if (shownAt >= 0 && shownAt < ROTATION.softWindow) N = 0.28;
  else if (seen) N = clamp(0.42 + profile.noveltyHunger * 0.25, 0, 1);
  else N = clamp(0.58 + profile.noveltyHunger, 0, 1);
  if (dish.isNew && shownAt < 0) N = clamp(N + 0.14, 0, 1);

  const cuisineAlready = deckSoFar.filter((d) => d.cuisine === dish.cuisine).length;
  const catOverlap = deckSoFar.some((d) => d.categories.some((c) => dish.categories.includes(c)));
  const similar = deckSoFar.some((d) => jaccard(d.ingredients, dish.ingredients) > 0.55);
  const proteinAlready = kind ? deckSoFar.filter((d) => classifyProtein(d) === kind).length : 0;
  const V = clamp(
    1 - cuisineAlready * 0.32 - (catOverlap ? 0.1 : 0) - (similar ? 0.22 : 0) - proteinAlready * 0.08,
    0,
    1
  );

  const winnerIdx = recentWinnerIds.indexOf(dish.id);
  const winnerR = winnerIdx === 0 ? 1 : winnerIdx === 1 ? 0.75 : winnerIdx === 2 ? 0.55 : winnerIdx >= 0 ? 0.35 : 0;
  const shownR =
    shownAt < 0
      ? 0
      : shownAt < 4
        ? 0.9
        : shownAt < 12
          ? 0.65
          : shownAt < 28
            ? 0.4
            : shownAt < ROTATION.softWindow
              ? 0.18
              : 0;
  const R = Math.max(winnerR, shownR);

  const total = w.wp * P + w.wc * C + w.wn * N + w.wv * V - w.wr * R;
  return { total, P, C, N, V, R };
}

export function buildDeck(
  dishes: Dish[],
  ctx: {
    profile: TasteProfile;
    mode: Mode;
    constraints: Constraints;
    recentWinnerIds: string[];
    size?: number;
    random?: () => number;
  }
): Dish[] {
  const size = deckSizeFor(ctx.mode, ctx.size);
  const random = ctx.random ?? Math.random;
  const exploreShare =
    ctx.mode === "explore" ? Math.max(ctx.profile.exploreShare, 0.28) : ctx.mode === "feed" ? 0.2 : 0.24;
  const exploreCount = Math.min(Math.round(size * exploreShare), Math.max(0, dishes.length - 1));
  const prefCount = Math.max(size - exploreCount, 1);

  const pick = (from: Dish[], deck: Dish[], noveltyBoost: number): Dish | null => {
    let best: Dish | null = null;
    let bestScore = -Infinity;
    for (const dish of from) {
      const s = scoreDish(dish, {
        profile: ctx.profile,
        mode: ctx.mode,
        constraints: ctx.constraints,
        deckSoFar: deck,
        recentWinnerIds: ctx.recentWinnerIds
      });
      const jitter = (random() - 0.5) * 0.34;
      const total = s.total + noveltyBoost * s.N + jitter;
      if (total > bestScore) {
        bestScore = total;
        best = dish;
      }
    }
    return best;
  };

  const remaining = dishes.slice();
  const deck: Dish[] = [];
  const take = (target: number, noveltyBoost: number) => {
    while (deck.length < target && remaining.length) {
      const next = pick(remaining, deck, noveltyBoost);
      if (!next) break;
      deck.push(next);
      const i = remaining.findIndex((d) => d.id === next.id);
      if (i >= 0) remaining.splice(i, 1);
    }
  };
  take(Math.min(prefCount, size), 0);
  take(size, 0.55);

  return shuffle(deck, random);
}

export function applyReactionToProfile(
  profile: TasteProfile,
  dish: Dish,
  kind: "no" | "skip" | "yes" | "love"
): TasteProfile {
  const next: TasteProfile = {
    ...profile,
    cuisineScores: { ...profile.cuisineScores },
    categoryScores: { ...profile.categoryScores },
    ingredientScores: { ...profile.ingredientScores },
    lovedDishIds: profile.lovedDishIds.slice(),
    seenDishIds: uniquePush(profile.seenDishIds, dish.id),
    recentShownIds: rememberShown(profile.recentShownIds, dish.id)
  };

  const bump = kind === "love" ? 0.55 : kind === "yes" ? 0.28 : kind === "skip" ? 0 : -0.08;
  next.cuisineScores[dish.cuisine] = clamp((next.cuisineScores[dish.cuisine] ?? 0) + bump, -1.5, 3);
  for (const cat of dish.categories) {
    next.categoryScores[cat] = clamp((next.categoryScores[cat] ?? 0) + bump * 0.8, -1.5, 3);
  }
  if (kind === "yes" || kind === "love") {
    for (const ing of dish.ingredients.slice(0, 8)) {
      next.ingredientScores[ing] = clamp((next.ingredientScores[ing] ?? 0) + (kind === "love" ? 0.18 : 0.08), 0, 3);
    }
  }
  if (kind === "love" && !next.lovedDishIds.includes(dish.id)) next.lovedDishIds.push(dish.id);
  if (kind === "no") {
    next.cuisineScores[dish.cuisine] = clamp((next.cuisineScores[dish.cuisine] ?? 0) + 0.04, -1.5, 3);
  }
  return next;
}

function uniquePush(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}
