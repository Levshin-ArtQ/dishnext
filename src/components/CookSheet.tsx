import { useMemo, useState } from "react";
import { cookLines, cookSteps, matchingNeedles } from "../domain/pantry";
import type { Dish, Recipe } from "../types";

export function CookSheet({
  dish,
  recipe,
  haveIngredients,
  wantedIngredients,
  preview = false
}: {
  dish: Dish;
  recipe?: Recipe;
  haveIngredients: string[];
  wantedIngredients?: string[];
  preview?: boolean;
}) {
  const wanted = wantedIngredients ?? [];
  const [tab, setTab] = useState<"products" | "steps">(preview ? "steps" : "products");
  const [step, setStep] = useState(0);
  const [got, setGot] = useState<Record<number, boolean>>({});
  const [done, setDone] = useState<Record<number, boolean>>({});

  const lines = useMemo(
    () => cookLines(dish, recipe, haveIngredients, wanted),
    [dish, recipe, haveIngredients, wanted]
  );
  const steps = useMemo(() => cookSteps(recipe?.instructions), [recipe]);
  const missing = lines.filter((l) => !l.have && !l.staple);
  const have = lines.filter((l) => l.have && !l.staple);
  const wantedHit = matchingNeedles(dish, wanted);
  const wantedMiss = wanted.filter((w) => !wantedHit.includes(w));

  const isGot = (i: number) => Boolean(got[i]);
  const current = steps[step];

  return (
    <div className="cook-sheet">
      <div className="cook-board">
        <div className="stat">
          <b>{lines.length}</b>
          продуктов
        </div>
        <div className="stat">
          <b>{have.length}</b>
          уже есть
        </div>
        <div className="stat">
          <b>{missing.length}</b>
          докупить
        </div>
      </div>

      {wantedHit.length > 0 && (
        <p className="muted">В блюде есть то, что просили: {wantedHit.join(", ")}.</p>
      )}
      {wantedMiss.length > 0 && wanted.length > 0 && (
        <p className="muted">В этом рецепте нет: {wantedMiss.join(", ")} — можно добавить по вкусу.</p>
      )}

      <div className="cook-tabs">
        <button className={`chip ${tab === "products" ? "is-on" : ""}`} onClick={() => setTab("products")}>
          Продукты
        </button>
        <button className={`chip ${tab === "steps" ? "is-on" : ""}`} onClick={() => setTab("steps")}>
          Шаги {steps.length ? `(${steps.length})` : ""}
        </button>
      </div>

      {tab === "products" && (
        <>
          <div className="group">
            <h3>Что нужно</h3>
            <p className="muted">
              {preview
                ? "Соль, масло и вода считаются базовыми. Отметки продуктов появятся в режиме готовки."
                : "Отметьте, что уже достали. Соль, масло и вода считаются базовыми."}
            </p>
            {lines.map((line, i) =>
              preview ? (
                <div
                  key={`${line.name}-${i}`}
                  className={`ing cook-line is-preview ${line.have ? "is-have" : ""} ${line.wanted ? "is-want" : ""}`}
                >
                  <span className="ing-name">
                    {line.name}
                    {line.original && line.original.toLowerCase() !== line.name.toLowerCase() && (
                      <small className="muted">{line.original}</small>
                    )}
                  </span>
                  <span className="muted cook-measure">{line.measure}</span>
                  <span className="tag">{line.staple ? "базовое" : line.wanted ? "хотели" : line.have ? "есть" : "купить"}</span>
                </div>
              ) : (
                <label
                  key={`${line.name}-${i}`}
                  className={`ing cook-line ${line.have ? "is-have" : ""} ${line.wanted ? "is-want" : ""} ${isGot(i) ? "is-done" : ""}`}
                >
                  <input type="checkbox" checked={isGot(i)} onChange={() => setGot((prev) => ({ ...prev, [i]: !isGot(i) }))} />
                  <span className="ing-name">
                    {line.name}
                    {line.original && line.original.toLowerCase() !== line.name.toLowerCase() && (
                      <small className="muted">{line.original}</small>
                    )}
                  </span>
                  <span className="muted cook-measure">{line.measure}</span>
                  <span className="tag">{line.staple ? "базовое" : line.wanted ? "хотели" : line.have ? "есть" : "купить"}</span>
                </label>
              )
            )}
          </div>

          {missing.length > 0 && (
            <div className="obs fact">
              <div className="muted">закупить перед готовкой</div>
              {missing.map((m) => `${m.name}${m.measure ? ` — ${m.measure}` : ""}`).join("; ")}
            </div>
          )}

          {steps.length > 0 && !preview && (
            <button
              className="primary cook-now"
              onClick={() => {
                setTab("steps");
                setStep(0);
              }}
            >
              Начать готовить
            </button>
          )}
        </>
      )}

      {tab === "steps" && (
        <div className="group cook-focus">
          <h3>Как готовить</h3>
          {steps.length === 0 ? (
            <p>Пошагового текста в каталоге нет — откройте источник.</p>
          ) : preview ? (
            <>
              <p className="muted">Текст как в источнике, без перевода. Это просмотр, не режим готовки.</p>
              <ol className="cook-steps">
                {steps.map((text, i) => (
                  <li key={i} className="cook-step">
                    <span className="step-n">{i + 1}</span>
                    <p>{text}</p>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <p className="muted">
                Шаг {step + 1} из {steps.length}. Текст как в источнике, без выдуманного перевода.
              </p>
              <div className="cook-step cook-step-hero">
                <span className="step-n">{step + 1}</span>
                <div>
                  <p>{current}</p>
                  <label className="cook-done">
                    <input
                      type="checkbox"
                      checked={Boolean(done[step])}
                      onChange={() => setDone((prev) => ({ ...prev, [step]: !prev[step] }))}
                    />
                    Шаг сделан
                  </label>
                </div>
              </div>
              <div className="row cook-nav">
                <button className="secondary" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  Предыдущий
                </button>
                {step < steps.length - 1 ? (
                  <button className="primary" onClick={() => setStep((s) => s + 1)} style={{ flex: 1 }}>
                    Следующий шаг
                  </button>
                ) : (
                  <button className="primary" onClick={() => setTab("products")} style={{ flex: 1 }}>
                    Готово
                  </button>
                )}
              </div>
              <ol className="cook-steps cook-steps-mini">
                {steps.map((text, i) => (
                  <li key={i}>
                    <button className={`cook-mini ${i === step ? "is-on" : ""} ${done[i] ? "is-done" : ""}`} onClick={() => setStep(i)}>
                      {i + 1}. {text.slice(0, 72)}
                      {text.length > 72 ? "…" : ""}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {recipe?.sourceUrl && (
        <p>
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            Открыть оригинальный рецепт
          </a>
        </p>
      )}
      <p className="muted">{dish.attribution}</p>
    </div>
  );
}
