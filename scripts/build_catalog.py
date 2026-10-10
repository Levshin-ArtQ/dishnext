#!/usr/bin/env python3
"""Build a Russian dinner catalog from a TheMealDB dump (letters a–z JSON)."""
from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DUMP = Path(os.environ.get("DISHNEXT_DUMP", "/tmp/dishnext/letters"))
OUT = ROOT / "public" / "data" / "catalog.json"
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from enrich_catalog import classify_protein as protein_from_ings
from enrich_catalog import classify_style as style_from_ings
from local_meals import local_catalog

CUISINE = {
    "Spanish": "Испанская", "British": "Британская", "Turkish": "Турецкая",
    "Vietnamese": "Вьетнамская", "Thai": "Тайская", "Chinese": "Китайская",
    "France": "Французская", "French": "Французская", "Jamaican": "Ямайская",
    "Italian": "Итальянская", "Italy": "Итальянская",
    "United States": "Американская", "American": "Американская",
    "Russia": "Русская", "Ukraine": "Украинская", "Poland": "Польская",
    "Polish": "Польская", "India": "Индийская", "Indian": "Индийская",
    "Canadian": "Канадская", "Japanese": "Японская", "Mexican": "Мексиканская",
    "Russian": "Русская", "Greek": "Греческая", "Moroccan": "Марокканская",
    "Portuguese": "Португальская", "Malaysian": "Малайзийская", "Egyptian": "Египетская",
    "Irish": "Ирландская", "Filipino": "Филиппинская", "Ukrainian": "Украинская",
    "Croatian": "Хорватская", "Tunisian": "Тунисская", "Brazil": "Бразильская",
    "Brazilian": "Бразильская", "Argentina": "Аргентинская", "Argentine": "Аргентинская",
    "Netherlands": "Голландская", "Dutch": "Голландская", "Australian": "Австралийская",
    "Kenyan": "Кенийская", "Syrian": "Сирийская", "Algerian": "Алжирская",
    "Saudi Arabian": "Саудовская", "Uruguayan": "Уругвайская", "Norwegian": "Норвежская",
    "Norway": "Норвежская", "Slovakian": "Словацкая", "Slovakia": "Словацкая",
    "Cambodia": "Камбоджийская", "Cambodian": "Камбоджийская", "Colombia": "Колумбийская",
    "Venezuela": "Венесуэльская", "Chile": "Чилийская", "Cuba": "Кубинская",
    "Denmark": "Датская", "Belgian": "Бельгийская", "Belgium": "Бельгийская",
    "Bulgarian": "Болгарская", "Bulgaria": "Болгарская", "Bangladesh": "Бангладешская",
    "Malaysian": "Малайзийская", "Unknown": "Международная",
}

CATEGORY = {
    "Beef": "Говядина", "Breakfast": "Завтрак", "Chicken": "Курица",
    "Dessert": "Десерт", "Goat": "Козлятина", "Lamb": "Баранина",
    "Miscellaneous": "Разное", "Pasta": "Паста", "Pork": "Свинина",
    "Seafood": "Морепродукты", "Side": "Гарнир", "Starter": "Закуска",
    "Vegan": "Веганское", "Vegetarian": "Вегетарианское",
}

