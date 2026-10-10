import { useEffect, useState } from "react";
import type { Dish, Recipe } from "../types";
import { Icon } from "./Icon";
import { linesToList } from "../domain/overrides";

export function DishEditor({
  dish,
  recipe,
  writable,
  saving,
  onSave
}: {
  dish: Dish;
  recipe?: Recipe;
  writable: boolean;
  saving?: boolean;
  onSave: (nextDish: Dish, nextRecipe?: Recipe) => void;
}) {
  const [canonicalName, setCanonicalName] = useState(dish.canonicalName);
  const [description, setDescription] = useState(dish.description);
  const [cuisine, setCuisine] = useState(dish.cuisine);
  const [ingredients, setIngredients] = useState(dish.ingredients.join("\n"));
  const [categories, setCategories] = useState(dish.categories.join("\n"));
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [recipeIngredients, setRecipeIngredients] = useState((recipe?.ingredients ?? []).join("\n"));
  const [instructions, setInstructions] = useState((recipe?.instructions ?? []).join("\n\n"));

  useEffect(() => {
    setCanonicalName(dish.canonicalName);
    setDescription(dish.description);
    setCuisine(dish.cuisine);
    setIngredients(dish.ingredients.join("\n"));
    setCategories(dish.categories.join("\n"));
    setTitle(recipe?.title ?? "");
    setRecipeIngredients((recipe?.ingredients ?? []).join("\n"));
    setInstructions((recipe?.instructions ?? []).join("\n\n"));
  }, [dish, recipe]);

  const submit = () => {
    const nextDish: Dish = {
      ...dish,
      canonicalName: canonicalName.trim() || dish.canonicalName,
      description: description.trim(),
      cuisine: cuisine.trim() || dish.cuisine,
      ingredients: linesToList(ingredients),
      categories: linesToList(categories)
    };
    const nextRecipe = recipe
      ? {
          ...recipe,
          title: title.trim() || recipe.title,
          ingredients: linesToList(recipeIngredients),
          instructions: instructions
            .split(/\n\s*\n/)
            .map((step) => step.trim())
            .filter(Boolean)
        }
      : undefined;
    onSave(nextDish, nextRecipe);
  };

  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="editor-kicker">
        <span className="muted">{dish.originalName || dish.sourceId}</span>
        {dish.sourceUrl && (
          <a className="text-btn" href={dish.sourceUrl} target="_blank" rel="noreferrer">
            <Icon name="link" size={14} />
            источник
          </a>
        )}
      </div>

      <label className="editor-field">
        <span>Название по-русски</span>
        <input value={canonicalName} onChange={(e) => setCanonicalName(e.target.value)} disabled={!writable} />
        {dish.originalName && <small>было: {dish.originalName}</small>}
      </label>

      <label className="editor-field">
        <span>Описание на карточке</span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!writable} />
      </label>

      <div className="editor-grid">
        <label className="editor-field">
          <span>Кухня</span>
          <input value={cuisine} onChange={(e) => setCuisine(e.target.value)} disabled={!writable} />
        </label>
        <label className="editor-field">
          <span>Категории, по строке</span>
          <textarea rows={3} value={categories} onChange={(e) => setCategories(e.target.value)} disabled={!writable} />
        </label>
      </div>

      <label className="editor-field">
        <span>Продукты по-русски, по строке</span>
        <textarea rows={8} value={ingredients} onChange={(e) => setIngredients(e.target.value)} disabled={!writable} />
        {dish.originalIngredients.length > 0 && (
          <small>в источнике: {dish.originalIngredients.join(" · ")}</small>
        )}
      </label>

      {recipe && (
        <>
          <label className="editor-field">
            <span>Заголовок рецепта</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!writable} />
          </label>
          <label className="editor-field">
            <span>Продукты в рецепте, по строке</span>
            <textarea
              rows={8}
              value={recipeIngredients}
              onChange={(e) => setRecipeIngredients(e.target.value)}
              disabled={!writable}
            />
          </label>
          <label className="editor-field">
            <span>Шаги — пустая строка между шагами</span>
            <textarea rows={10} value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={!writable} />
          </label>
        </>
      )}

      {writable ? (
        <button className="primary" type="submit" disabled={saving}>
          {saving ? "Пишу…" : "Записать в каталог"}
        </button>
      ) : (
        <p className="muted">Чтобы править файлы, откройте приложение с компьютера: http://localhost:8772</p>
      )}
    </form>
  );
}
