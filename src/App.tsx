import { useCallback, useEffect, useMemo, useState } from "react";
import { LocalCatalogProvider, loadCatalog } from "./catalog/localProvider";
import { preload, warmCatalogImages } from "./components/Photo";
import { applyHardFilters, relaxOptional } from "./domain/filters";
import { DEFAULT_PROFILE, normalizeProfile } from "./domain/ranking";
import { buildReport } from "./domain/report";
import {
  beginTournament,
  createSession,
  defaultConstraints,
  normalizeConstraints,
  finishTournament,
  finishWithDish,
  foldProfile,
  positiveDishes,
  prepareDeck,
  react,
  undoReaction
} from "./domain/session";
import { chooseWinner, skipPair, tournamentChampion, undoTournament } from "./domain/tournament";
import { Favorites } from "./screens/Favorites";
import { Home } from "./screens/Home";
import { Recipe } from "./screens/Recipe";
import { Result } from "./screens/Result";
import { Setup } from "./screens/Setup";
import { Swipe } from "./screens/Swipe";
import { Taste } from "./screens/Taste";
import { TournamentScreen } from "./screens/TournamentScreen";
import { storage } from "./storage/db";
import type {
  Catalog,
  Constraints,
  Dish,
  Favorite,
  Mode,
  ReactionKind,
  Session,
  SessionSummary,
  TasteProfile
} from "./types";