ING = {
    "chicken": "курица", "chicken legs": "куриные ножки", "chicken thighs": "куриные бёдра",
    "chicken breast": "куриная грудка", "chicken breasts": "куриная грудка",
    "chicken stock": "куриный бульон", "chicken broth": "куриный бульон",
    "shallot": "шалот", "shallots": "шалот", "brandy": "бренди",
    "curry powder": "порошок карри", "ginger garlic paste": "паста из имбиря и чеснока",
    "cayenne pepper": "кайенский перец", "ground turmeric": "куркума",
    "ground cumin": "зира",
    "beef": "говядина", "pork": "свинина", "lamb": "баранина",
    "salmon": "лосось", "prawns": "креветки", "shrimp": "креветки", "fish": "рыба",
    "rice": "рис", "pasta": "паста", "spaghetti": "спагетти", "noodles": "лапша",
    "potato": "картофель", "potatoes": "картофель", "tomato": "помидоры",
    "tomatoes": "помидоры", "onion": "лук", "onions": "лук", "garlic": "чеснок",
    "ginger": "имбирь", "egg": "яйца", "eggs": "яйца", "milk": "молоко",
    "butter": "сливочное масло", "cream": "сливки", "cheese": "сыр",
    "parmesan": "пармезан", "mozzarella": "моцарелла", "feta": "фета",
    "yogurt": "йогурт", "yoghurt": "йогурт", "flour": "мука", "bread": "хлеб",
    "olive oil": "оливковое масло", "vegetable oil": "растительное масло",
    "soy sauce": "соевый соус", "sesame": "кунжут", "peanut": "арахис",
    "almond": "миндаль", "walnut": "грецкий орех", "cashew": "кешью",
    "chickpea": "нут", "chickpeas": "нут", "lentil": "чечевица", "lentils": "чечевица",
    "bean": "фасоль", "beans": "фасоль", "black beans": "чёрная фасоль",
    "cabbage": "капуста", "carrot": "морковь", "carrots": "морковь",
    "pepper": "перец", "chilli": "чили", "chili": "чили", "paprika": "паприка",
    "cumin": "зира", "coriander": "кинза", "cilantro": "кинза", "parsley": "петрушка",
    "basil": "базилик", "mint": "мята", "thyme": "тимьян", "rosemary": "розмарин",
    "lemon": "лимон", "lime": "лайм", "coconut": "кокос", "coconut milk": "кокосовое молоко",
    "mushroom": "грибы", "mushrooms": "грибы", "spinach": "шпинат",
    "aubergine": "баклажан", "eggplant": "баклажан", "courgette": "кабачок",
    "zucchini": "кабачок", "avocado": "авокадо", "bacon": "бекон",
    "sausage": "колбаса", "chorizo": "чоризо", "ham": "ветчина",
    "tuna": "тунец", "cod": "треска", "mussel": "мидии", "mussels": "мидии",
    "squid": "кальмар", "calamari": "кальмар", "lobster": "омар",
    "honey": "мёд", "sugar": "сахар", "salt": "соль", "water": "вода",
    "stock": "бульон", "broth": "бульон", "wine": "вино", "vinegar": "уксус",
    "mustard": "горчица", "mayonnaise": "майонез", "tofu": "тофу",
    "soy": "соя", "sesame oil": "кунжутное масло", "spring onion": "зелёный лук",
    "scallion": "зелёный лук", "leek": "лук-порей", "celery": "сельдерей",
    "cucumber": "огурец", "beetroot": "свёкла", "pumpkin": "тыква",
    "sweet potato": "батат", "corn": "кукуруза", "peas": "горох",
    "green beans": "стручковая фасоль", "olive": "оливки", "olives": "оливки",
    "broccoli": "брокколи", "cauliflower": "цветная капуста",
    "buckwheat": "гречка", "kefir": "кефир", "pollock": "минтай",
    "pearl barley": "перловка", "barley": "перловка",
    "rocket": "руккола", "arugula": "руккола", "rucola": "руккола",
    "cottage cheese": "творог", "quark": "творог",
    "dill": "укроп", "beet": "свёкла", "beets": "свёкла",
    "capers": "каперсы", "anchovy": "анчоусы", "anchovies": "анчоусы",
    "turkey": "индейка", "duck": "утка", "veal": "телятина",
    "plain flour": "пшеничная мука", "self-raising flour": "разрыхлённая мука",
    "breadcrumbs": "панировочные сухари", "pastry": "тесто",
    "puff pastry": "слоёное тесто", "shortcrust pastry": "песочное тесто",
    "red onion": "красный лук", "red onions": "красный лук",
    "green chilli": "зелёный чили", "red chilli": "красный чили",
    "chilli powder": "порошок чили", "garam masala": "гарам масала",
    "turmeric": "куркума", "cardamom": "кардамон", "cinnamon": "корица",
    "clove": "гвоздика", "cloves": "гвоздика", "bay leaf": "лавровый лист",
    "bay leaves": "лавровый лист", "black pepper": "чёрный перец",
    "white pepper": "белый перец", "saffron": "шафран", "paprika": "паприка",
    "tomato puree": "томатная паста", "tomato paste": "томатная паста",
    "chopped tomatoes": "нарезанные помидоры", "passata": "пассата",
    "coconut cream": "кокосовые сливки", "double cream": "жирные сливки",
    "sour cream": "сметана", "creme fraiche": "крем-фреш",
    "cheddar cheese": "чеддер", "parmesan cheese": "пармезан",
    "feta cheese": "фета", "goat cheese": "козий сыр",
    "mozarella": "моцарелла", "mozzarella": "моцарелла",
    "basmati rice": "рис басмати", "jasmine rice": "жасминовый рис",
    "arborio rice": "рис арборио", "noodles": "лапша",
    "egg noodles": "яичная лапша", "rice noodles": "рисовая лапша",
    "udon": "удон", "spaghetti": "спагетти", "linguine": "лингвини",
    "penne": "пенне", "lasagne": "лазанья", "lasagna": "лазанья",
    "tortilla": "тортилья", "wrap": "лепёшка", "pita": "пита",
    "hummus": "хумус", "tahini": "тахин", "peanut butter": "арахисовая паста",
    "fish sauce": "рыбный соус", "oyster sauce": "устричный соус",
    "hoisin": "хойсин", "mirin": "мирин", "sake": "саке",
    "rice vinegar": "рисовый уксус", "balsamic vinegar": "бальзамический уксус",
    "white wine": "белое вино", "red wine": "красное вино",
    "cider": "сидр", "beer": "пиво", "orange": "апельсин",
    "apple": "яблоко", "banana": "банан", "mango": "манго",
    "pineapple": "ананас", "raisins": "изюм", "dates": "финики",
    "pine nuts": "кедровые орехи", "pistachio": "фисташки",
    "hazelnut": "фундук", "peanuts": "арахис",
    "raw tiger prawns": "тигровые креветки", "tiger prawns": "тигровые креветки",
    "black eyed peas": "чёрный глаз горох", "black-eyed peas": "чёрный глаз горох",
    "plum tomatoes": "сливовидные помидоры", "coriander": "кинза",
    "baking powder": "разрыхлитель", "yeast": "дрожжи",
    "gelatine": "желатин", "gelatin": "желатин",
    "dark chocolate": "тёмный шоколад", "white chocolate": "белый шоколад",
    "cocoa": "какао", "vanilla": "ваниль", "icing sugar": "сахарная пудра",
}

