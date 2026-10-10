import { useMemo, useState } from "react";
import { DishEditor } from "../components/DishEditor";
import { Icon } from "../components/Icon";
import { Photo } from "../components/Photo";
import { looksUntranslated, overrideCount } from "../domain/overrides";
import type { CatalogOverrides } from "../domain/overrides";
import type { Dish, Recipe } from "../types";

type Filter = "all" | "latin" | "edited";

export function CatalogScreen({
  dishes,
  recipeFor,
  overrides,
  writable,
  git,
  saving,
  publishing,
  status,
  onSaveDish,
  onPublish,
  onBack,
  initialId
}: {
  dishes: Dish[];
  recipeFor: (id: string) => Recipe | undefined;
  overrides: CatalogOverrides;
  writable: boolean;
  git: boolean;
  saving: boolean;
  publishing: boolean;
  status: string;
  onSaveDish: (dish: Dish, recipe?: Recipe) => void;
  onPublish: () => void;
  onBack: () => void;
  initialId?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialId ? "all" : "latin");
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);

  const editedIds = useMemo(() => new Set(Object.keys(overrides.dishes)), [overrides]);

  const recipeEditedDishIds = useMemo(() => {
    const recipeIds = new Set(Object.keys(overrides.recipes));
    const ids = new Set<string>();
    for (const dish of dishes) {
      if (dish.recipeIds.some((id) => recipeIds.has(id))) ids.add(dish.id);
    }
    return ids;
  }, [dishes, overrides.recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      if (filter === "latin" && !looksUntranslated(dish)) return false;
      if (filter === "edited" && !editedIds.has(dish.id) && !recipeEditedDishIds.has(dish.id)) return false;
      if (!q) return true;
      const blob = [dish.canonicalName, dish.originalName ?? "", dish.cuisine, ...dish.ingredients].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [dishes, query, filter, editedIds, recipeEditedDishIds]);

  const selected = dishes.find((d) => d.id === (selectedId ?? filtered[0]?.id));
  const recipe = selected ? recipeFor(selected.id) : undefined;
  const edits = overrideCount(overrides);
  const latinCount = dishes.filter(looksUntranslated).length;

  return (
    <section className="catalog view-in">
      <div className="space">
        <button className="text-btn" onClick={onBack}>
          <Icon name="back" size={16} />
          Назад
        </button>
        <span className="muted">
          {edits ? `${edits} правок` : "правок пока нет"}
          {writable ? " · запись на диск" : ""}
        </span>
      </div>
      <h2>Каталог блюд</h2>
      <p className="lede">
        Правите русские названия, описания и продукты. На компьютере с <code>npm start</code> запись сразу попадает в
        файлы; «Выложить на сайт» пушит в git и на Vercel.
      </p>

      <div className="catalog-toolbar">
        <input
          className="catalog-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="поиск по названию или продукту"
          aria-label="Поиск по каталогу"
        />
        <div className="chips">
          {(
            [
              ["latin", `с латиницей ${latinCount}`],
              ["edited", "правленные"],
              ["all", `все ${dishes.length}`]
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button key={id} className={`chip ${filter === id ? "is-on" : ""}`} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {writable && git && (
        <div className="row" style={{ margin: "8px 0 16px" }}>
          <button className="secondary" onClick={onPublish} disabled={publishing || edits === 0}>
            {publishing ? "Пушу…" : "Выложить на сайт"}
          </button>
        </div>
      )}
      {status && <p className="muted">{status}</p>}

      <div className="catalog-layout">
        <div className="catalog-list">
          {filtered.length === 0 && <p className="muted">Ничего не нашлось.</p>}
          {filtered.map((dish) => {
            const on = selected?.id === dish.id;
            const edited = editedIds.has(dish.id) || recipeEditedDishIds.has(dish.id);
            return (
              <button
                key={dish.id}
                className={`catalog-item ${on ? "is-on" : ""}`}
                onClick={() => setSelectedId(dish.id)}
              >
                <Photo src={dish.imageUrl} alt="" size="small" />
                <div>
                  <strong>{dish.canonicalName}</strong>
                  <div className="muted">
                    {dish.cuisine}
                    {dish.originalName && dish.originalName !== dish.canonicalName ? ` · ${dish.originalName}` : ""}
                  </div>
                  {(looksUntranslated(dish) || edited) && (
                    <div className="catalog-flags">
                      {looksUntranslated(dish) && <span className="flag">латиница</span>}
                      {edited && <span className="flag is-edit">правка</span>}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="catalog-pane">
          {selected ? (
            <DishEditor
              key={selected.id}
              dish={selected}
              recipe={recipe}
              writable={writable}
              saving={saving}
              onSave={onSaveDish}
            />
          ) : (
            <p className="muted">Выберите блюдо слева.</p>
          )}
        </div>
      </div>
    </section>
  );
}