type View = "home" | "setup" | "swipe" | "tournament" | "result" | "recipe" | "taste" | "favorites";

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("feed");
  const [constraints, setConstraints] = useState<Constraints>(defaultConstraints());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<TasteProfile>(DEFAULT_PROFILE);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [recipeDishId, setRecipeDishId] = useState<string | null>(null);
  const [boot, setBoot] = useState(true);

  const provider = useMemo(() => (catalog ? new LocalCatalogProvider(catalog) : null), [catalog]);
  const dishesById = useMemo(() => {
    const map = new Map<string, Dish>();
    for (const dish of catalog?.dishes ?? []) map.set(dish.id, dish);
    return map;
  }, [catalog]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadCatalog();
        if (cancelled) return;
        setCatalog(data);
        setBoot(false);
        warmCatalogImages(data.dishes.map((d) => d.imageUrl));
        const [savedSession, savedProfile, savedFav, savedHistory] = await Promise.all([
          storage.getSession(),
          storage.getProfile(),
          storage.getFavorites(),
          storage.getHistory()
        ]);
        if (cancelled) return;
        setProfile(normalizeProfile(savedProfile));
        setFavorites(savedFav);
        setHistory(savedHistory);
        if (savedSession && !savedSession.endedAt) {
          const restored = { ...savedSession, constraints: normalizeConstraints(savedSession.constraints) };
          setSession(restored);
          setConstraints(restored.constraints);
          setMode(restored.mode);
          setView(restored.tournament ? "tournament" : "swipe");
          preload(
            restored.deck.map((id) => data.dishes.find((d) => d.id === id)?.imageUrl),
            "medium"
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось открыть приложение");
        if (!cancelled) setBoot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (boot) return;
    void storage.setSession(session);
  }, [session, boot]);

  useEffect(() => {
    if (boot) return;
    void storage.setProfile(profile);
  }, [profile, boot]);

  const persistEnd = useCallback(
    async (ended: Session, nextProfile: TasteProfile) => {
      const summary: SessionSummary = {
        id: ended.id,
        mode: ended.mode,
        winnerId: ended.winnerId,
        endedAt: ended.endedAt ?? Date.now(),
        viewed: ended.reactions.length,
        comparisons: ended.tournament?.history.filter((h) => !h.skipped).length ?? 0
      };
      const nextHistory = [summary, ...history.filter((h) => h.id !== summary.id)].slice(0, 40);
      setHistory(nextHistory);
      setProfile(nextProfile);
      await storage.setHistory(nextHistory);
      await storage.setProfile(nextProfile);
      await storage.setSession(ended);
    },
    [history]
  );

  const filteredCount = useMemo(() => {
    if (!catalog) return 0;
    const recent = history.map((h) => h.winnerId).filter(Boolean) as string[];
    return applyHardFilters(catalog.dishes, constraints, recent).passed.length;
  }, [catalog, constraints, history]);

  const startSession = () => {
    if (!catalog) return;
    const recent = history.map((h) => h.winnerId).filter(Boolean) as string[];
    const prepared = prepareDeck(catalog.dishes, mode, constraints, profile, recent);
    if (prepared.deck.length === 0) return;
    const next = createSession(
      mode,
      normalizeConstraints(constraints),
      prepared.deck.map((d) => d.id)
    );
    preload(prepared.deck.map((d) => d.imageUrl), "medium");
    setSession(next);
    setView("swipe");
  };

  const currentDish = session ? dishesById.get(session.deck[session.index]) : undefined;
  const upcoming = useMemo(() => {
    if (!session) return [];
    return session.deck
      .slice(session.index + 1, session.index + 4)
      .map((id) => dishesById.get(id))
      .filter((d): d is Dish => Boolean(d));
  }, [session, dishesById]);

  const goTournamentOrResult = (base: Session) => {
    const positives = positiveDishes(base, dishesById);
    if (positives.length === 0) {
      const ended = { ...base, endedAt: Date.now(), updatedAt: Date.now() };
      setSession(ended);
      void persistEnd(ended, foldProfile(profile, ended, dishesById));
      setView("result");
      return;
    }
    if (positives.length === 1) {
      const ended = finishWithDish(base, positives[0].id, []);
      setSession(ended);
      void persistEnd(ended, foldProfile(profile, ended, dishesById));
      setView("result");
      return;
    }
    const withT = beginTournament(base, dishesById);
    setSession(withT);
    setView("tournament");
  };

  const onReact = (kind: ReactionKind) => {
    if (!session || !currentDish) return;
    const next = react(session, currentDish.id, kind);
    setSession(next);
    if (next.index >= next.deck.length) goTournamentOrResult(next);
  };

  const onCookNow = () => {
    if (!session || !currentDish) return;
    const liked = positiveDishes(session, dishesById).map((d) => d.id);
    const ended = finishWithDish(session, currentDish.id, liked);
    setSession(ended);
    void persistEnd(ended, foldProfile(profile, ended, dishesById));
    setView("result");
  };

  const onTournamentChoose = (id: string) => {
    if (!session?.tournament) return;
    const t = chooseWinner(session.tournament, id);
    let next: Session = { ...session, tournament: t, updatedAt: Date.now() };
    const champ = tournamentChampion(t);
    if (champ) {
      next = finishTournament(next);
      setSession(next);
      void persistEnd(next, foldProfile(profile, next, dishesById));
      setView("result");
      return;
    }
    setSession(next);
  };

  const report = session ? buildReport(session, dishesById, profile) : null;
  const winner = session?.winnerId ? dishesById.get(session.winnerId) : undefined;
  const alternatives = (session?.runnerUpIds ?? []).map((id) => dishesById.get(id)!).filter(Boolean);
  const lastWinner = history[0]?.winnerId ? dishesById.get(history[0].winnerId) : undefined;
  const recipe =
    view === "recipe" && recipeDishId && provider
      ? provider.recipeFor(recipeDishId)
      : winner && provider
        ? provider.recipeFor(winner.id)
        : undefined;

  const toggleFavorite = async (dishId: string) => {
    const exists = favorites.some((f) => f.dishId === dishId);
    const next = exists ? favorites.filter((f) => f.dishId !== dishId) : [{ dishId, savedAt: Date.now() }, ...favorites];
    setFavorites(next);
    await storage.setFavorites(next);
  };

  if (boot) {
    return (
      <div className="app-shell">
        <div className="skel" style={{ height: 72, marginBottom: 16 }} />
        <div className="skel" style={{ height: 220 }} />
      </div>
    );
  }
  if (error || !catalog) {
    return (
      <div className="app-shell error">
        <h2>Не открывается каталог</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {view === "home" && (
        <Home
          lastWinner={lastWinner}
          history={history}
          favoriteCount={favorites.length}
          onMode={(m) => {
            setMode(m);
            setConstraints(defaultConstraints());
            setView("setup");
          }}
          onTaste={() => setView("taste")}
          onFavorites={() => setView("favorites")}
        />
      )}
      {view === "setup" && (
        <Setup
          mode={mode}
          constraints={constraints}
          categories={[...new Set(catalog.dishes.flatMap((d) => d.categories))]}
          cuisines={[...new Set(catalog.dishes.map((d) => d.cuisine))]}
          tooFew={filteredCount < 8}
          onChange={setConstraints}
          onRelax={() => setConstraints(relaxOptional(constraints))}
          onBack={() => setView("home")}
          onStart={startSession}
        />
      )}
      {view === "swipe" && session && (
        <Swipe
          dish={currentDish}
          recipe={currentDish ? provider?.recipeFor(currentDish.id) : undefined}
          next={upcoming}
          progress={session.deck.length ? session.index / session.deck.length : 0}
          canUndo={session.reactions.length > 0}
          saved={Boolean(currentDish && favorites.some((f) => f.dishId === currentDish.id))}
          haveIngredients={session.constraints.haveIngredients}
          wantedIngredients={session.constraints.wantedIngredients}
          onReact={onReact}
          onUndo={() => setSession(undoReaction(session))}
          onQuit={() => goTournamentOrResult(session)}
          onCookNow={onCookNow}
          onSave={() => currentDish && toggleFavorite(currentDish.id)}
        />
      )}
      {view === "tournament" && session?.tournament && (
        <TournamentScreen
          state={session.tournament}
          dishesById={dishesById}
          recipeFor={(id) => provider?.recipeFor(id)}
          savedIds={favorites.map((f) => f.dishId)}
          haveIngredients={session.constraints.haveIngredients}
          wantedIngredients={session.constraints.wantedIngredients}
          onChoose={onTournamentChoose}
          onSave={(id) => toggleFavorite(id)}
          onSkip={() =>
            setSession({ ...session, tournament: skipPair(session.tournament!), updatedAt: Date.now() })
          }
          onUndo={() =>
            setSession({ ...session, tournament: undoTournament(session.tournament!), updatedAt: Date.now() })
          }
          onQuit={() => {
            const t = session.tournament;
            const ids = [...(t?.current ?? []), ...(t?.remaining ?? []), ...(t?.winners ?? [])];
            const loved = session.reactions.filter((r) => r.kind === "love").map((r) => r.dishId);
            const pick = loved.find((id) => ids.includes(id)) ?? ids[0];
            if (!pick) {
              goTournamentOrResult(session);
              return;
            }
            const ended = finishWithDish(session, pick, ids);
            setSession(ended);
            void persistEnd(ended, foldProfile(profile, ended, dishesById));
            setView("result");
          }}
        />
      )}
      {view === "result" && session && report && (
        <Result
          winner={winner}
          alternatives={alternatives}
          recipe={recipe}
          report={report}
          constraints={session.constraints}
          saved={Boolean(winner && favorites.some((f) => f.dishId === winner.id))}
          onOpenAlt={(id) => {
            if (!session) return;
            setSession({
              ...session,
              winnerId: id,
              runnerUpIds: [session.winnerId, ...session.runnerUpIds].filter((x): x is string => Boolean(x) && x !== id).slice(0, 3)
            });
          }}
          onSave={() => winner && toggleFavorite(winner.id)}
          onAgain={() => {
            setSession(null);
            void storage.setSession(null);
            setView("setup");
          }}
          onHome={() => {
            setSession(null);
            void storage.setSession(null);
            setView("home");
          }}
        />
      )}
      {view === "recipe" && (recipeDishId || winner) && (
        <Recipe
          dish={dishesById.get(recipeDishId ?? winner!.id)!}
          recipe={provider?.recipeFor(recipeDishId ?? winner!.id)}
          haveIngredients={session?.constraints.haveIngredients ?? constraints.haveIngredients}
          wantedIngredients={session?.constraints.wantedIngredients ?? constraints.wantedIngredients}
          saved={Boolean((recipeDishId ?? winner?.id) && favorites.some((f) => f.dishId === (recipeDishId ?? winner?.id)))}
          onSave={() => {
            const id = recipeDishId ?? winner?.id;
            if (id) void toggleFavorite(id);
          }}
          onBack={() => setView(session?.endedAt ? "result" : "home")}
        />
      )}
      {view === "taste" && (
        <Taste
          profile={profile}
          onChange={setProfile}
          onClear={async () => {
            setProfile(DEFAULT_PROFILE);
            setHistory([]);
            setSession(null);
            await storage.clearTaste();
            setView("home");
          }}
          onBack={() => setView("home")}
        />
      )}
      {view === "favorites" && (
        <Favorites
          favorites={favorites}
          history={history}
          dishesById={dishesById}
          onOpen={(id) => {
            setRecipeDishId(id);
            setView("recipe");
          }}
          onBack={() => setView("home")}
        />
      )}
    </div>
  );
}
