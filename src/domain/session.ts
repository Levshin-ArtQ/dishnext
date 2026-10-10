import type { Constraints, Dish, Mode, Session, TasteProfile } from "../types";
import { applyHardFilters } from "./filters";
import { applyReactionToProfile, buildDeck, rememberShown, rotationExcludeIds, ROTATION } from "./ranking";
import { seedFinalists, startTournament, tournamentChampion } from "./tournament";
import { oneCardPerDish } from "./dedupe";

export function defaultConstraints(): Constraints {
  return {
    allergens: [],
    excludedIngredients: [],
    haveIngredients: ["курица", "свинина"],
    wantedIngredients: [],
    excludedCuisines: [],
    selectedCuisines: [],
    excludedCategories: [],
    selectedCategories: [],
    appetite: "any",
    vegetarian: false,
    vegan: false,
    avoidRecent: true
  };
}

export function normalizeConstraints(raw?: Partial<Constraints> | null): Constraints {
  const base = defaultConstraints();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    allergens: raw.allergens ?? [],
    excludedIngredients: raw.excludedIngredients ?? [],
    haveIngredients: raw.haveIngredients ?? base.haveIngredients,
    wantedIngredients: raw.wantedIngredients ?? [],
    excludedCuisines: raw.excludedCuisines ?? [],
    selectedCuisines: raw.selectedCuisines ?? [],
    excludedCategories: raw.excludedCategories ?? [],
    selectedCategories: raw.selectedCategories ?? [],
    appetite: raw.appetite ?? "any",
    vegetarian: false,
    vegan: false
  };
}

export function createSession(mode: Mode, constraints: Constraints, deck: string[]): Session {
  const now = Date.now();
  return {
    id: `s_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    mode,
    constraints,
    deck,
    index: 0,
    reactions: [],
    tournament: null,
    createdAt: now,
    updatedAt: now,
    runnerUpIds: [],
    earlyFinish: false
  };
}

export function prepareDeck(
  catalog: Dish[],
  mode: Mode,
  constraints: Constraints,
  profile: TasteProfile,
  recentWinnerIds: string[]
) {
  const unique = oneCardPerDish(catalog);
  const cooldown = constraints.avoidRecent ? rotationExcludeIds(profile, recentWinnerIds) : [];
  let filtered = applyHardFilters(unique, constraints, cooldown);
  if (filtered.passed.length < ROTATION.minPool && cooldown.length) {
    const winnersOnly = constraints.avoidRecent ? recentWinnerIds.filter(Boolean).slice(0, ROTATION.winnerWindow) : [];
    const relaxed = applyHardFilters(unique, constraints, winnersOnly);
    if (relaxed.passed.length > filtered.passed.length) filtered = relaxed;
  }
  const deck = buildDeck(filtered.passed, {
    profile,
    mode,
    constraints,
    recentWinnerIds
  });
  return { ...filtered, deck };
}

export function react(session: Session, dishId: string, kind: Session["reactions"][number]["kind"]): Session {
  if (session.deck[session.index] !== dishId) return session;
  return {
    ...session,
    reactions: [...session.reactions, { dishId, kind, at: Date.now() }],
    index: session.index + 1,
    updatedAt: Date.now()
  };
}

export function undoReaction(session: Session): Session {
  if (!session.reactions.length || session.tournament) return session;
  return {
    ...session,
    reactions: session.reactions.slice(0, -1),
    index: Math.max(0, session.index - 1),
    updatedAt: Date.now()
  };
}

export function positiveDishes(session: Session, dishesById: Map<string, Dish>): Dish[] {
  const loved: Dish[] = [];
  const liked: Dish[] = [];
  for (const r of session.reactions) {
    const dish = dishesById.get(r.dishId);
    if (!dish) continue;
    if (r.kind === "love") loved.push(dish);
    if (r.kind === "yes") liked.push(dish);
  }
  return [...loved, ...liked];
}

export function beginTournament(session: Session, dishesById: Map<string, Dish>): Session {
  const positives = positiveDishes(session, dishesById);
  const seeded = seedFinalists(positives, { min: 2, max: 16 });
  const ids = seeded.map((d) => d.id);
  return {
    ...session,
    tournament: startTournament(ids),
    updatedAt: Date.now()
  };
}

export function finishWithDish(session: Session, dishId: string, runnerUps: string[] = []): Session {
  return {
    ...session,
    winnerId: dishId,
    runnerUpIds: runnerUps.filter((id) => id !== dishId).slice(0, 3),
    endedAt: Date.now(),
    updatedAt: Date.now(),
    earlyFinish: true
  };
}

export function finishTournament(session: Session): Session {
  if (!session.tournament) return session;
  const winnerId = tournamentChampion(session.tournament);
  if (!winnerId) return session;
  const runners = session.tournament.history
    .filter((h) => h.winnerId && h.winnerId !== winnerId)
    .map((h) => h.winnerId!)
    .reverse();
  return {
    ...session,
    winnerId,
    runnerUpIds: [...new Set(runners)].slice(0, 3),
    endedAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function foldProfile(profile: TasteProfile, session: Session, dishesById: Map<string, Dish>): TasteProfile {
  let next = profile;
  for (const reaction of session.reactions) {
    const dish = dishesById.get(reaction.dishId);
    if (!dish) continue;
    next = applyReactionToProfile(next, dish, reaction.kind);
  }
  if (session.winnerId) {
    next = {
      ...next,
      lovedDishIds: next.lovedDishIds.includes(session.winnerId)
        ? next.lovedDishIds
        : [...next.lovedDishIds, session.winnerId],
      seenDishIds: next.seenDishIds.includes(session.winnerId)
        ? next.seenDishIds
        : [...next.seenDishIds, session.winnerId],
      recentShownIds: rememberShown(next.recentShownIds, session.winnerId)
    };
  }
  return next;
}
