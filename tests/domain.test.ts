import { describe, expect, it } from "vitest";
import { canonicalGroups, oneCardPerDish, relateDishes } from "../src/domain/dedupe";
import { allergiesIntact, applyHardFilters, dishMatchesConstraints, relaxOptional } from "../src/domain/filters";
import { cookLines, hasIngredient } from "../src/domain/pantry";
import {
  applyPrioritiesToProfile,
  deckFromPriorities,
  exportPriorities,
  normalizePriorities,
  rankByPriorities
} from "../src/domain/priorities";
import { applyReactionToProfile, buildDeck, DEFAULT_PROFILE, scoreDish } from "../src/domain/ranking";
import { buildReport } from "../src/domain/report";
import {
  beginTournament,
  createSession,
  defaultConstraints,
  finishTournament,
  normalizeConstraints,
  prepareDeck,
  react
} from "../src/domain/session";
import {
  chooseWinner,
  seedFinalists,
  skipPair,
  startTournament,
  tournamentChampion,
  undoTournament
} from "../src/domain/tournament";
import { cardBlurb, detectMethod, heroIngredients } from "../src/domain/cardCopy";
import { classifyProtein } from "../src/domain/protein";
import { FEATURED_CUISINES, orderCuisines } from "../src/copy";
import { applyOverrides, emptyOverrides, looksUntranslated, upsertOverrides } from "../src/domain/overrides";
import type { Catalog, Dish, Recipe, Session } from "../src/types";

function dish(partial: Partial<Dish> & { id: string; canonicalName: string }): Dish {
  return {
    aliases: [partial.canonicalName],
    cuisine: "Итальянская",
    categories: ["Паста"],
    description: partial.canonicalName,
    ingredients: ["паста", "помидоры"],
    originalIngredients: ["pasta", "tomato"],
    allergens: ["глютен"],
    recipeIds: [],
    source: "themealdb",
    sourceId: partial.id,
    ...partial
  };
}

const carbonara = dish({
  id: "d1",
  canonicalName: "Карбонара",
  originalName: "Spaghetti alla Carbonara",
  sourceId: "1",
  ingredients: ["паста", "яйца", "бекон"],
  originalIngredients: ["pasta", "egg", "bacon"],
  allergens: ["глютен", "яйца"]
});
const bolognese = dish({
  id: "d2",
  canonicalName: "Болоньезе",
  originalName: "Spaghetti Bolognese",
  sourceId: "2",
  cuisine: "Итальянская",
  ingredients: ["паста", "говядина", "помидоры"],
  originalIngredients: ["pasta", "beef", "tomato"]
});
const pho = dish({
  id: "d3",
  canonicalName: "Фо с говядиной",
  originalName: "Beef pho",
  sourceId: "3",
  cuisine: "Вьетнамская",
  categories: ["Говядина"],
  ingredients: ["рис", "говядина", "корица"],
  originalIngredients: ["rice", "beef", "cinnamon"],
  allergens: []
});
const rendang = dish({
  id: "d4",
  canonicalName: "Ренданг",
  originalName: "Beef Rendang",
  sourceId: "4",
  cuisine: "Малайзийская",
  categories: ["Говядина"],
  ingredients: ["говядина", "кокосовое молоко"],
  originalIngredients: ["beef", "coconut milk"],
  allergens: []
});
const karaage = dish({
  id: "d5",
  canonicalName: "Карааге",
  originalName: "Chicken Karaage",
  sourceId: "5",
  cuisine: "Японская",
  categories: ["Курица"],
  ingredients: ["курица", "соевый соус", "имбирь"],
  originalIngredients: ["chicken", "soy sauce", "ginger"],
  allergens: ["соя", "глютен"],
  protein: "chicken",
  style: "healthy"
});
const porkChop = dish({
  id: "d6",
  canonicalName: "Свинина в сидре",
  originalName: "Coddled pork with cider",
  sourceId: "6",
  cuisine: "Британская",
  categories: ["Свинина"],
  ingredients: ["свинина", "сидр", "картофель"],
  originalIngredients: ["pork", "cider", "potato"],
  allergens: [],
  protein: "pork",
  style: "hearty"
});

