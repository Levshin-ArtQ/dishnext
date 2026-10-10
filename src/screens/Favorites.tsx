import { Icon } from "../components/Icon";
import { Photo } from "../components/Photo";
import type { Dish, Favorite, SessionSummary } from "../types";

export function Favorites({
  favorites,
  history,
  dishesById,
  onOpen,
  onBack
}: {
  favorites: Favorite[];
  history: SessionSummary[];
  dishesById: Map<string, Dish>;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <section>
      <button className="text-btn" onClick={onBack}>
        <Icon name="back" size={16} />
        Назад
      </button>
      <h2>Сохранённые</h2>
      <p className="lede">Блюда, которые решили оставить. Живут только на этом телефоне.</p>
      <div className="group">
        <h3>Любимое</h3>
        {favorites.length === 0 && <p className="muted">Пока пусто.</p>}
        {favorites.map((f) => {
          const dish = dishesById.get(f.dishId);
          if (!dish) return null;
          return (
            <button key={f.dishId} className="winner-strip" onClick={() => onOpen(dish.id)}>
              <Photo src={dish.imageUrl} alt={dish.canonicalName} size="small" />
              <div>
                <strong>{dish.canonicalName}</strong>
                <div className="muted">{dish.cuisine}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="group">
        <h3>Прошлые победители</h3>
        {history
          .filter((h) => h.winnerId)
          .slice(0, 12)
          .map((h) => {
            const dish = dishesById.get(h.winnerId!);
            if (!dish) return null;
            return (
              <button key={h.id} className="winner-strip" onClick={() => onOpen(dish.id)}>
                <Photo src={dish.imageUrl} alt={dish.canonicalName} size="small" />
                <div>
                  <strong>{dish.canonicalName}</strong>
                  <div className="muted">{new Date(h.endedAt).toLocaleDateString("ru")}</div>
                </div>
              </button>
            );
          })}
      </div>
    </section>
  );
}