NAME = {
    "Beef Wellington": "Биф Веллингтон",
    "Beef stroganoff": "Бефстроганов",
    "Beef Bourguignon": "Говядина по-бургундски",
    "Coq au vin": "Петух в вине",
    "Ayam Percik": "Аям перчик",
    "Beef Rendang": "Ренданг из говядины",
    "Chicken Handi": "Курица ханди",
    "Dal fry": "Дал фрай",
    "Baingan Bharta": "Байнган бхарта",
    "Beef pho": "Фо с говядиной",
    "Drunken noodles (pad kee mao)": "Пьяная лапша (пад ки мао)",
    "Chicken Karaage": "Карааге из курицы",
    "Chicken Shawarma with homemade garlic herb yoghurt sauce": "Куриная шаурма с чесночным йогуртом",
    "Adana kebab": "Адана-кебаб",
    "Brown Stew Chicken": "Ямайская тушёная курица",
    "Beef Sunday Roast": "Воскресный ростбиф",
    "Baked salmon with fennel & tomatoes": "Запечённый лосось с фенхелем и томатами",
    "Arroz al horno (baked rice)": "Аррос аль орно — запечённый рис",
    "Air fryer patatas bravas": "Пататас бравас",
    "Chicken & chorizo rice pot": "Курица с чоризо и рисом",
    "Chilli prawn linguine": "Лингвини с чили и креветками",
    "Chicken Alfredo Primavera": "Курица Альфредо примавера",
    "Chicken Enchilada Casserole": "Запеканка энчилада с курицей",
    "Cajun spiced fish tacos": "Тако с рыбой в стиле каджун",
    "Chickpea Fajitas": "Фахитас с нутом",
    "Braised Beef Chilli": "Чили из томлёной говядины",
    "Beef Lo Mein": "Ло мейн с говядиной",
    "Chicken Fried Rice": "Жареный рис с курицей",
    "Chicken Congee": "Куриная каша конджи",
    "Chinese Orange Chicken": "Китайская курица в апельсиновом соусе",
    "Beef and Broccoli Stir-Fry": "Говядина с брокколи",
    "Chicken Couscous": "Кускус с курицей",
    "Chicken Basquaise": "Курица по-баскски",
    "Chicken Marengo": "Курица маренго",
    "Bigos (Hunters Stew)": "Бигос",
    "Bigos (Polish hunter's stew)": "Бигос",
    "Beetroot Soup (Borscht)": "Борщ",
    "Borsch": "Борщ",
    "Cabbage Soup (Shchi)": "Щи",
    "Blini Pancakes": "Блины",
    "Cevapi Sausages": "Чевапи",
    "Chakchouka": "Шакшука",
    "Asado": "Асадо",
    "Choripán": "Чорипан",
    "Bahia-style Moqueca prawn stew": "Мокека с креветками",
    "Black bean & meat stew - feijoada": "Фейжоада",
    "Beef Caldereta": "Кальдерата из говядины",
    "Bistek": "Бистек",
    "Beef Mechado": "Мехадо из говядины",
    "Corned Beef and Cabbage": "Солонина с капустой",
    "Clam chowder": "Клэм-чаудер",
    "Beef Brisket Pot Roast": "Томлёная грудинка",
    "Bean & Sausage Hotpot": "Рагу с фасолью и колбасками",
    "Bitterballen (Dutch meatballs)": "Биттербаллен",
    "Croatian Bean Stew": "Хорватское фасолевое рагу",
    "Croatian lamb peka": "Ягнёнок пека",
    "Chicken Quinoa Greek Salad": "Греческий салат с курицей и киноа",
    "Aubergine & hummus grills": "Баклажаны с хумусом на гриле",
    "Aubergine couscous salad": "Салат из кускуса с баклажаном",
    "Cacik": "Джаджик",
    "Amok Trey – Cambodian Fish Curry": "Амок трей — камбоджийское рыбное карри",
    "Bai Sach Chrouk – Grilled Pork with Rice": "Бай сач чрук — свинина с рисом",
    "BEEF LOK LAK (Lok Lak Sach Ko)": "Лок лак из говядины",
    "Bang bang prawn salad": "Салат банг-банг с креветками",
    "Barbecue pork buns": "Бао со свининой барбекю",
    "Beef Banh Mi Bowls with Sriracha Mayo, Carrot & Pickled Cucumber": "Боул бань ми с говядиной",
    "Ajo blanco": "Ахо бланко",
    "Arroz con gambas y calamar": "Рис с креветками и кальмаром",
    "Algerian Kefta (Meatballs)": "Алжирская кефта",
    "Algerian Flafla (Bell Pepper Salad)": "Алжирский салат флафла",
    "Air Fryer Egg Rolls": "Спринг-роллы в аэрогриле",
    "Arepa Pabellón": "Арепа пабельон",
    "Aussie Burgers": "Австралийский бургер",
    "BBQ Pork Sloppy Joes": "Слоппи джо со свининой",
    "Baba Ghanoush": "Баба гануш",
    "Barramundi with Moroccan spices": "Баррамунди с марокканскими специями",
    "Beef Asado": "Говядина асадо",
    "Beef Dumpling Stew": "Рагу с говяжьими клёцками",
    "Beef Empanadas": "Эмпанадас с говядиной",
    "Beef Mandi": "Манди из говядины",
    "Beef and Mustard Pie": "Пирог с говядиной и горчицей",
    "Belgian Waterzooi Chicken": "Ватерзой из курицы",
    "Bengali Chicken Curry with Potatoes": "Бенгальское куриное карри с картофелем",
    "Boxty Breakfast": "Боксти на завтрак",
    "Bread omelette": "Омлет в хлебе",
    "Broccoli & Stilton soup": "Суп из брокколи со стилтоном",
    "Brun Lapskaus (Norwegian Beef Vegetable Stew)": "Брун лапскаус",
    "Bryndzové Halušky": "Брындзове галушки",
    "Burek": "Бюрек",
    "Callaloo Jamaican Style": "Каллалу по-ямайски",
    "Carbonada Criolla": "Карбонада криолья",
    "Chicken & mushroom Hotpot": "Рагу из курицы с грибами",
    "Chicken Fajita Mac and Cheese": "Мак-энд-чиз с куриной фахитой",
    "Chicken Ham and Leek Pie": "Пирог с курицей, ветчиной и пореем",
    "Chicken Mandi": "Куриный манди",
    "Chicken Parmentier": "Курица пармантье",
    "Chicken with saffron, raisins & pine nuts": "Курица с шафраном, изюмом и кедровыми орехами",
    "Chicken wings with cumin, lemon & garlic": "Крылья с зирой, лимоном и чесноком",
    "Chickpea, chorizo & spinach stew": "Рагу с нутом, чоризо и шпинатом",
    "Chilli ginger lamb chops": "Каре ягнёнка с чили и имбирём",
    "Chinese Tomato Egg Stir Fry": "Жареные яйца с томатами",
    "Chivito uruguayo": "Чивито",
    "Chivito sandwich": "Сэндвич чивито",
    "Chorba Hamra bel Frik (Algerian Lamb, Tomato, and Freekeh Soup)": "Шорба хамра с ягнёнком",
    "Chorizo & chickpea soup": "Суп с чоризо и нутом",
    "Chorizo, potato & cheese omelette": "Омлет с чоризо, картофелем и сыром",
    "Chtitha Batata (Algerian Potato Stew)": "Чтиха батата",
    "Classic Tourtière": "Туртьер",
    "Coddled pork with cider": "Свинина в сидре",
    "Corned Beef Hash": "Хэш из солонины",
    "Creamy Tomato Soup": "Сливочный томатный суп",
    "Crispy Eggplant": "Хрустящие баклажаны",
    "Crispy Sausages and Greens": "Хрустящие колбаски с зеленью",
    "Cuban Sandwich": "Кубинский сэндвич",
    "Cumberland Pie": "Камберлендский пирог",
    "Dolma Japrak Stuffed Vine Leaves": "Долма в виноградных листьях",
    "Feijoada": "Фейжоада",
    "Fish pie": "Рыбный пирог",
    "French Onion Soup": "Французский луковый суп",
    "Grilled eggplant with coconut milk": "Баклажаны в кокосовом молоке",
    "Honey Teriyaki Salmon": "Лосось терияки с мёдом",
    "Japanese Katsudon": "Кацудон",
    "Katsu Chicken curry": "Кацу-карри с курицей",
    "Keleya Zaara": "Келея заара",
    "Lamb Tagine": "Тажин из ягнёнка",
    "Lasagne": "Лазанья",
    "Leblebi Soup": "Суп леблеби",
    "Matar Paneer": "Матар панир",
    "Minced Beef Pie": "Пирог с фаршем",
    "Moussaka": "Мусака",
    "Mulukhiyah": "Мулухия",
    "Nasi lemak": "Наси лемак",
    "Osso Buco alla Milanese": "Оссобуко по-милански",
    "Pad See Ew": "Пад си эу",
    "Pad Thai": "Пад-тай",
    "Paella": "Паэлья",
    "Pancakes": "Блины",
    "Paszteciki (Polish Pasties)": "Паштецики",
    "Penne with vodka": "Пенне с водкой",
    "Pork Dumplings": "Свиные димсам",
    "Portuguese fish stew (Caldeirada de peixe)": "Калдейрада",
    "Potato Salad (Olivier Salad)": "Оливье",
    "Prawn & Fennel Bisque": "Биск из креветок и фенхеля",
    "Rappie Pie": "Раппи-пай",
    "Ratatouille": "Рататуй",
    "Ribollita": "Риболлита",
    "Roast fennel and aubergine paella": "Паэлья с фенхелем и баклажаном",
    "Rock Cakes": "Каменные кексы",
    "Rogaliki (Polish Croissant Cookies)": "Рогалики",
    "Roti john": "Роти джон",
    "Salmon Eggs Eggs Benedict": "Бенедикт с лососем",
    "Salmon Prawn Risotto": "Ризотто с лососем и креветками",
    "Saltfish and Ackee": "Аки со солёной рыбой",
    "Seafood fideuà": "Филеуа с морепродуктами",
    "Shakshuka": "Шакшука",
    "Smoked Haddock Kedgeree": "Кеджери",
    "Snert (Split Pea Soup)": "Снерт — гороховый суп",
    "Spaghetti Bolognese": "Спагетти болоньезе",
    "Spaghetti alla Carbonara": "Карбонара",
    "Spanish tortilla": "Испанская тортилья",
    "Spinach & Ricotta Cannelloni": "Каннеллони со шпинатом и рикоттой",
    "Squash linguine": "Лингвини с тыквой",
    "Steak and Kidney Pie": "Пирог со стейком и почками",
    "Sticky Toffee Pudding": "Пудинг стики тоффи",
    "Szechuan Beef": "Сычуаньская говядина",
    "Tamiya": "Тамия",
    "Tandoori chicken": "Цыплёнок тандури",
    "Thai Green Curry": "Тайское зелёное карри",
    "Toad In The Hole": "Тод-ин-зе-хол",
    "Tonkatsu pork": "Тонкацу",
    "Tourtiere": "Туртьер",
    "Tuna and Egg Briks": "Брики с тунцом и яйцом",
    "Tuna Nicoise": "Салат нисуаз с тунцом",
    "Turkey Meatloaf": "Мясной хлеб из индейки",
    "Vegetable Shepherd's Pie": "Овощной пастуший пирог",
    "Vegetarian Casserole": "Овощная запеканка",
    "Venetian Duck Ragu": "Утиный рагу по-венециански",
    "Vietnamese Grilled Pork (bun-thit-nuong)": "Вьетнамская свинина на гриле",
    "Yaki Udon": "Яки удон",
    "Locro": "Локро",
    "Turkey Bánh mì": "Бань ми с индейкой",
    "Poutine": "Путин",
    "Mutabbaq": "Мутаббак",
    "Chilean Empanada": "Чилийская эмпанада",
    "Shakshouka": "Шакшука",
    "Shakshuka Feta Cheese": "Шакшука с фетой",
    "Mediterranean Pasta Salad": "Средиземноморский салат с пастой",
    "Rigatoni with fennel sausage sauce": "Ригатони с колбасками и фенхелем",
    "Fettuccine Alfredo": "Фетучини Альфредо",
    "Fettucine alfredo": "Фетучини Альфредо",
    "Spicy Arrabiata Penne": "Пенне арраббиата",
    "Pilchard puttanesca": "Путтанеска с сардинами",
    "Pizza Express Margherita": "Пицца маргарита",
    "Potato Gratin with Chicken": "Гратен с курицей и картофелем",
    "Vegan Lasagna": "Веганская лазанья",
    "Lamb Pilaf (Plov)": "Плов",
    "Fish Soup (Ukha)": "Уха",
    "Potato Salad (Olivier Salad)": "Оливье",
    "Rosol (Polish Chicken Soup)": "Росолу — куриный бульон",
    "Polish patties (kotlety)": "Котлеты",
    "Golabki (cabbage roll)": "Голубцы",
    "Cucumber & fennel salad": "Салат с огурцом и фенхелем",
    "Quick salt & pepper squid": "Кальмар с солью и перцем",
    "Fainá": "Фаина",
    "Vegan banh mi": "Веганский бань ми",
    "Vietnamese veg parcels": "Вьетнамские овощные роллы",
    "Khmer Banh Xeo – Cambodian Savory Pancake": "Бань зео",
    "Sukuma Wiki": "Сукума вики",
    "Arepa": "Арепа",
    "Black Beans Hotpot": "Рагу из чёрной фасоли",
    "Curried Spinach from Botswana": "Шпинат карри",
    "Pollo en Salsa": "Курица в соусе",
    "Yemeni Lahsa (Elite Shakshuka)": "Лахса",
    "kabse": "Кабса",
    "Syrian Spaghetti": "Сирийская паста",
    "Hummus": "Хумус",
    "Beetroot latkes": "Свекольные оладьи",
    "Sauerkraut pierogii": "Вареники с капустой",
    "Tangy cabbage slaw": "Капустный салат",
    "Eggplant Adobo": "Баклажан адобо",
    "Mantu Afghan Dumpling": "Манту",
    "Belgian Stoemp": "Стёмп",
    "Fresh sardines": "Сардины",
}