describe("dedupe", () => {
  it("matches source + sourceId", () => {
    const copy = dish({ ...carbonara, id: "other", canonicalName: "Другое имя" });
    expect(relateDishes(carbonara, copy).relation).toBe("sameDish");
  });

  it("matches normalized names and aliases", () => {
    const copy = dish({
      id: "x",
      canonicalName: "spaghetti alla carbonara",
      originalName: "Carbonara",
      aliases: ["Карбонара"],
      source: "other",
      sourceId: "99"
    });
    expect(relateDishes(carbonara, copy).relation).toBe("sameDish");
  });

  it("does not merge similar but unrelated dishes", () => {
    expect(relateDishes(carbonara, bolognese).relation).toBe("unrelated");
  });

  it("keeps one card per canonical dish", () => {
    const clone = dish({ ...carbonara, id: "d1b", canonicalName: "Карбонара " });
    const result = oneCardPerDish([carbonara, clone, pho]);
    expect(result).toHaveLength(2);
    expect(canonicalGroups([carbonara, clone]).size).toBe(1);
  });
});

describe("filters", () => {
  it("applies allergens before anything else", () => {
    const hit = dishMatchesConstraints(carbonara, { ...defaultConstraints(), allergens: ["яйца"] });
    expect(hit.ok).toBe(false);
    expect(hit.reasons).toContain("allergen");
  });

  it("does not auto-drop allergies when relaxing optional filters", () => {
    const before = { ...defaultConstraints(), allergens: ["молоко"], maxMinutes: 20, vegetarian: true };
    const after = relaxOptional(before);
    expect(allergiesIntact(before, after)).toBe(true);
    expect(after.allergens).toEqual(["молоко"]);
    expect(after.maxMinutes).toBeUndefined();
  });

  it("filters cuisine, time and recent repeats", () => {
    const slow = dish({ ...pho, preparationMinutes: 90 });
    const { passed } = applyHardFilters(
      [slow, karaage],
      { ...defaultConstraints(), maxMinutes: 40, excludedCuisines: ["Японская"] },
      []
    );
    expect(passed.map((d) => d.id)).toEqual([]);
  });

  it("drops dishes with excluded ingredients", () => {
    const hit = dishMatchesConstraints(pho, { ...defaultConstraints(), excludedIngredients: ["говядина"] });
    expect(hit.ok).toBe(false);
    expect(hit.reasons).toContain("ingredient");
    expect(dishMatchesConstraints(karaage, { ...defaultConstraints(), excludedIngredients: ["говядина"] }).ok).toBe(true);
  });

  it("keeps only selected cuisines when the include list is set", () => {
    const { passed } = applyHardFilters(
      [carbonara, pho, karaage],
      { ...defaultConstraints(), selectedCuisines: ["Итальянская"] },
      []
    );
    expect(passed.map((d) => d.id)).toEqual(["d1"]);
  });

  it("treats an empty cuisine list as any kitchen", () => {
    expect(dishMatchesConstraints(pho, defaultConstraints()).ok).toBe(true);
    expect(dishMatchesConstraints(carbonara, defaultConstraints()).ok).toBe(true);
  });

  it("clears selected cuisines when relaxing optional filters", () => {
    const after = relaxOptional({ ...defaultConstraints(), selectedCuisines: ["Русская"], maxMinutes: 20 });
    expect(after.selectedCuisines).toEqual([]);
    expect(after.maxMinutes).toBeUndefined();
  });

  it("puts italian and russian kitchens first", () => {
    const ordered = orderCuisines(["Японская", "Русская", "Итальянская", "Польская"]);
    expect(ordered.slice(0, 2)).toEqual(["Итальянская", "Русская"]);
    expect(ordered[0]).toBe(FEATURED_CUISINES[0]);
    expect(ordered.at(-1)).toBe("Польская");
  });
});

