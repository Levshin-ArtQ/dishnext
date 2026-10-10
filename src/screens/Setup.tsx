import { useState } from "react";
import { Icon } from "../components/Icon";
import { AVOID_CHIPS, FEATURED_CUISINES, MODE_META, PANTRY_CHIPS, WANT_CHIPS, orderCuisines } from "../copy";
import type { Appetite, Constraints, Mode } from "../types";

export function Setup({
  mode,
  constraints,
  cuisines,
  tooFew,
  onChange,
  onRelax,
  onBack,
  onStart
}: {
  mode: Mode;
  constraints: Constraints;
  categories: string[];
  cuisines: string[];
  tooFew: boolean;
  onChange: (next: Constraints) => void;
  onRelax: () => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const [moreCuisines, setMoreCuisines] = useState(false);
  const orderedCuisines = orderCuisines(cuisines);
  const featuredCount = orderedCuisines.filter((c) => FEATURED_CUISINES.includes(c)).length;
  const cuisineChips = moreCuisines
    ? orderedCuisines
    : orderedCuisines.filter(
        (c, i) => i < featuredCount || constraints.selectedCuisines.includes(c)
      );

  const toggle = (key: "haveIngredients" | "wantedIngredients" | "excludedIngredients", value: string) => {
    const list = constraints[key];
    const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
    onChange({ ...constraints, [key]: next });
  };

  const toggleCuisine = (value: string) => {
    const list = constraints.selectedCuisines;
    const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
    onChange({ ...constraints, selectedCuisines: next });
  };

  const addCustom = (key: "haveIngredients" | "wantedIngredients" | "excludedIngredients", value: string) => {
    const item = value.trim().toLowerCase();
    if (!item) return;
    if (!constraints[key].includes(item)) onChange({ ...constraints, [key]: [...constraints[key], item] });
  };

  return (
    <section className="setup view-in">
      <div className="space">
        <button className="text-btn" onClick={onBack}>
          <Icon name="back" size={16} />
          Назад
        </button>
        <span className="muted">{MODE_META[mode].title}</span>
      </div>
      <h2>Что готовим сегодня?</h2>
      <p className="lede">Настроение, кухня, что есть дома, чего не класть — и сразу к блюдам.</p>

      <div className="group">
        <h3>Настроение</h3>
        <div className="chips">
          {([
            ["any", "Как получится", "spark"],
            ["healthy", "Правильное питание", "leaf"],
            ["hearty", "Сытные блюда", "flame"]
          ] as [Appetite, string, "spark" | "leaf" | "flame"][]).map(([id, label, icon]) => (
            <button
              key={id}
              className={`chip ${constraints.appetite === id ? "is-on" : ""}`}
              onClick={() => onChange({ ...constraints, appetite: id })}
            >
              <Icon name={icon} size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <h3>Кухня</h3>
        <p className="muted">
          {constraints.selectedCuisines.length
            ? "Покажем только отмеченные направления."
            : "Итальянская, русская и другие. Если ничего не отмечено — любая."}
        </p>
        <div className="chips">
          {cuisineChips.map((name) => (
            <button
              key={name}
              className={`chip ${constraints.selectedCuisines.includes(name) ? "is-on" : ""}`}
              onClick={() => toggleCuisine(name)}
            >
              {name.charAt(0).toLocaleLowerCase("ru") + name.slice(1)}
            </button>
          ))}
          {!moreCuisines && orderedCuisines.length > cuisineChips.length && (
            <button className="chip" onClick={() => setMoreCuisines(true)}>
              ещё {orderedCuisines.length - cuisineChips.length}
            </button>
          )}
        </div>
      </div>

      <ChipGroup
        title="Есть дома"
        hint="Курица и свинина уже отмечены."
        selected={constraints.haveIngredients}
        suggestions={PANTRY_CHIPS}
        onToggle={(item) => toggle("haveIngredients", item)}
        onAdd={(item) => addCustom("haveIngredients", item)}
        placeholder="ещё продукт"
      />

      <ChipGroup
        title="Хочется в блюде"
        hint="Поднимем такие рецепты выше."
        selected={constraints.wantedIngredients}
        suggestions={WANT_CHIPS}
        onToggle={(item) => toggle("wantedIngredients", item)}
        onAdd={(item) => addCustom("wantedIngredients", item)}
        placeholder="что добавить"
      />

      <ChipGroup
        title="Не класть"
        hint="Эти продукты просто выкинем из подборки."
        selected={constraints.excludedIngredients}
        suggestions={AVOID_CHIPS}
        onToggle={(item) => toggle("excludedIngredients", item)}
        onAdd={(item) => addCustom("excludedIngredients", item)}
        placeholder="чего избегать"
      />

      <div className="group">
        <h3>Сколько времени</h3>
        <div className="chips">
          {[
            [undefined, "неважно"],
            [30, "до 30 мин"],
            [45, "до 45 мин"],
            [60, "до часа"]
          ].map(([mins, label]) => (
            <button
              key={String(label)}
              className={`chip ${constraints.maxMinutes === mins ? "is-on" : ""}`}
              onClick={() => onChange({ ...constraints, maxMinutes: mins as number | undefined })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tooFew && (
        <div className="obs hypothesis">
          По таким условиям блюд мало. Можно убрать кухню, «не класть» или ограничение по времени.
          <div style={{ marginTop: 10 }}>
            <button className="secondary" onClick={onRelax}>
              Убрать лишние ограничения
            </button>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 24 }}>
        <button className="primary" onClick={onStart} style={{ flex: 1 }}>
          Показать блюда
        </button>
      </div>
    </section>
  );
}

function ChipGroup({
  title,
  hint,
  selected,
  suggestions,
  onToggle,
  onAdd,
  placeholder
}: {
  title: string;
  hint: string;
  selected: string[];
  suggestions: string[];
  onToggle: (item: string) => void;
  onAdd: (item: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const extras = selected.filter((item) => !suggestions.includes(item));
  const submit = () => {
    onAdd(draft);
    setDraft("");
  };
  return (
    <div className="group">
      <h3>{title}</h3>
      <p className="muted">{hint}</p>
      <div className="chips">
        {[...suggestions, ...extras].map((item) => (
          <button key={item} className={`chip ${selected.includes(item) ? "is-on" : ""}`} onClick={() => onToggle(item)}>
            {item}
          </button>
        ))}
      </div>
      <form
        className="chip-add"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <button type="submit" className="secondary">
          Добавить
        </button>
      </form>
    </div>
  );
}
