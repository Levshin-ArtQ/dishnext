import { useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Photo } from "../components/Photo";
import {
  applyPrioritiesToProfile,
  downloadPriorities,
  exportPriorities,
  normalizePriorities,
  rankByPriorities,
  topEntries
} from "../domain/priorities";
import { DEFAULT_WEIGHTS } from "../domain/ranking";
import type { Constraints, Dish, Mode, TasteProfile } from "../types";

export function Taste({
  profile,
  dishes,
  constraints,
  mode,
  onChange,
  onClear,
  onStartDeck,
  onBack
}: {
  profile: TasteProfile;
  dishes: Dish[];
  constraints: Constraints;
  mode: Mode;
  onChange: (next: TasteProfile) => void;
  onClear: () => void;
  onStartDeck: (excludeIds?: string[]) => void;
  onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const cuisines = topEntries(profile.cuisineScores, 12);
  const categories = topEntries(profile.categoryScores, 8);
  const ingredients = topEntries(profile.ingredientScores, 8);
  const matches = useMemo(
    () =>
      rankByPriorities(dishes, profile, {
        constraints,
        mode,
        limit: 12
      }),
    [dishes, profile, constraints, mode]
  );

  const onDownload = () => {
    downloadPriorities(exportPriorities(profile));
    setStatus("Файл приоритетов скачан. Им можно подобрать другую колоду на этом или другом устройстве.");
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const priorities = normalizePriorities(parsed);
      if (!priorities) {
        setStatus("Не похоже на файл приоритетов.");
        return;
      }
      onChange(applyPrioritiesToProfile(profile, priorities));
      setStatus("Приоритеты загружены. Ниже — блюда по этим весам.");
    } catch {
      setStatus("Не удалось прочитать JSON.");
    }
  };

  return (
    <section>
      <button className="text-btn" onClick={onBack}>
        <Icon name="back" size={16} />
        Назад
      </button>
      <h2>Что запомнили</h2>
      <p className="lede">
        Это накопленные реакции, а не диагноз. Один свайп влево не значит, что кухня «не ваша». Веса можно поправить вручную.
      </p>
      <div className="group">
        <h3>Любимые кухни по сессиям</h3>
        {cuisines.length === 0 && <p className="muted">Пока пусто — пройдите первую колоду.</p>}
        {cuisines.map(([name, score]) => (
          <div key={name} className="space" style={{ margin: "8px 0" }}>
            <span>{name}</span>
            <span className="muted">{score.toFixed(2)}</span>
          </div>
        ))}
      </div>
      {(categories.length > 0 || ingredients.length > 0) && (
        <div className="group">
          <h3>Категории и продукты</h3>
          {categories.map(([name, score]) => (
            <div key={`c-${name}`} className="space" style={{ margin: "8px 0" }}>
              <span>{name}</span>
              <span className="muted">{score.toFixed(2)}</span>
            </div>
          ))}
          {ingredients.map(([name, score]) => (
            <div key={`i-${name}`} className="space" style={{ margin: "8px 0" }}>
              <span>{name}</span>
              <span className="muted">{score.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="group">
        <h3>Доля исследования</h3>
        <input
          aria-label="Доля новых блюд"
          type="range"
          min={0.1}
          max={0.5}
          step={0.05}
          value={profile.exploreShare}
          onChange={(e) => onChange({ ...profile, exploreShare: Number(e.target.value) })}
        />
        <p className="muted">{Math.round(profile.exploreShare * 100)}% колоды — для новых вкусов.</p>
      </div>
      <div className="group">
        <h3>Веса ранжирования</h3>
        {(["wp", "wc", "wn", "wv", "wr"] as const).map((key) => (
          <label key={key} className="space" style={{ margin: "8px 0" }}>
            <span>{labelOf(key)}</span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={profile.weights[key]}
              onChange={(e) =>
                onChange({
                  ...profile,
                  weights: { ...profile.weights, [key]: Number(e.target.value) }
                })
              }
            />
          </label>
        ))}
        <button className="text-btn" onClick={() => onChange({ ...profile, weights: DEFAULT_WEIGHTS })}>
          сбросить веса
        </button>
      </div>
      <div className="group">
        <h3>Выгрузка приоритетов</h3>
        <p className="muted">
          Снимок кухонь, продуктов и весов — без истории просмотров. Потом по этому файлу можно набрать другую подборку.
        </p>
        <div className="row">
          <button className="secondary" onClick={onDownload}>
            <Icon name="download" size={16} />
            Скачать JSON
          </button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="search" size={16} />
            Загрузить файл
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPickFile(file);
          }}
        />
        {status && <p className="muted">{status}</p>}
      </div>
      <div className="group">
        <h3>Подборка по весам</h3>
        <p className="muted">Другие блюда каталога, которые сейчас лучше всего садятся на эти приоритеты.</p>
        {matches.length === 0 && <p className="muted">Под текущие фильтры ничего не осталось — ослабьте ограничения.</p>}
        <div className="match-list">
          {matches.map((row) => (
            <div key={row.dish.id} className="match-item">
              <Photo src={row.dish.imageUrl} alt={row.dish.canonicalName} size="small" />
              <div>
                <strong>{row.dish.canonicalName}</strong>
                <div className="muted">{row.dish.cuisine}</div>
              </div>
              <span className="match-score">{row.P.toFixed(2)}</span>
            </div>
          ))}
        </div>
        {matches.length > 0 && (
          <button className="primary" style={{ marginTop: 14, width: "100%" }} onClick={() => onStartDeck()}>
            Открыть подборку
          </button>
        )}
      </div>
      <button className="danger" onClick={onClear}>
        Очистить историю
      </button>
    </section>
  );
}

function labelOf(key: string) {
  if (key === "wp") return "предпочтения";
  if (key === "wc") return "контекст вечера";
  if (key === "wn") return "новизна";
  if (key === "wv") return "разнообразие";
  return "штраф за повтор";
}