SKIP_NAMES = {
    "big mac", "chick-fil-a sandwich", "mcdonald",
    "fettucine alfredo",
    "borsch",
    "strawberries romanoff",
    "budino di ricotta",
    "cream cheese tart",
    "cassava pizza",
    "dominican bakes",
    "grits",
    "jajek",
    "lao som pak pickled cabbage",
    "macaroni pudding",
    "mango chow",
    "torrijas",
    "red onion pickle",
    "beetroot & red cabbage sauerkraut",
    "griddled flatbreads",
    "jamaican cornmeal porridge",
    "lasagna sandwiches",
    "creamy aji green sauce",
    "dutch poffertjes (mini pancakes)",
    "breakfast potatoes",
    "smoked aubergine puree",
    "smoked aubergine purée",
    "algerian carrots",
    "oatmeal pancakes",
    "home-made mandazi",
}

def normalize_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

PREFERRED = {normalize_key(k) for k in NAME}
ICONIC = {
    normalize_key(s)
    for s in [
        "Beef Wellington",
        "Coq au vin",
        "Beef stroganoff",
        "Beef Bourguignon",
        "Pad Thai",
        "Paella",
        "Spaghetti alla Carbonara",
        "Spaghetti Bolognese",
        "Lasagne",
        "Beef pho",
        "Beef Rendang",
        "Chicken Karaage",
        "Chicken Shawarma with homemade garlic herb yoghurt sauce",
        "Shakshuka",
        "Chakchouka",
        "Moussaka",
        "Lamb Tagine",
        "Ratatouille",
        "Nasi lemak",
        "Ayam Percik",
        "Honey Teriyaki Salmon",
        "Japanese Katsudon",
        "Yaki Udon",
        "Thai Green Curry",
        "Tandoori chicken",
        "Dal fry",
        "Chicken Handi",
        "Bigos (Hunters Stew)",
        "Beetroot Soup (Borscht)",
        "Cabbage Soup (Shchi)",
        "Adana kebab",
        "Brown Stew Chicken",
        "Cevapi Sausages",
        "Asado",
        "Ribollita",
        "Osso Buco alla Milanese",
        "Seafood fideuà",
        "Spanish tortilla",
        "Penne with vodka",
        "Katsu Chicken curry",
        "Tonkatsu pork",
        "Mulukhiyah",
        "Keleya Zaara",
        "Leblebi Soup",
        "Matar Paneer",
        "Baingan Bharta",
        "Saltfish and Ackee",
        "Callaloo Jamaican Style",
        "Portuguese fish stew (Caldeirada de peixe)",
        "Snert (Split Pea Soup)",
        "Bitterballen (Dutch meatballs)",
        "Clam chowder",
        "Beef Brisket Pot Roast",
        "Chicken Enchilada Casserole",
        "Cajun spiced fish tacos",
        "Chickpea Fajitas",
        "Braised Beef Chilli",
        "Chicken Couscous",
        "Chicken Basquaise",
        "Bahia-style Moqueca prawn stew",
        "Black bean & meat stew - feijoada",
        "Arroz al horno (baked rice)",
        "Air fryer patatas bravas",
        "Chilli prawn linguine",
        "Drunken noodles (pad kee mao)",
        "Szechuan Beef",
        "Beef Lo Mein",
        "Chinese Orange Chicken",
        "Chicken Fried Rice",
        "Baba Ghanoush",
        "Cacik",
        "Aubergine & hummus grills",
    ]
}

