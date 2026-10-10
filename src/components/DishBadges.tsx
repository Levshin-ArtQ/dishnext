import { proteinLabel, styleLabel } from "../copy";
import type { Dish, Protein } from "../types";
import { classifyProtein, classifyStyle } from "../domain/protein";
import { Icon, type IconName } from "./Icon";

function proteinIcon(protein?: Protein): IconName {
  if (protein === "chicken") return "chicken";
  if (protein === "pork") return "pork";
  if (protein === "fish") return "fish";
  if (protein === "veg") return "veg";
  if (protein === "beef") return "flame";
  return "chef";
}

export function DishBadges({ dish }: { dish: Dish }) {
  const kind = classifyProtein(dish);
  const look = classifyStyle(dish);
  const protein = proteinLabel(kind);
  const style = styleLabel(look);
  return (
    <>
      {protein && (
        <span className={`pill ${kind === "veg" ? "pill-veg" : "pill-meat"}`}>
          <Icon name={proteinIcon(kind)} size={14} />
          {protein}
        </span>
      )}
      {style && (
        <span className={`pill ${look === "healthy" ? "pill-veg" : "pill-hot"}`}>
          <Icon name={look === "healthy" ? "leaf" : "flame"} size={14} />
          {style}
        </span>
      )}
    </>
  );
}
