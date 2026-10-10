import type { Dish, Recipe as RecipeType } from "../types";
import { CardFacts } from "../components/CardFacts";
import { CookSheet } from "../components/CookSheet";
import { Icon } from "../components/Icon";
import { Photo } from "../components/Photo";
import { minutesShort } from "../copy";

export function Recipe({
  dish,
  recipe,
  haveIngredients,
  wantedIngredients,
  saved,
  onBack,
  onSave
}: {
  dish: Dish;
  recipe?: RecipeType;
  haveIngredients: string[];
  wantedIngredients?: string[];
  saved?: boolean;
  onBack: () => void;
  onSave?: () => void;
}) {
  const mins = minutesShort(dish.preparationMinutes);

  return (
    <section className="recipe view-in">
      <div className="space">
        <button className="text-btn" onClick={onBack}>
          <Icon name="back" size={16} />
          Назад
        </button>
        {onSave && (
          <button className="text-btn" onClick={onSave}>
            <Icon name="bookmark" size={16} />
            {saved ? "Сохранено" : "Сохранить"}
          </button>
        )}
      </div>
      <div className="hero" style={{ marginTop: 14 }}>
        <div className="card-shot">
          <Photo src={dish.imageUrl} alt={dish.canonicalName} size="medium" priority />
          {mins && (
            <span className="card-time">
              <Icon name="clock" size={16} />
              {mins}
            </span>
          )}
        </div>
        <div className="pad">
          <h2>{dish.canonicalName}</h2>
          <CardFacts dish={dish} recipe={recipe} />
        </div>
      </div>
      <CookSheet dish={dish} recipe={recipe} haveIngredients={haveIngredients} wantedIngredients={wantedIngredients} />
    </section>
  );
}
