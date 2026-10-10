import { MODE_META } from "../copy";
import { FoodDecor } from "../components/FoodDecor";
import { Icon, type IconName } from "../components/Icon";
import { Photo } from "../components/Photo";
import type { Dish, Mode, SessionSummary } from "../types";

const MODE_ICON: Record<Mode, IconName> = {
  feed: "chef",
  explore: "spark",
  tournament: "search"
};

export function Home({
  lastWinner,
  history,
  onMode,
  onTaste,
  onFavorites,
  onCatalog,
  favoriteCount
}: {
  lastWinner?: Dish;
  history: SessionSummary[];
  onMode: (mode: Mode) => void;
  onTaste: () => void;
  onFavorites: () => void;
  onCatalog: () => void;
  favoriteCount: number;
}) {
  return (
    <section className="view-in home">
      <FoodDecor />
      <header className="kicker">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <b>что поесть</b>
        </div>
        <div className="row">
          <button className="text-btn" onClick={onCatalog}>
            <Icon name="edit" size={16} />
            Каталог
          </button>
          <button className="text-btn" onClick={onTaste}>
            <Icon name="sliders" size={16} />
            Настройки
          </button>
          <button className="text-btn" onClick={onFavorites}>
            <Icon name="bookmark" size={16} />
            Сохранённые{favoriteCount ? ` ${favoriteCount}` : ""}
          </button>
        </div>
      </header>
      <h1>
        Что сегодня
        <br />
        по вкусу?
      </h1>
      <p className="lede">Курица, свинина и овощи — короткая подборка на ужин, как готовите дома.</p>
      <div className="mode-list">
        {(Object.keys(MODE_META) as Mode[]).map((mode) => (
          <button key={mode} className={`mode-card ${mode}`} onClick={() => onMode(mode)}>
            <span className="mode-ico" aria-hidden="true">
              <Icon name={MODE_ICON[mode]} size={26} />
            </span>
            <h3>{MODE_META[mode].title}</h3>
            <p>{MODE_META[mode].lede}</p>
          </button>
        ))}
      </div>
      {lastWinner && (
        <button className="winner-strip" onClick={onFavorites}>
          <Photo src={lastWinner.imageUrl} alt={lastWinner.canonicalName} size="small" />
          <div>
            <div className="muted">в прошлый раз готовили</div>
            <strong>{lastWinner.canonicalName}</strong>
            <div className="muted">{lastWinner.cuisine}</div>
          </div>
        </button>
      )}
      {history.length > 1 && (
        <p className="muted" style={{ marginTop: 18 }}>
          Сохранено сессий: {history.length}. История живёт только на этом устройстве.
        </p>
      )}
    </section>
  );
}
