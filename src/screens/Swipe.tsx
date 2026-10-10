import { useEffect, useRef, useState } from "react";
import { CardFacts } from "../components/CardFacts";
import { Icon } from "../components/Icon";
import { Photo, preload } from "../components/Photo";
import { RecipePeek } from "../components/RecipePeek";
import { minutesShort } from "../copy";
import type { Dish, ReactionKind, Recipe } from "../types";

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const STAMP: Record<string, string> = {
  yes: "берём",
  no: "не это",
  love: "очень хочу"
};

export function Swipe({
  dish,
  recipe,
  next,
  progress,
  canUndo,
  saved,
  haveIngredients,
  wantedIngredients,
  onReact,
  onUndo,
  onQuit,
  onCookNow,
  onSave
}: {
  dish?: Dish;
  recipe?: Recipe;
  next?: Dish[];
  progress: number;
  canUndo: boolean;
  saved: boolean;
  haveIngredients: string[];
  wantedIngredients?: string[];
  onReact: (kind: ReactionKind) => void;
  onUndo: () => void;
  onQuit: () => void;
  onCookNow: () => void;
  onSave: () => void;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exit, setExit] = useState<ReactionKind | null>(null);
  const [peek, setPeek] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const lock = useRef(false);

  useEffect(() => {
    preload((next ?? []).map((d) => d.imageUrl), "medium");
  }, [next]);

  useEffect(() => {
    setExit(null);
    setPeek(false);
    setDrag({ x: 0, y: 0, active: false });
    lock.current = false;
  }, [dish?.id]);

  const fire = (kind: ReactionKind) => {
    if (!dish || lock.current) return;
    lock.current = true;
    if (reduced()) {
      onReact(kind);
      return;
    }
    setExit(kind);
    window.setTimeout(() => onReact(kind), 260);
  };
  const fireRef = useRef(fire);
  fireRef.current = fire;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (peek) return;
      if (e.key === "ArrowRight") fireRef.current("yes");
      if (e.key === "ArrowLeft") fireRef.current("no");
      if (e.key === "ArrowUp") fireRef.current("love");
      if (e.key === "ArrowDown") fireRef.current("skip");
      if (e.key === "z") onUndo();
      if (e.key === "Enter") onCookNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndo, onCookNow, peek]);

  if (!dish) {
    return (
      <div className="empty view-in">
        <h2>Блюда закончились</h2>
        <p className="lede">Сейчас соберём финал из того, что понравилось.</p>
      </div>
    );
  }

  const commitDrag = () => {
    const threshold = 88;
    if (drag.x > threshold) fire("yes");
    else if (drag.x < -threshold) fire("no");
    else if (drag.y < -threshold) fire("love");
    else setDrag({ x: 0, y: 0, active: false });
  };

  const stamp = exit ?? (drag.x > 50 ? "yes" : drag.x < -50 ? "no" : drag.y < -50 ? "love" : "");
  const behind = next?.[0];
  const mins = minutesShort(dish.preparationMinutes);

  return (
    <section className="view-in">
      <div className="space">
        <button className="text-btn" onClick={onQuit}>
          <Icon name="check" size={16} />
          К финалу
        </button>
        <button className="text-btn" onClick={onUndo} disabled={!canUndo}>
          <Icon name="back" size={16} />
          Назад
        </button>
      </div>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="deck-wrap">
        {behind && (
          <article className="card behind" aria-hidden="true">
            <div className="card-shot">
              <Photo src={behind.imageUrl} alt="" size="small" />
            </div>
          </article>
        )}
        <article
          className={`card ${exit ? `exit-${exit}` : ""}`}
          style={{
            transform: reduced() || exit
              ? undefined
              : `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`,
            transition: drag.active ? "none" : "transform 180ms ease"
          }}
          onPointerDown={(e) => {
            if (lock.current) return;
            if (peek) return;
            if ((e.target as HTMLElement).closest("a, button")) return;
            start.current = { x: e.clientX, y: e.clientY };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDrag({ x: 0, y: 0, active: true });
          }}
          onPointerMove={(e) => {
            if (!drag.active) return;
            setDrag({
              x: e.clientX - start.current.x,
              y: e.clientY - start.current.y,
              active: true
            });
          }}
          onPointerUp={commitDrag}
          onPointerCancel={() => setDrag({ x: 0, y: 0, active: false })}
        >
          <div className="card-shot">
            <Photo src={dish.imageUrl} alt={dish.canonicalName} size="medium" priority />
            <div className="card-overlay">
              <h2>{dish.canonicalName}</h2>
              {mins && (
                <span className="card-time">
                  <Icon name="clock" size={16} />
                  {mins}
                </span>
              )}
            </div>
            {stamp && <div className={`stamp ${stamp} show`}>{STAMP[stamp]}</div>}
          </div>
          <div className="meta">
            <CardFacts dish={dish} recipe={recipe} />
            <div className="card-tools">
              <button
                className={`card-link ${saved ? "is-on" : ""}`}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
              >
                <Icon name="bookmark" size={16} />
                {saved ? "Сохранено" : "Сохранить"}
              </button>
              <button
                className="card-link card-link-ink"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeek(true);
                }}
              >
                <Icon name="chef" size={16} />
                Рецепт
              </button>
            </div>
          </div>
        </article>
      </div>
      <div className="actions">
        <button className="act no" onClick={() => fire("no")}>
          <Icon name="close" size={18} />
          Не это
        </button>
        <button className="act skip" onClick={() => fire("skip")}>
          <Icon name="skip" size={18} />
          Пропустить
        </button>
        <button className="act love" onClick={() => fire("love")}>
          <Icon name="heart" size={18} />
          Очень хочу
        </button>
        <button className="act yes" onClick={() => fire("yes")}>
          <Icon name="check" size={18} />
          Берём
        </button>
      </div>
      <button className="primary cook-now" onClick={onCookNow}>
        <Icon name="chef" size={18} />
        Готовим это
      </button>
      <p className="muted swipe-hint">Влево — не это, вправо — берём, вверх — очень хочу.</p>
      {peek && (
        <RecipePeek
          dish={dish}
          recipe={recipe}
          saved={saved}
          haveIngredients={haveIngredients}
          wantedIngredients={wantedIngredients}
          onClose={() => setPeek(false)}
          onSave={onSave}
        />
      )}
    </section>
  );
}
