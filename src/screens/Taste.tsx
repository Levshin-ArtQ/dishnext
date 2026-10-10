import { Icon } from "../components/Icon";
import { DEFAULT_WEIGHTS } from "../domain/ranking";
import type { TasteProfile } from "../types";

export function Taste({
  profile,
  onChange,
  onClear,
  onBack
}: {
  profile: TasteProfile;
  onChange: (next: TasteProfile) => void;
  onClear: () => void;
  onBack: () => void;
}) {
  const cuisines = Object.entries(profile.cuisineScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

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
