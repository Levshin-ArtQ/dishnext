import type { CookMethod } from "../domain/cardCopy";
import { cardCopy } from "../domain/cardCopy";
import type { Dish, Recipe } from "../types";
import { DishBadges } from "./DishBadges";
import { Icon, type IconName } from "./Icon";

const METHOD_ICON: Record<CookMethod, IconName> = {
  fry: "skillet",
  stew: "pot",
  bake: "oven",
  boil: "pot",
  grill: "flame",
  steam: "pot",
  wok: "skillet",
  salad: "leaf",
  mix: "spark",
  other: "chef"
};

export function CardFacts({
  dish,
  recipe,
  compact = false,
  showBadges = true
}: {
  dish: Dish;
  recipe?: Recipe;
  compact?: boolean;
  showBadges?: boolean;
}) {
  const copy = cardCopy(dish, recipe);
  return (
    <div className={`card-facts ${compact ? "is-compact" : ""}`}>
      <div className="card-tags">
        {showBadges && <DishBadges dish={dish} />}
        <span className="pill pill-method">
          <Icon name={METHOD_ICON[copy.method]} size={14} />
          {copy.methodLabel}
        </span>
        {copy.difficulty && (
          <span className="pill pill-diff">
            <Icon name="chef" size={14} />
            {copy.difficulty}
          </span>
        )}
        {!compact && copy.steps >= 3 && (
          <span className="pill pill-diff">
            <Icon name="skillet" size={14} />
            {copy.steps} шагов
          </span>
        )}
      </div>
      <p className="card-blurb">{copy.blurb}</p>
      {copy.heroes.length > 0 && (
        <p className="card-ings">
          <span className="muted">в составе</span> {copy.heroes.join(" · ")}
        </p>
      )}
    </div>
  );
}