describe("catalog overrides", () => {
  const catalog: Catalog = {
    version: 1,
    generatedAt: "",
    source: "test",
    attribution: "",
    dishes: [carbonara, pho],
    recipes: []
  };

  it("patches a russian name without mutating the base dish", () => {
    const next = applyOverrides(catalog, {
      version: 1,
      updatedAt: "",
      dishes: { d1: { canonicalName: "Спагетти карбонара" } },
      recipes: {}
    });
    expect(next.dishes[0].canonicalName).toBe("Спагетти карбонара");
    expect(next.dishes[0].aliases[0]).toBe("Спагетти карбонара");
    expect(catalog.dishes[0].canonicalName).toBe("Карбонара");
    expect(next.dishes[1]).toBe(pho);
  });

  it("flags leftover latin in the russian title", () => {
    expect(looksUntranslated(carbonara)).toBe(false);
    expect(
      looksUntranslated(dish({ id: "x", canonicalName: "Avocado dip с new potatoes", originalName: "Avocado dip" }))
    ).toBe(true);
  });

  it("removes a dish override when the patch is empty", () => {
    const patched = upsertOverrides(emptyOverrides(), "d1", { canonicalName: "Новое" }, undefined, null);
    expect(patched.dishes.d1?.canonicalName).toBe("Новое");
    const cleared = upsertOverrides(patched, "d1", null, undefined, null);
    expect(cleared.dishes.d1).toBeUndefined();
  });
});

describe("tournament", () => {
  it("handles odd counts with a bye and does not drop anyone", () => {
    let t = startTournament(["a", "b", "c"]);
    const seen = new Set<string>();
    const collect = () => {
      for (const id of [...t.remaining, ...t.winners, ...(t.current ?? [])]) seen.add(id);
      if (t.bye) seen.add(t.bye);
    };
    collect();
    expect(t.current).toHaveLength(2);
    expect(t.remaining.length + t.winners.length + (t.current?.length ?? 0)).toBe(3);
    while (t.current) {
      t = chooseWinner(t, t.current[0]);
      collect();
    }
    expect(tournamentChampion(t)).toBeTruthy();
    expect(seen.size).toBe(3);
  });

  it("skip keeps both dishes", () => {
    let t = startTournament(["a", "b", "c", "d"]);
    const pair = t.current!;
    t = skipPair(t);
    const pool = new Set([...t.remaining, ...t.winners, ...(t.current ?? [])]);
    expect(pool.has(pair[0])).toBe(true);
    expect(pool.has(pair[1])).toBe(true);
  });

  it("undo restores the previous pairing", () => {
    let t = startTournament(["a", "b"]);
    const pair = t.current!;
    t = chooseWinner(t, pair[0]);
    t = undoTournament(t);
    expect(t.current).toEqual(pair);
    expect(tournamentChampion(t)).toBeUndefined();
  });

  it("diversifies similar dishes", () => {
    const seeded = seedFinalists([carbonara, bolognese, pho, rendang, karaage], {
      random: () => 0.42
    });
    expect(seeded).toHaveLength(5);
  });
});