WORD = {
    "chicken": "куриный", "beef": "говяжий", "pork": "свиной", "lamb": "бараний",
    "salmon": "лосось", "prawn": "креветки", "prawns": "креветки",
    "shrimp": "креветки", "fish": "рыбный", "soup": "суп", "salad": "салат",
    "stew": "рагу", "curry": "карри", "rice": "рис", "noodles": "лапша",
    "pasta": "паста", "pie": "пирог", "cake": "торт", "bread": "хлеб",
    "grilled": "на гриле", "fried": "жареный", "baked": "запечённый",
    "roasted": "запечённый", "spicy": "острый", "sweet": "сладкий",
    "sour": "кислый", "stuffed": "фаршированный", "with": "с",
    "and": "и", "in": "в", "of": "из",
}


def load_meals():
    meals = {}
    if not DUMP.exists():
        raise SystemExit(f"Нет дампа TheMealDB: {DUMP}")
    for path in sorted(DUMP.glob("*.json")):
        data = json.loads(path.read_text())
        for meal in data.get("meals") or []:
            meals[meal["idMeal"]] = meal
    return list(meals.values())


def ingredients_of(meal):
    ings, measures = [], []
    for i in range(1, 21):
        name = (meal.get(f"strIngredient{i}") or "").strip()
        measure = (meal.get(f"strMeasure{i}") or "").strip()
        if name:
            ings.append(name)
            measures.append(measure)
    return ings, measures


