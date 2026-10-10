import { useState } from "react";
import { CardFacts } from "../components/CardFacts";
import { Icon } from "../components/Icon";
import { Photo } from "../components/Photo";
import { RecipePeek } from "../components/RecipePeek";
import { minutesShort } from "../copy";
import { canSkipPair } from "../domain/tournament";
import type { Dish, Recipe, TournamentState } from "../types";

export function TournamentScreen({
  state,
  dishesById,
  recipeFor,
  savedIds,
  haveIngredients,
  wantedIngredients,
  onChoose,
  onSkip,
  onUndo,
  onQuit,
  onSave
}: {
  state: TournamentState;
  dishesById: Map<string, Dish>;
  recipeFor?: (id: string) => Recipe | undefined;
  savedIds: string[];
  haveIngredients: string[];
  wantedIngredients?: string[];
  onChoose: (id: string) => void;
  onSkip: () => void;
  onUndo: () => void;
  onQuit: () => void;
  onSave: (id: string) => void;
}) {
  const [peekId, setPeekId] = useState<string | null>(null);
  const pair = state.current;
  const left = pair ? dishesById.get(pair[0]) : undefined;
  const right = pair ? dishesById.get(pair[1]) : undefined;
  const peekDish = peekId ? dishesById.get(peekId) : undefined;

  return (
    <section className="view-in">
      <div className="space">
        <button className="text-btn" onClick={onQuit}>
          <Icon name="chef" size={16} />
          Готовить уже
        </button>
        <span className="muted">сравнение {state.round}</span>
      </div>
      <h2>Что готовим?</h2>
      <p className="lede">Нажмите на блюдо. Если оба нравятся — оба остаются, никто не вылетает случайно.</p>
      {left && right ? (
        <div className="pair">
          <Duel
            dish={left}
            recipe={recipeFor?.(left.id)}
            saved={savedIds.includes(left.id)}
            onChoose={() => onChoose(left.id)}
            onSave={() => onSave(left.id)}
            onPreview={() => setPeekId(left.id)}
          />
          <div className="vs">или</div>
          <Duel
            dish={right}
            recipe={recipeFor?.(right.id)}
            saved={savedIds.includes(right.id)}
            onChoose={() => onChoose(right.id)}
            onSave={() => onSave(right.id)}
            onPreview={() => setPeekId(right.id)}
          />
        </div>
      ) : (
        <div className="empty">
          <h2>Финал собран</h2>
        </div>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="secondary" onClick={onSkip} disabled={!canSkipPair(state)}>
          Оба нравятся
        </button>
        <button className="secondary" onClick={onUndo} disabled={!state.undoStack.length}>
          Назад
        </button>
      </div>
      {peekDish && (
        <RecipePeek
          dish={peekDish}
          recipe={recipeFor?.(peekDish.id)}
          saved={savedIds.includes(peekDish.id)}
          haveIngredients={haveIngredients}
          wantedIngredients={wantedIngredients}
          onClose={() => setPeekId(null)}
          onSave={() => onSave(peekDish.id)}
        />
      )}
    </section>
  );
}

function Duel({
  dish,
  recipe,
  saved,
  onChoose,
  onSave,
  onPreview
}: {
  dish: Dish;
  recipe?: Recipe;
  saved: boolean;
  onChoose: () => void;
  onSave: () => void;
  onPreview: () => void;
}) {
  const mins = minutesShort(dish.preparationMinutes);
  return (
    <article className="duel">
      <button className="duel-pick" onClick={onChoose}>
        <div className="card-shot">
          <Photo src={dish.imageUrl} alt={dish.canonicalName} size="medium" priority />
          {mins && (
            <span className="card-time">
              <Icon name="clock" size={14} />
              {mins}
            </span>
          )}
        </div>
        <div className="pad">
          <h3>{dish.canonicalName}</h3>
          <CardFacts dish={dish} recipe={recipe} compact />
        </div>
      </button>
      <div className="card-tools duel-link">
        <button className={`card-link ${saved ? "is-on" : ""}`} onClick={onSave}>
          <Icon name="bookmark" size={16} />
          {saved ? "Сохранено" : "Сохранить"}
        </button>
        <button className="card-link card-link-ink" onClick={onPreview}>
          <Icon name="chef" size={16} />
          Рецепт
        </button>
      </div>
    </article>
  );
}