describe("ranking and deck", () => {
  it("does not treat a single left swipe as cuisine dislike", () => {
    const afterNo = applyReactionToProfile(DEFAULT_PROFILE, carbonara, "no");
    expect(afterNo.cuisineScores["Итальянская"] ?? 0).toBeGreaterThan(-0.1);
    const afterLove = applyReactionToProfile(DEFAULT_PROFILE, pho, "love");
    expect(afterLove.cuisineScores["Вьетнамская"]).toBeGreaterThan(0.4);
  });

  it("builds a unique deck within size", () => {
    const catalog = [carbonara, bolognese, pho, rendang, karaage];
    const { deck, passed } = prepareDeck(catalog, "feed", defaultConstraints(), DEFAULT_PROFILE, []);
    expect(passed.length).toBe(5);
    expect(new Set(deck.map((d) => d.id)).size).toBe(deck.length);
  });

  it("scores novelty higher for unseen dishes", () => {
    const profile = { ...DEFAULT_PROFILE, seenDishIds: ["d1"] };
    const seen = scoreDish(carbonara, {
      profile,
      mode: "explore",
      constraints: defaultConstraints(),
      deckSoFar: [],
      recentWinnerIds: []
    });
    const fresh = scoreDish(pho, {
      profile,
      mode: "explore",
      constraints: defaultConstraints(),
      deckSoFar: [],
      recentWinnerIds: []
    });
    expect(fresh.N).toBeGreaterThan(seen.N);
  });

  it("explore mix stays deterministic enough to test", () => {
    const catalog = Array.from({ length: 20 }, (_, i) =>
      dish({
        id: `x${i}`,
        canonicalName: `Блюдо ${i}`,
        sourceId: `x${i}`,
        cuisine: i % 2 ? "Японская" : "Итальянская",
        categories: [i % 2 ? "Курица" : "Паста"]
      })
    );
    const deck = buildDeck(catalog, {
      profile: DEFAULT_PROFILE,
      mode: "explore",
      constraints: defaultConstraints(),
      recentWinnerIds: [],
      size: 12,
      random: () => 0.5
    });
    expect(deck).toHaveLength(12);
  });

  it("cools down recently shown dishes so the next deck rotates", () => {
    const catalog = Array.from({ length: 40 }, (_, i) =>
      dish({
        id: `r${i}`,
        canonicalName: `Блюдо ${i}`,
        sourceId: `r${i}`,
        cuisine: i % 3 ? "Японская" : "Итальянская",
        categories: ["Курица"],
        ingredients: ["курица", "лук"],
        originalIngredients: ["chicken", "onion"],
        protein: "chicken"
      })
    );
    const first = buildDeck(catalog, {
      profile: DEFAULT_PROFILE,
      mode: "feed",
      constraints: defaultConstraints(),
      recentWinnerIds: [],
      random: () => 0.5
    });
    expect(first.length).toBeGreaterThan(10);
    let profile = DEFAULT_PROFILE;
    for (const d of first) profile = applyReactionToProfile(profile, d, "skip");
    expect(profile.recentShownIds[0]).toBe(first[first.length - 1].id);
    expect(profile.recentShownIds).toHaveLength(first.length);

    const second = prepareDeck(catalog, "feed", defaultConstraints(), profile, []);
    const overlap = second.deck.filter((d) => first.some((x) => x.id === d.id));
    expect(overlap).toHaveLength(0);
    expect(second.deck.length).toBeGreaterThan(10);
  });

  it("lets older seen dishes return after they leave the cooldown window", () => {
    const cooledProfile = {
      ...DEFAULT_PROFILE,
      seenDishIds: ["d1"],
      recentShownIds: Array.from({ length: 40 }, (_, i) => `old${i}`)
    };
    const recentProfile = {
      ...cooledProfile,
      recentShownIds: ["d1", ...cooledProfile.recentShownIds]
    };
    const ctx = {
      mode: "feed" as const,
      constraints: defaultConstraints(),
      deckSoFar: [] as typeof carbonara[],
      recentWinnerIds: [] as string[]
    };
    const cooled = scoreDish(carbonara, { ...ctx, profile: cooledProfile });
    const recent = scoreDish(carbonara, { ...ctx, profile: recentProfile });
    expect(cooled.N).toBeGreaterThan(recent.N);
    expect(recent.R).toBeGreaterThan(cooled.R);
  });
});

describe("session restore and report", () => {
  it("round-trips a session JSON snapshot", () => {
    let session = createSession("feed", defaultConstraints(), ["d1", "d3", "d4"]);
    session = react(session, "d1", "yes");
    session = react(session, "d3", "love");
    const restored = JSON.parse(JSON.stringify(session)) as Session;
    expect(restored.reactions).toHaveLength(2);
    expect(restored.deck).toEqual(session.deck);
  });

  it("builds a report from real actions only", () => {
    let session = createSession("explore", defaultConstraints(), ["d1", "d3", "d4", "d5"]);
    session = react(session, "d1", "yes");
    session = react(session, "d3", "love");
    session = react(session, "d4", "no");
    const dishes = new Map([
      [carbonara.id, carbonara],
      [pho.id, pho],
      [rendang.id, rendang],
      [karaage.id, karaage]
    ]);
    session = beginTournament(session, dishes);
    while (session.tournament?.current) {
      session = {
        ...session,
        tournament: chooseWinner(session.tournament, session.tournament.current[0])
      };
    }
    session = finishTournament(session);
    const report = buildReport(session, dishes, DEFAULT_PROFILE);
    expect(report.viewed).toBe(3);
    expect(report.likes).toBe(2);
    expect(report.winnerId).toBeTruthy();
    expect(report.observations.some((o) => o.kind === "fact")).toBe(true);
    expect(report.observations.some((o) => o.kind === "hypothesis")).toBe(true);
    expect(report.observations.every((o) => !/не любите|настоящий вкус/i.test(o.text))).toBe(true);
  });
});

