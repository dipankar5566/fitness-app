-- Fuzzy search (recipes first, then ingredients)
SELECT * FROM search_foods('dal');
SELECT * FROM search_foods('paneer', 10);

-- Macros per 100 g and per serving
SELECT code, name, serving_unit, serving_grams, kcal_100g, protein_100g, kcal_serving, protein_serving
FROM v_food_macros WHERE name ILIKE '%idli%';

-- Highest-protein recipes per serving
SELECT name, serving_unit, round(protein_serving, 1) AS protein_g, round(kcal_serving) AS kcal
FROM v_food_macros WHERE protein_serving IS NOT NULL ORDER BY protein_serving DESC LIMIT 20;

-- Full nutrient panel for one recipe
SELECT n.name, n.unit, round(fn.per_100g, 2) AS per_100g, round(fn.per_serving, 2) AS per_serving
FROM food f JOIN food_nutrient fn ON fn.food_id = f.id JOIN nutrient n ON n.id = fn.nutrient_id
WHERE f.code = 'ASC001' ORDER BY n.id;

-- Ingredients of a recipe
SELECT ri.position, ri.ingredient_name, ri.quantity, ri.unit, i.code AS ingredient_code
FROM recipe_ingredient ri JOIN food r ON r.id = ri.recipe_food_id LEFT JOIN food i ON i.id = ri.ingredient_food_id
WHERE r.code = 'ASC001' ORDER BY ri.position;

-- Log a portion: nutrients for N grams of a recipe
SELECT n.name, round(fn.per_100g * 150 / 100, 2) AS amount_for_150g, n.unit
FROM food f JOIN food_nutrient fn ON fn.food_id = f.id JOIN nutrient n ON n.id = fn.nutrient_id
WHERE f.code = 'ASC001' AND n.code IN ('energy_kcal','protein_g','fat_g','carb_g','fibre_g');

-- Search in Hindi / regional scripts (run from an app/driver or a UTF-8 psql session)
SELECT * FROM search_foods('इडली');
SELECT * FROM search_foods('சாம்பார்');

-- All names of a dish
SELECT fn.name, fn.lang, fn.origin FROM food_name fn JOIN food f ON f.id = fn.food_id
WHERE f.code = 'ASC144' ORDER BY fn.is_primary DESC, fn.lang;

-- Name coverage by language
SELECT lang, origin, count(*) FROM food_name GROUP BY 1, 2 ORDER BY 3 DESC;

-- Ingredient nutrients with provenance (USDA match quality)
SELECT f.name, r.description AS usda_food, r.match, n.code, round(fn.per_100g, 2) AS per_100g, n.unit
FROM food f JOIN food_external_ref r ON r.food_id = f.id
JOIN food_nutrient fn ON fn.food_id = f.id JOIN nutrient n ON n.id = fn.nutrient_id
WHERE f.code = 'B001' AND n.code IN ('energy_kcal','protein_g','fat_g','carb_g','fibre_g','iron_mg');

-- Approximate a recipe's kcal from its gram-weighted ingredients (only lines with unit 'g')
SELECT r.name, round(sum(ri.quantity * fn.per_100g / 100)) AS kcal_from_ingredients_g_lines
FROM recipe_ingredient ri JOIN food r ON r.id = ri.recipe_food_id
JOIN food_nutrient fn ON fn.food_id = ri.ingredient_food_id
JOIN nutrient n ON n.id = fn.nutrient_id AND n.code = 'energy_kcal'
WHERE r.code = 'ASC151' AND ri.unit = 'g' GROUP BY r.name;

-- Ingredients still missing nutrients
SELECT f.code, f.name FROM food f LEFT JOIN food_external_ref x ON x.food_id = f.id
WHERE f.food_type = 'ingredient' AND x.food_id IS NULL ORDER BY f.name;
