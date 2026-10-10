import { useEffect } from "react";
import type { Dish, Recipe } from "../types";
import { CardFacts } from "./CardFacts";
import { CookSheet } from "./CookSheet";
import { Icon } from "./Icon";

export function RecipePeek({
  dish,
  recipe,
  saved,
  haveIngredients,
  wantedIngredients,
  onClose,
  onSave
}: {
  dish: Dish;
  recipe?: Recipe;
  saved: boolean;
  haveIngredients: string[];
  wantedIngredients?: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="peek-title"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space">
          <button className="text-btn" onClick={onClose}>
            <Icon name="back" size={16} />
            К карточкам
          </button>
          <button className="text-btn" onClick={onSave}>
            <Icon name="bookmark" size={16} />
            {saved ? "Сохранено" : "Сохранить"}
          </button>
        </div>
        <h2 id="peek-title">{dish.canonicalName}</h2>
        <p className="lede peek-note">Предпросмотр рецепта. Режим готовки откроется, когда выберете блюдо финалистом.</p>
        <CardFacts dish={dish} recipe={recipe} />
        <CookSheet
          dish={dish}
          recipe={recipe}
          haveIngredients={haveIngredients}
          wantedIngredients={wantedIngredients}
          preview
        />
      </div>
    </div>
  );
}