describe("pantry and appetite", () => {
  it("matches chicken stems in Russian and English", () => {
    expect(hasIngredient(["куриная грудка"], "курица")).toBe(true);
    expect(hasIngredient(["Chicken Thighs"], "курица")).toBe(true);
    expect(hasIngredient(["свиной фарш"], "свинина")).toBe(true);
    expect(hasIngredient(["куриный бульон"], "курица")).toBe(false);
    expect(hasIngredient(["chicken stock"], "курица")).toBe(false);
  });

  it("marks pantry items on the cook list", () => {
    const lines = cookLines(karaage, undefined, ["курица"], ["имбирь"]);
    const chicken = lines.find((l) => l.name === "курица");
    const ginger = lines.find((l) => l.name === "имбирь");
    expect(chicken?.have).toBe(true);
    expect(ginger?.wanted).toBe(true);
  });

  it("prefers chicken and pork over beef for this household", () => {
    const ctx = {
      profile: DEFAULT_PROFILE,
      mode: "feed" as const,
      constraints: defaultConstraints(),
      deckSoFar: [],
      recentWinnerIds: []
    };
    const chickenScore = scoreDish(karaage, ctx);
    const porkScore = scoreDish(porkChop, ctx);
    const beefScore = scoreDish(pho, { ...ctx, constraints: defaultConstraints() });
    expect(chickenScore.P).toBeGreaterThan(beefScore.P);
    expect(porkScore.P).toBeGreaterThan(beefScore.P);
  });

  it("shifts context for hearty vs healthy appetite", () => {
    const hearty = scoreDish(porkChop, {
      profile: DEFAULT_PROFILE,
      mode: "explore",
      constraints: { ...defaultConstraints(), appetite: "hearty" },
      deckSoFar: [],
      recentWinnerIds: []
    });
    const healthy = scoreDish(porkChop, {
      profile: DEFAULT_PROFILE,
      mode: "explore",
      constraints: { ...defaultConstraints(), appetite: "healthy" },
      deckSoFar: [],
      recentWinnerIds: []
    });
    expect(hearty.C).toBeGreaterThan(healthy.C);
  });

  it("boosts dishes that contain a wanted ingredient", () => {
    const withWant = scoreDish(porkChop, {
      profile: DEFAULT_PROFILE,
      mode: "feed",
      constraints: { ...defaultConstraints(), wantedIngredients: ["картофель"] },
      deckSoFar: [],
      recentWinnerIds: []
    });
    const without = scoreDish(porkChop, {
      profile: DEFAULT_PROFILE,
      mode: "feed",
      constraints: defaultConstraints(),
      deckSoFar: [],
      recentWinnerIds: []
    });
    expect(withWant.P).toBeGreaterThan(without.P);
  });

  it("keeps old vegan flags off when restoring constraints", () => {
    const next = normalizeConstraints({ vegetarian: true, vegan: true, allergens: ["молоко"] });
    expect(next.vegetarian).toBe(false);
    expect(next.vegan).toBe(false);
    expect(next.haveIngredients).toEqual(["курица", "свинина"]);
  });
});

