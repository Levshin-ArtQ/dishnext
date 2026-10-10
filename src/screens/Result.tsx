import { CardFacts } from "../components/CardFacts";
import { CookSheet } from "../components/CookSheet";
import { Icon } from "../components/Icon";
import { Photo } from "../components/Photo";
import { minutesShort, proteinLabel } from "../copy";
import { classifyProtein } from "../domain/protein";
import type { Constraints, Dish, Recipe, SessionReport } from "../types";

export function Result({
  winner,
  alternatives,
  recipe,
  report,
  constraints,
  saved,
  onOpenAlt,
  onSave,
  onAgain,
  onHome
}: {
  winner?: Dish;
  alternatives: Dish[];
  recipe?: Recipe;
  report: SessionReport;
  constraints: Constraints;
  saved: boolean;
  onOpenAlt: (id: string) => void;
  onSave: () => void;
  onAgain: () => void;
  onHome: () => void;
}) {
  if (!winner) {
    return (
      <section className="empty view-in">
        <h2>Ничего не выбрали</h2>
        <p className="lede">Можно убрать «не класть» или пройтись по карточкам ещё раз.</p>
        <button className="primary" onClick={onAgain}>
          Выбрать снова
        </button>
      </section>
    );
  }

  const mins = minutesShort(winner.preparationMinutes);

  return (
    <section className="cook view-in">
      <div className="hero">
        <div className="card-shot">
          <Photo src={winner.imageUrl} alt={winner.canonicalName} size="medium" priority />
          {mins && (
            <span className="card-time">
              <Icon name="clock" size={16} />
              {mins}
            </span>
          )}
        </div>
        <div className="pad">
          <div className="muted">сегодня готовим</div>
          <h1>{winner.canonicalName}</h1>
          {winner.originalName && winner.originalName !== winner.canonicalName && (
            <p className="muted">{winner.originalName}</p>
          )}
          <CardFacts dish={winner} recipe={recipe} />
          {(recipe?.sourceUrl || winner.sourceUrl) && (
            <a className="card-link" href={recipe?.sourceUrl || winner.sourceUrl} target="_blank" rel="noreferrer">
              <Icon name="link" size={16} />
              Открыть рецепт
            </a>
          )}
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="secondary" onClick={onSave}>
          <Icon name="bookmark" size={16} />
          {saved ? "В сохранённых" : "Сохранить"}
        </button>
        <button className="ghost-btn" onClick={onHome}>
          <Icon name="home" size={16} />
          На главную
        </button>
      </div>

      <CookSheet
        key={winner.id}
        dish={winner}
        recipe={recipe}
        haveIngredients={constraints.haveIngredients}
        wantedIngredients={constraints.wantedIngredients}
      />

      {alternatives.length > 0 && (
        <div className="group">
          <h3>Если передумаете</h3>
          {alternatives.map((dish) => (
            <button key={dish.id} className="winner-strip" onClick={() => onOpenAlt(dish.id)}>
              <Photo src={dish.imageUrl} alt={dish.canonicalName} size="small" />
              <div>
                <strong>{dish.canonicalName}</strong>
                <div className="muted">{[proteinLabel(classifyProtein(dish)), dish.cuisine].filter(Boolean).join(" · ")}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <details className="session-note">
        <summary>Как выбирали</summary>
        <p className="muted">
          Смотрели {report.viewed} карточек, сравнений {report.comparisons}. Это сегодняшняя сессия, а не оценка вкуса.
        </p>
        {report.observations.slice(0, 3).map((o, i) => (
          <div key={i} className={`obs ${o.kind}`}>
            <div className="muted">{o.kind === "fact" ? "как было" : "возможно"}</div>
            {o.text}
          </div>
        ))}
      </details>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="secondary" onClick={onAgain} style={{ flex: 1 }}>
          Выбрать другое
        </button>
      </div>
    </section>
  );
}