def steps_of(meal):
    raw = (meal.get("strInstructions") or "").strip()
    if not raw:
        return []
    parts = re.split(r"\r?\n+", raw)
    steps = [re.sub(r"^\s*(step\s*\d+[:.)-]?\s*)", "", p, flags=re.I).strip() for p in parts]
    return [s for s in steps if s and s.lower() not in {"step", "steps"}]


def ru_ing(name: str) -> str:
    key = name.strip().lower()
    if key in ING:
        return ING[key]
    # longest prefix
    best = None
    for en, ru in ING.items():
        if en in key:
            if best is None or len(en) > len(best[0]):
                best = (en, ru)
    return best[1] if best else name.strip()


def allergens_of(ings: list[str]) -> list[str]:
    blob = " ".join(ings).lower()
    found = []
    rules = [
        ("глютен", ["flour", "bread", "pasta", "spaghetti", "noodle", "wheat", "bun", "pastry", "breadcrumb", "soy sauce"]),
        ("молоко", ["milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "parmesan", "mozzarella", "cheddar", "feta", "brie", "ghee"]),
        ("яйца", ["egg", "mayonnaise", "mayo"]),
        ("рыба", ["fish", "salmon", "tuna", "cod", "haddock", "anchovy", "sardine"]),
        ("моллюски", ["shrimp", "prawn", "crab", "lobster", "mussel", "clam", "oyster", "squid", "calamari", "conch"]),
        ("орехи", ["almond", "walnut", "cashew", "pistachio", "pecan", "hazelnut", "pine nut"]),
        ("арахис", ["peanut"]),
        ("соя", ["soy", "tofu", "soya"]),
        ("кунжут", ["sesame", "tahini"]),
        ("горчица", ["mustard"]),
        ("сельдерей", ["celery"]),
    ]
    for label, keys in rules:
        if any(k in blob for k in keys):
            found.append(label)
    return found


def translate_name(original: str) -> str:
    if original in NAME:
        return NAME[original]
    nk = normalize_key(original)
    for k, v in NAME.items():
        if normalize_key(k) == nk:
            return v
    words = re.findall(r"[A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+", original)
    out = []
    for w in words:
        low = w.lower()
        if low in WORD:
            out.append(WORD[low])
        else:
            out.append(w)
    candidate = "".join(out).strip()
    if candidate.lower() == original.lower():
        return original
    return candidate[0].upper() + candidate[1:] if candidate else original


def cuisine_of(meal) -> str:
    raw = meal.get("strArea") or meal.get("strCountry") or "Unknown"
    return CUISINE.get(raw, raw if raw.endswith("ая") else "Международная")


def estimate(ings, steps, ings_en):
    n_ing, n_step = len(ings), max(len(steps), 1)
    letters = sum(len(s) for s in steps)
    if n_ing <= 7 and n_step <= 6 and letters < 900:
        diff = "easy"
        minutes = 30
    elif n_ing >= 14 or n_step >= 12 or letters > 2200:
        diff = "hard"
        minutes = 90
    else:
        diff = "medium"
        minutes = 50
    blob = " ".join(ings_en).lower()
    if any(x in blob for x in ["lobster", "fillet steak", "beef wellington", "saffron", "brisket"]):
        budget = "high"
    elif any(x in blob for x in ["lentil", "chickpea", "bean", "cabbage", "potato", "pasta", "rice", "egg"]):
        budget = "low"
    else:
        budget = "medium"
    if any(x in blob for x in ["prawn", "shrimp", "salmon", "lamb", "beef"]):
        if budget == "low":
            budget = "medium"
    return diff, minutes, budget


def description_of(name, cuisine, categories, ings, steps):
    cats = ", ".join(categories)
    top = ", ".join(ings[:5])
    extra = ""
    if steps:
        extra = " Рецепт — пошагово из источника."
    return f"{name} — блюдо {cuisine.lower()} кухни ({cats.lower()}). В составе: {top}.{extra}"


def classify_style(meal, ings_en, cat_en: str):
    dish = {
        "originalIngredients": ings_en,
        "ingredients": [],
        "originalName": meal.get("strMeal") or "",
        "canonicalName": meal.get("strMeal") or "",
        "categories": [CATEGORY.get(cat_en, cat_en or "Разное")],
    }
    protein = protein_from_ings(dish)
    style = style_from_ings(dish, protein)
    return style, protein


def quality_ok(meal, ings, steps) -> bool:
    if not meal.get("strMeal") or not meal.get("strMealThumb"):
        return False
    if len(ings) < 3 or len(steps) < 1:
        return False
    name = meal["strMeal"].lower()
    if any(s in name for s in SKIP_NAMES):
        return False
    if len(meal["strMeal"]) > 90:
        return False
    if not re.search(r"[А-Яа-яЁё]", translate_name(meal["strMeal"])):
        return False
    return True


CAT_CAP = {
    "Beef": 8,
    "Chicken": 42,
    "Pork": 28,
    "Lamb": 4,
    "Dessert": 0,
    "Side": 18,
    "Breakfast": 6,
    "Goat": 1,
    "Seafood": 14,
    "Vegetarian": 40,
    "Pasta": 18,
    "Vegan": 10,
    "Starter": 12,
    "Miscellaneous": 14,
}

AREA_CAP = {
    "Italian": 28,
    "Italy": 28,
    "Russian": 20,
    "Russia": 20,
    "Ukrainian": 10,
    "Ukraine": 10,
}
DEFAULT_AREA_CAP = 7
AREA_BOOST = {
    "Italian": 18,
    "Italy": 18,
    "Russian": 22,
    "Russia": 22,
    "Ukrainian": 10,
    "Ukraine": 10,
}
PRIORITY_AREAS = {"Italian", "Italy", "Russian", "Russia", "Ukrainian", "Ukraine"}


def area_of(meal) -> str:
    return meal.get("strArea") or meal.get("strCountry") or "Unknown"


_PREV_IDS: set[str] | None = None


def previous_source_ids() -> set[str]:
    global _PREV_IDS
    if _PREV_IDS is not None:
        return _PREV_IDS
    if not OUT.exists():
        _PREV_IDS = set()
        return _PREV_IDS
    try:
        old = json.loads(OUT.read_text())
    except json.JSONDecodeError:
        _PREV_IDS = set()
        return _PREV_IDS
    _PREV_IDS = {
        d.get("sourceId")
        for d in old.get("dishes", [])
        if d.get("source") == "themealdb" and d.get("sourceId") and not d.get("isNew")
    }
    return _PREV_IDS


def score_row(meal):
    ings, _ = ingredients_of(meal)
    steps = steps_of(meal)
    cat = meal.get("strCategory") or "Miscellaneous"
    area = area_of(meal)
    key = normalize_key(meal["strMeal"])
    pref = 16 if key in ICONIC else 8 if key in PREFERRED else 0
    pref += AREA_BOOST.get(area, 0)
    diff, _, _ = estimate(ings, steps, ings)
    if diff == "easy":
        pref += 7
    elif diff == "medium":
        pref += 2
    else:
        pref -= 4
    style, protein = classify_style(meal, ings, cat)
    if style == "healthy":
        pref += 6
    if cat in {"Vegetarian", "Vegan", "Pasta", "Chicken", "Side", "Starter"}:
        pref += 2
    if protein in {"chicken", "pork"}:
        pref += 4
    elif protein == "veg":
        pref += 3
    photo = 1 if meal.get("strMealThumb") else 0
    src = 1 if meal.get("strSource") else 0
    return pref + photo + src, cat, area, meal, diff, style


def pick(meals, target=220):
    scored = []
    for meal in meals:
        ings, _ = ingredients_of(meal)
        steps = steps_of(meal)
        if not quality_ok(meal, ings, steps):
            continue
        if (meal.get("strCategory") or "") == "Dessert":
            continue
        scored.append(score_row(meal))
    scored.sort(key=lambda x: -x[0])

    picked = []
    used: set[str] = set()
    cat_n: dict[str, int] = defaultdict(int)
    cui_n: dict[str, int] = defaultdict(int)

    def cap_for(area: str) -> int:
        return AREA_CAP.get(area, DEFAULT_AREA_CAP)

    def accept(cat, area, meal, *, ignore_cuisine=False, ignore_cat=False):
        if meal["idMeal"] in used:
            return False
        if not ignore_cat and cat_n[cat] >= CAT_CAP.get(cat, 14):
            return False
        if not ignore_cuisine and cui_n[area] >= cap_for(area):
            return False
        picked.append(meal)
        used.add(meal["idMeal"])
        cat_n[cat] += 1
        cui_n[area] += 1
        return True

    by_id = {row[3]["idMeal"]: row for row in scored}
    for sid in previous_source_ids():
        row = by_id.get(sid)
        if row:
            _, cat, area, meal, _, _ = row
            accept(cat, area, meal, ignore_cuisine=True)

    for _, cat, area, meal, _, _ in scored:
        if area in PRIORITY_AREAS:
            accept(cat, area, meal, ignore_cuisine=True, ignore_cat=True)

    for _, cat, area, meal, diff, style in scored:
        if len(picked) >= target:
            break
        if diff == "easy" and style == "healthy":
            accept(cat, area, meal)

    for _, cat, area, meal, _, _ in scored:
        if len(picked) >= target:
            break
        accept(cat, area, meal)
    return picked[:target]


def convert(meal):
    ings_en, measures = ingredients_of(meal)
    steps = steps_of(meal)
    ings_ru = [ru_ing(x) for x in ings_en]
    original = meal["strMeal"].strip()
    name = translate_name(original)
    cuisine = cuisine_of(meal)
    cat_en = meal.get("strCategory") or ""
    cat = CATEGORY.get(cat_en, cat_en or "Разное")
    cats = [cat]
    blob = " ".join(ings_en).lower()
    if "chickpea" in blob or "lentil" in blob or "bean" in blob:
        if cat not in {"Говядина", "Курица", "Свинина", "Баранина", "Морепродукты"}:
            if "Вегетарианское" not in cats:
                cats.append("Вегетарианское")
    diff, minutes, budget = estimate(ings_ru, steps, ings_en)
    style, protein = classify_style(meal, ings_en, cat_en)
    dish_id = f"themealdb_{meal['idMeal']}"
    recipe_id = f"recipe_{meal['idMeal']}"
    source_url = (meal.get("strSource") or "").strip() or f"https://www.themealdb.com/meal/{meal['idMeal']}"
    thumb = meal.get("strMealThumb") or ""
    dish = {
        "id": dish_id,
        "canonicalName": name,
        "originalName": original,
        "aliases": list({original, name}),
        "cuisine": cuisine,
        "categories": cats,
        "description": description_of(name, cuisine, cats, ings_ru, steps),
        "imageUrl": thumb,
        "ingredients": ings_ru,
        "originalIngredients": ings_en,
        "allergens": allergens_of(ings_en),
        "preparationMinutes": minutes,
        "difficulty": diff,
        "budget": budget,
        "style": style,
        "protein": protein,
        "isNew": meal["idMeal"] not in previous_source_ids(),
        "recipeIds": [recipe_id],
        "source": "themealdb",
        "sourceId": meal["idMeal"],
        "sourceUrl": source_url,
        "imageLicense": "Изображение с TheMealDB; хранится у источника, не копируется в приложение",
        "attribution": "TheMealDB (https://www.themealdb.com). Бесплатный каталог для личных проектов; фотографии и рецепты принадлежат своим авторам.",
    }
    recipe = {
        "id": recipe_id,
        "dishId": dish_id,
        "title": name,
        "ingredients": ings_ru,
        "measures": measures,
        "instructions": steps,
        "sourceUrl": source_url,
        "language": "en",
    }
    return dish, recipe


def main():
    meals = load_meals()
    prev = previous_source_ids()
    picked = pick(meals)
    dishes, recipes = [], []
    for meal in picked:
        d, r = convert(meal)
        d["isNew"] = meal["idMeal"] not in prev
        dishes.append(d)
        recipes.append(r)
    local_dishes, local_recipes = local_catalog()
    for d in local_dishes:
        d["allergens"] = allergens_of(d.get("originalIngredients") or [])
        d["isNew"] = True
    dishes.extend(local_dishes)
    recipes.extend(local_recipes)
    dishes.sort(key=lambda d: (d["cuisine"], d["canonicalName"]))
    catalog = {
        "version": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "themealdb+local",
        "attribution": "Каталог собран из TheMealDB и домашних карточек. Подбор блюд на русском; шаги TheMealDB — на языке источника.",
        "dishes": dishes,
        "recipes": recipes,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    cuisines = sorted({d["cuisine"] for d in dishes})
    proteins = Counter(d["protein"] for d in dishes)
    styles = Counter(d["style"] for d in dishes)
    print(f"wrote {OUT} dishes={len(dishes)} cuisines={len(cuisines)}")
    print("proteins:", dict(proteins))
    print("styles:", dict(styles))
    print("cuisines:", ", ".join(cuisines))
    unmapped = [d["originalName"] for d in dishes if d["canonicalName"] == d["originalName"]]
    print("unmapped names", len(unmapped))
    for n in unmapped[:25]:
        print(" -", n)


if __name__ == "__main__":
    main()
