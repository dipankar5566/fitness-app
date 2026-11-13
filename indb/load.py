"""Load INDB spreadsheets (data/raw/) into PostgreSQL.

Connection uses standard libpq env vars: PGHOST (default localhost), PGPORT, PGUSER (default postgres),
PGPASSWORD, PGDATABASE (default indb). Re-runnable: truncates and reloads all data tables.
"""
import json
import math
import os
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from aliases import apply_aliases
from usda_load import apply_usda

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
SERVING_PREFIX = "unit_serving_"
NUTRIENT_NAMES = {
    "energy_kj": "Energy", "energy_kcal": "Energy", "carb_g": "Carbohydrate", "protein_g": "Protein",
    "fat_g": "Total fat", "freesugar_g": "Free sugar", "fibre_g": "Dietary fibre",
    "sfa_mg": "Saturated fatty acids", "mufa_mg": "Monounsaturated fatty acids",
    "pufa_mg": "Polyunsaturated fatty acids", "cholesterol_mg": "Cholesterol", "calcium_mg": "Calcium",
    "phosphorus_mg": "Phosphorus", "magnesium_mg": "Magnesium", "sodium_mg": "Sodium",
    "potassium_mg": "Potassium", "iron_mg": "Iron", "copper_mg": "Copper", "selenium_ug": "Selenium",
    "chromium_mg": "Chromium", "manganese_mg": "Manganese", "molybdenum_mg": "Molybdenum", "zinc_mg": "Zinc",
    "vita_ug": "Vitamin A", "vite_mg": "Vitamin E", "vitd2_ug": "Vitamin D2", "vitd3_ug": "Vitamin D3",
    "vitk1_ug": "Vitamin K1", "vitk2_ug": "Vitamin K2", "folate_ug": "Folate", "vitb1_mg": "Thiamine (B1)",
    "vitb2_mg": "Riboflavin (B2)", "vitb3_mg": "Niacin (B3)", "vitb5_mg": "Pantothenic acid (B5)",
    "vitb6_mg": "Vitamin B6", "vitb7_ug": "Biotin (B7)", "vitb9_ug": "Folic acid (B9)", "vitc_mg": "Vitamin C",
    "carotenoids_ug": "Total carotenoids",
}
CITATION = ("Vijayakumar A, et al. Development of an Indian Food Composition Database. "
            "Current Developments in Nutrition, 2024. Indian Nutrient Databank (INDB), Anuvaad Solutions.")