describe("card copy", () => {
  const stew: Recipe = {
    id: "r1",
    dishId: "d-stew",
    title: "Coq au vin",
    ingredients: ["курица", "бекон", "вино"],
    measures: ["1", "100g", "500ml"],
    instructions: [
      "Fry the bacon until crisp, then brown the chicken.",
      "Cover, lower the heat to a gentle simmer and cook for 50 mins."
    ],
    sourceUrl: "https://example.com"
  };

  it("detects stew even if the recipe starts with a fry", () => {
    const d = dish({
      id: "d-stew",
      canonicalName: "Кок-о-вен",
      originalName: "Coq au vin",
      protein: "chicken",
      difficulty: "hard",
      ingredients: ["курица", "бекон", "вино", "грибы", "соль"]
    });
    expect(detectMethod(d, stew)).toBe("stew");
    const text = cardBlurb(d, stew);
    expect(text).toMatch(/Тушим курицу/);
    expect(text).toMatch(/Французская|Итальянская|кухня/);
    expect(heroIngredients(d)).toContain("бекон");
    expect(text).not.toMatch(/пошагово из источника/);
    expect(text).not.toMatch(/ с бекон/);
  });

  it("detects oven dishes from the title", () => {
    const d = dish({
      id: "d-bake",
      canonicalName: "Запечённый рис",
      originalName: "Arroz al horno baked rice",
      protein: "pork",
      ingredients: ["рис", "свинина", "фасоль", "перец"]
    });
    expect(detectMethod(d)).toBe("bake");
    expect(cardBlurb(d)).toMatch(/Запекаем свинину/);
  });

  it("skips staples and the main protein in the hero list", () => {
    const d = dish({
      id: "d-h",
      canonicalName: "Курица",
      protein: "chicken",
      ingredients: ["курица", "соль", "оливковое масло", "лимон", "чеснок"]
    });
    expect(heroIngredients(d)).toEqual(["лимон", "чеснок"]);
  });

  it("does not treat chicken stock as chicken when the dish is pork", () => {
    const d = dish({
      id: "cider-pork",
      canonicalName: "Свинина в сидре",
      originalName: "Coddled pork with cider",
      protein: "chicken",
      ingredients: ["сливочное масло", "свинина", "бекон", "картофель", "куриный бульон"],
      originalIngredients: ["Butter", "Pork Chops", "Bacon", "Potatoes", "Chicken Stock"]
    });
    expect(classifyProtein(d)).toBe("pork");
    expect(cardBlurb(d)).toMatch(/свинин|отбивн/);
    expect(cardBlurb(d)).not.toMatch(/куриц/);
  });

  it("does not treat nuoc cham as ham", () => {
    const d = dish({
      id: "tempura",
      canonicalName: "Темпура из брокколи с ныок-чам",
      originalName: "Purple sprouting broccoli tempura with nuoc cham",
      protein: "pork",
      categories: ["Разное"],
      ingredients: ["мука", "кунжут", "брокколи", "рыбный соус", "лайм"],
      originalIngredients: ["Corn Flour", "Sesame Seed", "Purple Sprouting Broccoli", "Fish Sauce", "Lime"]
    });
    expect(classifyProtein(d)).toBe("veg");
    expect(cardBlurb(d)).not.toMatch(/свинин/);
  });

  it("keeps beef as beef even with a ham wrapping", () => {
    const d = dish({
      id: "wellington",
      canonicalName: "Биф Веллингтон",
      originalName: "Beef Wellington",
      protein: "pork",
      categories: ["Говядина"],
      ingredients: ["грибы", "горчица", "говядина", "ветчина"],
      originalIngredients: ["mushrooms", "English Mustard", "Beef Fillet", "Parma ham"]
    });
    expect(classifyProtein(d)).toBe("beef");
    expect(cardBlurb(d)).toMatch(/говяд|говяж/);
    expect(cardBlurb(d)).not.toMatch(/свинин/);
  });

  it("does not call lamb or duck vegetarian", () => {
    const lamb = dish({
      id: "tagine",
      canonicalName: "Тажин из ягнёнка",
      originalName: "Lamb Tagine",
      protein: "veg",
      ingredients: ["баранина", "лук", "морковь"],
      originalIngredients: ["Lamb Leg", "Onion", "Carrots"]
    });
    const duck = dish({
      id: "duck",
      canonicalName: "Утиный рагу",
      originalName: "Venetian Duck Ragu",
      protein: "veg",
      ingredients: ["утка", "вино", "помидоры"],
      originalIngredients: ["Duck Legs", "Red Wine", "Chopped Tomatoes"]
    });
    expect(classifyProtein(lamb)).toBe("other");
    expect(classifyProtein(duck)).toBe("other");
    expect(cardBlurb(lamb)).not.toMatch(/куриц|свинин/);
  });

  it("uses a real source description instead of a generated meat line", () => {
    const d = dish({
      id: "chowder",
      canonicalName: "Клэм-чаудер",
      originalName: "Clam chowder",
      protein: "pork",
      cuisine: "Американская",
      description: "Сливочный суп из моллюсков с беконом и картофелем.",
      ingredients: ["моллюски", "бекон", "картофель"],
      originalIngredients: ["Clams", "Bacon", "Potatoes"]
    });
    expect(cardBlurb(d)).toBe("Сливочный суп из моллюсков с беконом и картофелем.");
    expect(classifyProtein(d)).toBe("fish");
  });
});

