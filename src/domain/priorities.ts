import type { Constraints, Dish, Mode, RankingWeights, TasteProfile } from "../types";
import { oneCardPerDish } from "./dedupe";
import { applyHardFilters } from "./filters";
import {
  DEFAULT_PROFILE,
  DEFAULT_WEIGHTS,
  deckSizeFor,
  ROTATION,
  rotationExcludeIds,
  scoreDish
} from "./ranking";
import { unique } from "./text";

export const PRIORITIES_VERSION = 1;

/** Portable taste snapshot: scores and ranking weights, without rotation history. */
export type TastePriorities = {
  version: number;
  exportedAt: string;
  cuisineScores: Record<string, number>;
  categoryScores: Record<string, number>;
  ingredientScores: Record<string, number>;
  lovedDishIds: string[];
  difficultyBias: number;
  noveltyHunger: number;
  exploreShare: number;
  weights: RankingWeights;
};

export type RankedDish = {
  dish: Dish;
  total: number;
  P: number;
  C: number;
  N: number;
  V: number;
  R: number;
};

export function exportPriorities(profile: TasteProfile, exportedAt = new Date().toISOString()): TastePriorities {
  return {
    version: PRIORITIES_VERSION,
    exportedAt,
    cuisineScores: { ...profile.cuisineScores },
    categoryScores: { ...profile.categoryScores },
    ingredientScores: { ...profile.ingredientScores },
    lovedDishIds: profile.lovedDishIds.slice(),
    difficultyBias: profile.difficultyBias,
    noveltyHunger: profile.noveltyHunger,
    exploreShare: profile.exploreShare,
    weights: { ...profile.weights }
  };
}

export function normalizePriorities(raw: unknown): TastePriorities | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hasScores =
    isScoreMap(o.cuisineScores) ||
    isScoreMap(o.categoryScores) ||
    isScoreMap(o.ingredientScores) ||
    isScoreMap(o.weights) ||
    Array.isArray(o.lovedDishIds);
  if (!hasScores) return null;
  const weightsRaw = isScoreMap(o.weights) ? o.weights : {};
  return {
    version: typeof o.version === "number" ? o.version : PRIORITIES_VERSION,
    exportedAt: typeof o.exportedAt === "string" ? o.exportedAt : new Date().toISOString(),
    cuisineScores: scoresOf(o.cuisineScores),
    categoryScores: scoresOf(o.categoryScores),
    ingredientScores: scoresOf(o.ingredientScores),
    lovedDishIds: Array.isArray(o.lovedDishIds)
      ? o.lovedDishIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [],
    difficultyBias: finiteNumber(o.difficultyBias, 0),
    noveltyHunger: finiteNumber(o.noveltyHunger, DEFAULT_PROFILE.noveltyHunger),
    exploreShare: finiteNumber(o.exploreShare, DEFAULT_PROFILE.exploreShare),
    weights: {
      wp: finiteNumber(weightsRaw.wp, DEFAULT_WEIGHTS.wp),
      wc: finiteNumber(weightsRaw.wc, DEFAULT_WEIGHTS.wc),
      wn: finiteNumber(weightsRaw.wn, DEFAULT_WEIGHTS.wn),
      wv: finiteNumber(weightsRaw.wv, DEFAULT_WEIGHTS.wv),
      wr: finiteNumber(weightsRaw.wr, DEFAULT_WEIGHTS.wr)
    }
  };
}

export function applyPrioritiesToProfile(profile: TasteProfile, priorities: TastePriorities): TasteProfile {
  return {
    ...profile,
    cuisineScores: { ...priorities.cuisineScores },
    categoryScores: { ...priorities.categoryScores },
    ingredientScores: { ...priorities.ingredientScores },
    lovedDishIds: unique(priorities.lovedDishIds),
    difficultyBias: priorities.difficultyBias,
    noveltyHunger: priorities.noveltyHunger,
    exploreShare: priorities.exploreShare,
    weights: { ...priorities.weights }
  };
}

export function topEntries(scores: Record<string, number>, n = 8): [string, number][] {
  return Object.entries(scores)
    .filter(([, v]) => Math.abs(v) > 0.001)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export function candidateDishes(
  catalog: Dish[],
  constraints: Constraints,
  profile: TasteProfile,
  extraExclude: string[] = []
): Dish[] {
  const uniqueDishes = oneCardPerDish(catalog);
  const cooldown = constraints.avoidRecent ? rotationExcludeIds(profile, extraExclude) : extraExclude;
  const exclude = unique([...cooldown, ...extraExclude]);
  let filtered = applyHardFilters(uniqueDishes, constraints, exclude);
  if (filtered.passed.length < ROTATION.minPool && cooldown.length) {
    const relaxed = applyHardFilters(uniqueDishes, constraints, extraExclude);
    if (relaxed.passed.length > filtered.passed.length) filtered = relaxed;
  }
  return filtered.passed;
}

export function rankByPriorities(
  dishes: Dish[],
  profile: TasteProfile,
  opts: {
    constraints: Constraints;
    mode?: Mode;
    excludeIds?: string[];
    limit?: number;
  }
): RankedDish[] {
  const mode = opts.mode ?? "feed";
  const excludeIds = opts.excludeIds ?? [];
  const pool = candidateDishes(dishes, opts.constraints, profile, excludeIds);
  const ranked = pool.map((dish) => {
    const s = scoreDish(dish, {
      profile,
      mode,
      constraints: opts.constraints,
      deckSoFar: [],
      recentWinnerIds: excludeIds
    });
    return { dish, ...s };
  });
  ranked.sort((a, b) => b.total - a.total || b.P - a.P);
  return opts.limit != null ? ranked.slice(0, opts.limit) : ranked;
}

/** Preference-first deck: greedy by S with diversity V, no explore shuffle. */
export function deckFromPriorities(
  dishes: Dish[],
  profile: TasteProfile,
  opts: {
    constraints: Constraints;
    mode?: Mode;
    excludeIds?: string[];
    size?: number;
  }
): Dish[] {
  const mode = opts.mode ?? "feed";
  const size = opts.size ?? deckSizeFor(mode);
  const excludeIds = opts.excludeIds ?? [];
  const pool = candidateDishes(dishes, opts.constraints, profile, excludeIds).slice();
  const deck: Dish[] = [];
  while (deck.length < size && pool.length) {
    let best: Dish | null = null;
    let bestScore = -Infinity;
    for (const dish of pool) {
      const s = scoreDish(dish, {
        profile,
        mode,
        constraints: opts.constraints,
        deckSoFar: deck,
        recentWinnerIds: excludeIds
      });
      if (s.total > bestScore) {
        bestScore = s.total;
        best = dish;
      }
    }
    if (!best) break;
    deck.push(best);
    const i = pool.findIndex((d) => d.id === best.id);
    if (i >= 0) pool.splice(i, 1);
  }
  return deck;
}

export function downloadPriorities(priorities: TastePriorities, filename?: string): void {
  const blob = new Blob([JSON.stringify(priorities, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `chto-poest-priorities-${priorities.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isScoreMap(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scoresOf(raw: unknown): Record<string, number> {
  if (!isScoreMap(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