def num(v):
    """Convert spreadsheet values to float, mapping NaN/blank/non-numeric to None."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def text(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else str(v).strip()


def connect():
    return psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        user=os.environ.get("PGUSER", "postgres"),
        dbname=os.environ.get("PGDATABASE", "indb"),
    )


def main() -> None:
    indb = pd.read_excel(RAW / "INDB.xlsx")
    recipes = pd.read_excel(RAW / "recipes.xlsx")
    names = pd.read_excel(RAW / "recipes_names.xlsx")
    manifest = json.loads((RAW / "manifest.json").read_text())

    nutrient_codes = [c for c in indb.columns if c in NUTRIENT_NAMES]

    with connect() as conn, conn.cursor() as cur:
        cur.execute((ROOT / "schema.sql").read_text(encoding="utf-8"))
        cur.execute("TRUNCATE food_external_ref, recipe_ingredient, serving_measure, food_nutrient, food_name, food, "
                    "nutrient, source "
                    "RESTART IDENTITY CASCADE")

        cur.execute(
            "INSERT INTO source (name, license, url, citation, retrieved_at, file_sha256) "
            "VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
            ("INDB", "CC BY 4.0", manifest["repo"], CITATION, manifest["retrieved_at"],
             json.dumps({k: v["sha256"] for k, v in manifest["files"].items()})),
        )
        source_id = cur.fetchone()[0]

        rows = execute_values(
            cur, "INSERT INTO nutrient (code, name, unit) VALUES %s RETURNING code, id",
            [(c, NUTRIENT_NAMES[c], c.rsplit("_", 1)[1]) for c in nutrient_codes], fetch=True)
        nutrient_id = dict(rows)

        # Recipes
        rows = execute_values(
            cur, "INSERT INTO food (code, name, food_type, category, source_id) VALUES %s RETURNING code, id",
            [(text(r.food_code), text(r.food_name), "recipe", text(r.primarysource), source_id)
             for r in indb.itertuples()], fetch=True)
        food_id = dict(rows)

        # Ingredients referenced by recipes (no nutrient values in the open repo)
        ingredients = recipes[["food_code", "food_name"]].dropna().drop_duplicates("food_code")
        ingredients = ingredients[~ingredients["food_code"].isin(food_id.keys())]
        rows = execute_values(
            cur, "INSERT INTO food (code, name, food_type, source_id) VALUES %s RETURNING code, id",
            [(text(r.food_code), text(r.food_name), "ingredient", source_id) for r in ingredients.itertuples()],
            fetch=True)
        food_id.update(dict(rows))

        # Names: standardised name (primary) + original recipe name as alias
        name_rows = {(food_id[text(r.food_code)], text(r.food_name)): True for r in indb.itertuples()}
        for r in ingredients.itertuples():
            name_rows.setdefault((food_id[text(r.food_code)], text(r.food_name)), True)
        for r in names.itertuples():
            code, orig = text(r.recipe_code), text(r.recipe_name_org)
            if code in food_id and orig:
                name_rows.setdefault((food_id[code], orig), False)
        execute_values(cur, "INSERT INTO food_name (food_id, name, is_primary) VALUES %s",
                       [(f, n, p) for (f, n), p in name_rows.items() if n])
        print("food_name by origin", apply_aliases(cur))

        # Nutrient values + derived serving weight
        fn_rows, sm_rows = [], []
        for r in indb.to_dict("records"):
            fid = food_id[text(r["food_code"])]
            for c in nutrient_codes:
                p100, pserv = num(r.get(c)), num(r.get(SERVING_PREFIX + c))
                if p100 is not None or pserv is not None:
                    fn_rows.append((fid, nutrient_id[c], p100, pserv, source_id))
            unit = text(r.get("servings_unit"))
            kcal, kcal_s = num(r.get("energy_kcal")), num(r.get(SERVING_PREFIX + "energy_kcal"))
            if unit:
                grams = kcal_s / kcal * 100 if kcal and kcal_s is not None else None
                sm_rows.append((fid, unit, grams))
        execute_values(cur, "INSERT INTO food_nutrient (food_id, nutrient_id, per_100g, per_serving, source_id) VALUES %s",
                       fn_rows)
        execute_values(cur, "INSERT INTO serving_measure (food_id, name, grams) VALUES %s", sm_rows)

        # Recipe ingredient lines
        ri_rows, pos = [], {}
        for r in recipes.itertuples():
            rid = food_id.get(text(r.recipe_code))
            if rid is None:
                continue
            pos[rid] = pos.get(rid, 0) + 1
            ri_rows.append((rid, pos[rid], food_id.get(text(r.food_code)),
                            text(r.ingredient_name_org) or text(r.food_name) or "?", num(r.amount), text(r.unit)))
        execute_values(cur, "INSERT INTO recipe_ingredient VALUES %s", ri_rows)

        print("USDA ingredients", apply_usda(cur))

        for t in ("source", "nutrient", "food", "food_name", "food_nutrient", "serving_measure", "recipe_ingredient",
                  "food_external_ref"):
            cur.execute(f"SELECT count(*) FROM {t}")
            print(f"{t:18} {cur.fetchone()[0]}")
        cur.execute("SELECT food_type, count(*) FROM food GROUP BY 1 ORDER BY 1")
        print("food by type      ", dict(cur.fetchall()))


if __name__ == "__main__":
    main()