describe("priority export and match-by-weights", () => {
  it("exports scores and weights without rotation history", () => {
    const profile = {
      ...DEFAULT_PROFILE,
      cuisineScores: { Итальянская: 1.4 },
      lovedDishIds: ["d1"],
      seenDishIds: ["d1", "d3"],
      recentShownIds: ["d1", "d2", "d3"]
    };
    const snap = exportPriorities(profile, "2026-10-10T12:00:00.000Z");
    expect(snap.version).toBe(1);
    expect(snap.cuisineScores.Итальянская).toBe(1.4);
    expect(snap.lovedDishIds).toEqual(["d1"]);
    expect(snap.weights.wp).toBe(DEFAULT_PROFILE.weights.wp);
    expect(JSON.stringify(snap)).not.toMatch(/seenDishIds|recentShownIds/);
  });

  it("round-trips a JSON snapshot onto a live profile without wiping rotation", () => {
    const live = {
      ...DEFAULT_PROFILE,
      seenDishIds: ["d3"],
      recentShownIds: ["d3", "d4"]
    };
    const file = exportPriorities({
      ...DEFAULT_PROFILE,
      cuisineScores: { Вьетнамская: 2 },
      categoryScores: { Говядина: 1.1 },
      ingredientScores: { корица: 0.9 },
      lovedDishIds: ["d3"],
      weights: { ...DEFAULT_PROFILE.weights, wp: 1.6, wr: 0.4 }
    });
    const parsed = normalizePriorities(JSON.parse(JSON.stringify(file)));
    expect(parsed).not.toBeNull();
    const next = applyPrioritiesToProfile(live, parsed!);
    expect(next.cuisineScores.Вьетнамская).toBe(2);
    expect(next.weights.wp).toBe(1.6);
    expect(next.lovedDishIds).toEqual(["d3"]);
    expect(next.seenDishIds).toEqual(["d3"]);
    expect(next.recentShownIds).toEqual(["d3", "d4"]);
  });

  it("rejects unrelated JSON", () => {
    expect(normalizePriorities(null)).toBeNull();
    expect(normalizePriorities({ hello: "world" })).toBeNull();
  });

  it("ranks leftover dishes by the exported weights", () => {
    const profile = {
      ...DEFAULT_PROFILE,
      cuisineScores: { Итальянская: 2.4, Вьетнамская: 0 },
      categoryScores: { Паста: 1.8 },
      ingredientScores: { паста: 1.2 },
      lovedDishIds: []
    };
    const ranked = rankByPriorities([pho, carbonara, bolognese], profile, {
      constraints: { ...defaultConstraints(), avoidRecent: false },
      mode: "feed"
    });
    expect(ranked[0].dish.id).toBe("d1");
    expect(ranked.map((r) => r.dish.id)).not.toContain("missing");
    expect(ranked[0].P).toBeGreaterThan(ranked[ranked.length - 1].P);
  });

  it("builds a weighted deck that skips already chosen dishes", () => {
    const profile = {
      ...DEFAULT_PROFILE,
      cuisineScores: { Итальянская: 3, Японская: -1 },
      categoryScores: { Паста: 2 },
      ingredientScores: { паста: 2 },
      lovedDishIds: ["d1"]
    };
    const deck = deckFromPriorities([carbonara, bolognese, pho, rendang, karaage], profile, {
      constraints: { ...defaultConstraints(), avoidRecent: false, haveIngredients: [] },
      mode: "feed",
      excludeIds: ["d1"],
      size: 3
    });
    expect(deck.map((d) => d.id)).not.toContain("d1");
    expect(deck).toHaveLength(3);
    expect(deck[0].id).toBe("d2");
  });
});

