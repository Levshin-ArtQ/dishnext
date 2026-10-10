#!/usr/bin/env python3
"""Write verified Russian descriptions from recipe-page copy into the catalog."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "data" / "catalog.json"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from overrides_lib import apply_overrides

# Russian lines taken from the source page / Wikipedia extract, checked against ingredients.
BLURB_RU = {
    "Pancakes": "Тонкие блинчики по простому рецепту — каждый раз одинаковые.",
    "Clam chowder": "Густой сливочный суп из моллюсков с беконом и картофелем.",
    "Choripán": "Сэндвич с жареным чоризо — уличная классика Аргентины.",
    "Choripan": "Сэндвич с жареным чоризо — уличная классика Аргентины.",
    "Chorip\u00e1n": "Сэндвич с жареным чоризо — уличная классика Аргентины.",
    "BBQ Pork Sloppy Joes": "Слоппи-джо со свининой в соусе барбекю, с картофелем и луком.",
    "Asado": "Аргентинский асадо: говядина на углях с чоризо и морсильей.",
    "Locro": "Андийское густое рагу из тыквы, кукурузы, фасоли, говядины, свинины и чоризо.",
    "Beef Wellington": "Говяжья вырезка в слоёном тесте с грибами и пармской ветчиной.",
    "Chicken Ham and Leek Pie": "Пирог с куриной грудкой, ветчиной и пореем в сливочном соусе.",
    "Turkey Bánh mì": "Бань ми с индейкой, куриной печенью, огурцом и маринованной капустой.",
    "Chicken Salad With Mushrooms and Bacon": "Салат с куриной грудкой, грибами, беконом и горчичной заправкой.",
    "Smoked Haddock Kedgeree": "Кеджери: копчёная пикша с рисом басмати, яйцами и специями.",
    "Boxty Breakfast": "Ирландские картофельные боксти с беконом, яйцом и помидорами.",
    "Arroz al horno (baked rice)": "Валенсийский запечённый рис со свиной грудинкой, морсильей, беконом и фасолью.",
    "Paella": "Паэлья с креветками, мидиями, кальмаром, шафраном и чоризо.",
    "Osso Buco alla Milanese": "Оссобуко: телячьи голяшки с овощами, цедрой апельсина и вином.",
    "Amok Trey – Cambodian Fish Curry": "Камбоджийское рыбное карри амок в кокосовом молоке, в банановом листе.",
    "Bai Sach Chrouk – Grilled Pork with Rice": "Жареная свинина в кокосово-соевом маринаде, с жасминовым рисом.",
    "Poutine": "Путин: картофель фри с сырными сгустками и говяжьей подливкой.",
    "Hot and Sour Soup": "Китайский кисло-острый суп со свининой, тофу и древесными грибами.",
    "Lamb Tagine": "Тажин из ягнёнка с морковью, курагой, шафраном, зирой и мёдом.",
    "Dolma Japrak Stuffed Vine Leaves": "Долма: виноградные листья с бараньим фаршем, рисом и зеленью.",
    "Braised Beef Chilli": "Чили из томлёной говядины с чоризо, анчо и фасолью.",
    "Bigos (Hunters Stew)": "Бигос: капуста и квашеная капуста со свининой, кильбасой и беконом.",
    "Bryndzové Halušky": "Картофельные галушки с брынзой и беконом — словацкое национальное блюдо.",
    "Thai Green Curry": "Тайское зелёное карри с курицей, картофелем, фасолью и кокосовым молоком.",
    "Burek": "Бурек из теста фило с говяжьим фаршем и луком.",
    "Cevapi Sausages": "Чевапи: колбаски из говяжьего и свиного фарша с луком и паприкой.",
    "Chilean Empanada": "Чилийские эмпанадас со свиным фаршем, изюмом и оливками.",
    "Jamaican Curry Goat": "Ямайское карри из козлятины с картофелем и скотч-боннет.",
    "Callaloo Jamaican Style": "Ямайский каллалу: кейл с беконом, тимьяном и перцем.",
    "Chicken Karaage": "Карааге: курица в имбирно-соевом маринаде, обжаренная в крахмале.",
    "Japanese Katsudon": "Кацудон: свиная котлета с яйцом и луком на рисе.",
    "Skillet Apple Pork Chops with Roasted Sweet Potatoes & Zucchini": "Свиные отбивные на сковороде с яблоком, бататом и кабачком.",
    "Salmon Eggs Eggs Benedict": "Яйца бенедикт с копчёным лососем.",
    "Chicken Fajita Mac and Cheese": "Макароны с сыром и курицей по-фахита.",
    "Bengali Chicken Curry with Potatoes": "Бенгальское куриное карри с картофелем.",
    "Belgian Waterzooi Chicken": "Бельгийский ватерзой: курица в сливочном бульоне с овощами.",
    "Creamy Tomato Soup": "Сливочный томатный суп.",
    "Dal fry": "Жареный дал из чечевицы со специями.",
    "Chicken Mandi": "Манди: курица с рисом по-йеменски.",
    "Chicken Handi": "Курица ханди в сливочно-томатном соусе.",
    "Roast fennel and aubergine paella": "Овощная паэлья с фенхелем, баклажаном и шафраном.",
    "Chicken Alfredo Primavera": "Фетучини Альфредо с курицей и овощами.",
    "Chinese Tomato Egg Stir Fry": "Китайская яичница с помидорами.",
    "Chicken Fried Rice": "Жареный рис с курицей.",
    "Chinese Orange Chicken": "Курица в апельсиновом соусе.",
    "Chicken Congee": "Куриная рисовая каша конги.",
    "Air Fryer Egg Rolls": "Спринг-роллы в аэрогриле со свиным фаршем.",
    "Chuletas de Cerdo a la Criolla (Pork Chops in Creole Sauce)": "Свиные отбивные в креольском соусе.",
    "Black Bean soup": "Суп из чёрной фасоли.",
    "Ayam Percik": "Малайзийская курица перчик в пряном кокосовом маринаде.",
    "Chicken Liver Pate Recipe": "Паштет из куриной печени с беконом.",
    "Chicken Enchilada Casserole": "Запеканка энчилада с курицей.",
    "Cajun spiced fish tacos": "Тако с рыбой в специях каджун.",
    "Chickpea Fajitas": "Фахитас с нутом.",
    "Blini Pancakes": "Блины.",
    "Cabbage Soup (Shchi)": "Щи — капустный суп.",
    "Pad See Ew": "Пад си иу: широкая рисовая лапша с курицей и соевым соусом.",
    "Keleya Zaara": "Тунисская баранина с шафраном, луком и лимоном.",
    "Leblebi Soup": "Тунисский нутовый суп леблеби.",
    "Turkish rice (vermicelli rice)": "Турецкий рис с вермишелью.",
    "Aubergine & hummus grills": "Запечённый баклажан с хумусом.",
    "Chicken Basquaise": "Курица по-баскски с перцем и помидорами.",
    "Brown Stew Chicken": "Ямайская тушёная курица браун стью.",
    "Katsu Chicken curry": "Курица кацу с японским карри.",
    "Rappie Pie": "Акадийский раппи-пай из курицы и тёртого картофеля.",
    "Frog Legs Recipe in Garlic Butter": "Лягушачьи лапки в чесночном масле.",
    "Simple heart of palm & tomato salad": "Лёгкий салат из пальмовых сердечек и помидоров.",
    "Bahia-style Moqueca prawn stew": "Бразильское рагу из креветок в кокосовом соусе со специями.",
    "Black bean & meat stew - feijoada": "Фейжоада: чёрная фасоль со свиными рёбрами, лопаткой и чоризо.",
    "Turkey Meatloaf": "Мясной хлеб из индейки — более лёгкий вариант американской классики.",
    "Chicken & mushroom Hotpot": "Куриное рагу с грибами под картофельной крышкой.",
    "Bean & Sausage Hotpot": "Хотпот с колбасками и фасолью в томатном соусе.",
    "Broccoli & Stilton soup": "Пюре-суп из брокколи с голубым сыром стилтон.",
    "Toad In The Hole": "Колбаски в кляре йоркширского пудинга, обычно с луковым грави.",
    "Purple sprouting broccoli tempura with nuoc cham": "Хрустящая темпура из брокколи с кисло-сладким соусом ныок-чам.",
    "Barbecue pork buns": "Бао со свининой барбекю — домашние димсам.",
    "Vietnamese Grilled Pork (bun-thit-nuong)": "Рисовая лапша с жареной свининой — бань тхит ныонг.",
    "Chicken Quinoa Greek Salad": "Куриное филе на гриле с киноа, фетой, оливками каламата, помидором и мятой.",
    "Baingan Bharta": "Запечённый баклажан, размятый с помидором, луком и специями.",
    "Matar Paneer": "Панир с горошком в остром томатном соусе, около 25 минут.",
    "Tandoori chicken": "Курица в йогурте и специях, запечённая как в тандыре.",
    "Coddled pork with cider": "Свинина, томлённая в сидре, — ирландское рагу к кольканнону.",
    "Crispy Sausages and Greens": "Хрустящие колбаски с зеленью на будний вечер.",
    "Ajo blanco": "Холодный миндальный суп из четырёх продуктов, по-андалусски.",
    "Chicken & chorizo rice pot": "Курица с чоризо и рисом в одной кастрюле.",
    "Chicken with saffron, raisins & pine nuts": "Испанская курица с шафраном, изюмом и кедровыми орехами.",
    "Chorizo, potato & cheese omelette": "Омлет с чоризо, картофелем и сыром.",
    "Air fryer patatas bravas": "Пататас бравас в аэрогриле с томатным соусом и базиликом.",
    "Chickpea, chorizo & spinach stew": "Рагу с нутом, чоризо и шпинатом в одной сковороде.",
    "Chorizo & chickpea soup": "Суп с чоризо и нутом.",
    "Spaghetti alla Carbonara": "Классическая карбонара: сырный соус, панчетта и чёрный перец.",
    "Lasagne": "Лазанья с беконом, говяжьим фаршем и моцареллой.",
    "Chilli prawn linguine": "Лингвини с креветками, чили и чесноком.",
    "Ribollita": "Тосканское рагу с кале, фасолью и помидорами.",
    "Venetian Duck Ragu": "Медленное утиное рагу с корицей — к широкой пасте.",
    "Cambodian Stir-fried Morning Glory with Pork, Fermented Soybeans, and Garlic": "Жареный вунг со свининой, ферментированными соевыми бобами и чесноком.",
    "Tourtiere": "Франко-канадский мясной пирог туртьер.",
    "Cuban Sandwich": "Кубинский сэндвич: томлёная свинина, ветчина, сыр и маринованные огурцы.",
    "Nasi lemak": "Малайзийский рис на кокосовом молоке с листом пандана.",
    "Chicken Couscous": "Кускус с курицей в одной сковороде.",
    "Chicken Shawarma with homemade garlic herb yoghurt sauce": "Куриная шаурма с чесночно-йогуртовым соусом; курицу маринуют 10–12 часов.",
    "Mutabbaq": "Мутаббак — жареная лепёшка с начинкой.",
    "Shakshouka": "Яйца в соусе из помидоров, перца, лука и чеснока с зирой и паприкой.",
    "Shakshuka Feta Cheese": "Шакшука с фетой — к бранчу.",
    "Baba Ghanoush": "Баба гануш: запечённый баклажан с тахини, лимоном и оливковым маслом.",
    "Pad Thai": "Пад-тай — рисовая лапша с соусом, почти национальное блюдо Таиланда.",
    "Chakchouka": "Яйца в пряном томатном соусе, североафриканская шакшука.",
    "Adana kebab": "Кебаб из баранины с красным перцем и пуль бибером.",
    "Cacik": "Турецкий дзадзики: йогурт, огурец, мята и чеснок.",
    "Chicken wings with cumin, lemon & garlic": "Куриные крылья с зирой, лимоном и чесноком.",
    "Beetroot Soup (Borscht)": "Классический украинский борщ со свёклой.",
    "Prawn & Fennel Bisque": "Густой суп из креветок и фенхеля.",
    "Beef Bourguignon": "Говядина по-бургундски — медленное зимнее рагу.",
    "Chicken Marengo": "Курица маренго с грибами, оливками, помидорами и петрушкой.",
    "Chicken Parmentier": "Картофельная запеканка из остатков жареной курицы.",
    "Coq au vin": "Кок-о-вен: курица, томлённая в вине.",
    "Ratatouille": "Рататуй — тушёные овощи.",
    "French Onion Soup": "Французский луковый суп — густой и простой.",
    "Tonkatsu pork": "Свиная котлета тонкацу в панировке, с соусом тонкацу.",
    "Mediterranean Pasta Salad": "Салат с пастой, помидорами, оливками и фетой — холодный итальянский ужин.",
    "Rigatoni with fennel sausage sauce": "Ригатони с соусом из колбасок и фенхеля.",
    "Fettuccine Alfredo": "Фетучини в сливочно-сырном соусе Альфредо.",
    "Spicy Arrabiata Penne": "Пенне арраббиата: томаты, чеснок и чили без сливок.",
    "Pilchard puttanesca": "Паста путтанеска с сардинами, оливками, каперсами и томатами.",
    "Pizza Express Margherita": "Пицца маргарита: томат, моцарелла и базилик.",
    "Potato Gratin with Chicken": "Картофельный гратен с курицей.",
    "Vegan Lasagna": "Лазанья без мяса, с овощами и томатным соусом.",
    "Salmon Prawn Risotto": "Ризотто с лососем и креветками.",
    "Spinach & Ricotta Cannelloni": "Каннеллони со шпинатом и рикоттой.",
    "Squash linguine": "Лингвини с тыквой.",
    "Spaghetti Bolognese": "Спагетти болоньезе с мясным томатным соусом.",
    "Lamb Pilaf (Plov)": "Плов с бараниной, морковью и зирой.",
    "Fish Soup (Ukha)": "Уха из белой рыбы с картофелем, луком и укропом.",
    "Potato Salad (Olivier Salad)": "Салат оливье с картофелем, яйцом и солёными огурцами.",
    "Beef stroganoff": "Бефстроганов: говядина в сметанном соусе с луком.",
    "Rosol (Polish Chicken Soup)": "Прозрачный куриный бульон с овощами.",
    "Polish patties (kotlety)": "Котлеты из фарша на сковороде.",
    "Golabki (cabbage roll)": "Голубцы: капуста с мясной начинкой в томате.",
    "Cucumber & fennel salad": "Лёгкий салат из огурца и фенхеля.",
}

JUNK = re.compile(
    r"JSON Recipe API|this collection of|Shown below is the method|A selection of .+ recipes|Dive into the vibrant world",
    re.I,
)


def main() -> None:
    catalog = json.loads(CATALOG.read_text())
    n = 0
    for dish in catalog["dishes"]:
        orig = dish.get("originalName") or ""
        ru = BLURB_RU.get(orig)
        src = dish.get("sourceBlurb") or ""
        if ru:
            dish["description"] = ru
            n += 1
        elif dish.get("source") == "local" and (dish.get("description") or "").strip():
            n += 1
        else:
            desc = (dish.get("description") or "").strip()
            if re.search(r"блюдо \S+ кухни \(|Рецепт — пошагово", desc) or len(desc) < 24:
                ings = [i for i in (dish.get("ingredients") or []) if i][:4]
                cuisine = dish.get("cuisine") or ""
                name = dish.get("canonicalName") or ""
                if ings:
                    dish["description"] = f"{name} с {', '.join(ings)}. {cuisine} кухня."
                else:
                    dish["description"] = f"{name} — {cuisine} кухня."
                n += 1
        dish.pop("sourceBlurb", None)
    catalog = apply_overrides(catalog)
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {n} russian blurbs -> {CATALOG}")


if __name__ == "__main__":
    main()
