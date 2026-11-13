"""Load USDA FoodData Central nutrients (per 100 g) for INDB ingredients.

Reads data/usda_mapping.csv (from usda_match.py): only status auto (exact FDC id) and override (reviewed)
rows are loaded. Values go into food_nutrient with source_id = USDA; links go into food_external_ref.
Run standalone (`python usda_load.py`) or via load.py.
"""
import json
from collections import defaultdict
from pathlib import Path

import pandas as pd
from psycopg2.extras import execute_values

ROOT = Path(__file__).parent
USDA = ROOT / "data" / "raw" / "usda"
MAPPING = ROOT / "data" / "usda_mapping.csv"

# INDB nutrient code -> USDA nutrient numbers (summed when several). Units are converted to the INDB unit.
NUTRIENT_MAP = {
    "energy_kcal": ["208"], "energy_kj": ["268"], "protein_g": ["203"], "fat_g": ["204"], "carb_g": ["205"],
    "fibre_g": ["291"], "sfa_mg": ["606"], "mufa_mg": ["645"], "pufa_mg": ["646"], "cholesterol_mg": ["601"],
    "calcium_mg": ["301"], "phosphorus_mg": ["305"], "magnesium_mg": ["304"], "sodium_mg": ["307"],
    "potassium_mg": ["306"], "iron_mg": ["303"], "copper_mg": ["312"], "selenium_ug": ["317"],
    "manganese_mg": ["315"], "zinc_mg": ["309"], "vita_ug": ["320"], "vite_mg": ["323"], "vitd2_ug": ["325"],
    "vitd3_ug": ["326"], "vitk1_ug": ["430"], "vitk2_ug": ["428"], "folate_ug": ["417"], "vitb1_mg": ["404"],
    "vitb2_mg": ["405"], "vitb3_mg": ["406"], "vitb5_mg": ["410"], "vitb6_mg": ["415"], "vitb7_ug": ["416"],
    "vitb9_ug": ["431"], "vitc_mg": ["401"],
    # beta-carotene, alpha-carotene, beta-cryptoxanthin, lycopene, lutein + zeaxanthin
    "carotenoids_ug": ["321", "322", "334", "337", "338"],
}
# Not available in USDA SR Legacy: freesugar_g (USDA has total sugars only), chromium_mg, molybdenum_mg.
TO_BASE = {"g": 1.0, "mg": 1e-3, "ug": 1e-6, "µg": 1e-6, "kcal": 1.0, "kj": 1.0}


def convert(amount: float, unit: str, target: str) -> float:
    unit, target = unit.lower(), target.lower()
    if unit == target or (unit in ("kcal", "kj") and target in ("kcal", "kj")):
        return amount
    return amount * TO_BASE[unit] / TO_BASE[target]


def sr_legacy_values(fdc_ids: set[int]) -> dict[int, dict[str, tuple[float, str]]]:
    nut = pd.read_csv(USDA / "sr_legacy" / "nutrient.csv", dtype={"nutrient_nbr": str})
    nut["nutrient_nbr"] = nut["nutrient_nbr"].str.replace(r"\.0$", "", regex=True)
    meta = {int(r.id): (r.nutrient_nbr, r.unit_name) for r in nut.itertuples()}
    fn = pd.read_csv(USDA / "sr_legacy" / "food_nutrient.csv", usecols=["fdc_id", "nutrient_id", "amount"])
    fn = fn[fn["fdc_id"].isin(fdc_ids)]
    out = defaultdict(dict)
    for r in fn.itertuples():
        nbr, unit = meta.get(int(r.nutrient_id), (None, None))
        if nbr:
            out[int(r.fdc_id)][nbr] = (float(r.amount), unit)
    return out


def api_values() -> dict[int, dict[str, tuple[float, str]]]:
    out = defaultdict(dict)
    for food in json.loads((USDA / "api_foods.json").read_text(encoding="utf-8")):
        for fn in food.get("foodNutrients", []):
            n, amt = fn.get("nutrient", {}), fn.get("amount")
            if n.get("number") and amt is not None:
                out[int(food["fdcId"])][str(n["number"])] = (float(amt), n.get("unitName", ""))
    return out


def apply_usda(cur) -> dict[str, int]:
    mapping = pd.read_csv(MAPPING)
    mapping = mapping[mapping["status"].isin(["auto", "override"]) & mapping["fdc_id"].notna()]
    mapping["fdc_id"] = mapping["fdc_id"].astype(int)

    cur.execute(
        "INSERT INTO source (name, license, url, citation) VALUES (%s,%s,%s,%s) "
        "ON CONFLICT (name) DO UPDATE SET license = EXCLUDED.license RETURNING id",
        ("USDA FoodData Central", "CC0 1.0 (public domain)", "https://fdc.nal.usda.gov/",
         "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central (SR Legacy 2018-04 "
         "and API records)."))
    source_id = cur.fetchone()[0]
    cur.execute("DELETE FROM food_nutrient WHERE source_id = %s", (source_id,))
    cur.execute("DELETE FROM food_external_ref WHERE source_id = %s", (source_id,))

    cur.execute("SELECT code, id FROM food WHERE food_type = 'ingredient'")
    food_id = dict(cur.fetchall())
    cur.execute("SELECT code, id, unit FROM nutrient")
    nutrients = {code: (nid, unit) for code, nid, unit in cur.fetchall()}

    values = sr_legacy_values(set(mapping["fdc_id"]))
    for fid, vals in api_values().items():
        values.setdefault(fid, vals)

    fn_rows, ref_rows, missing = [], [], []
    for r in mapping.itertuples():
        fid = food_id.get(r.food_code)
        vals = values.get(r.fdc_id)
        if fid is None or not vals:
            missing.append(r.food_code)
            continue
        note = r.note if isinstance(r.note, str) else None
        ref_rows.append((fid, source_id, str(r.fdc_id), r.usda_description, r.match, note))
        for code, numbers in NUTRIENT_MAP.items():
            if code not in nutrients:
                continue
            nid, unit = nutrients[code]
            parts = [convert(*vals[n], unit) for n in numbers if n in vals]
            if not parts and code == "energy_kj" and "208" in vals:          # derive kJ from kcal
                parts = [vals["208"][0] * 4.184]
            if parts:
                fn_rows.append((fid, nid, round(sum(parts), 6), None, source_id))

    execute_values(cur, "INSERT INTO food_external_ref (food_id, source_id, external_id, description, match, note) "
                        "VALUES %s", ref_rows)
    execute_values(cur, "INSERT INTO food_nutrient (food_id, nutrient_id, per_100g, per_serving, source_id) VALUES %s",
                   fn_rows)
    if missing:
        print("USDA: no values for", missing)
    return {"ingredients_linked": len(ref_rows), "nutrient_values": len(fn_rows)}


if __name__ == "__main__":
    from load import connect

    with connect() as conn, conn.cursor() as cur:
        cur.execute((ROOT / "schema.sql").read_text(encoding="utf-8"))
        print(apply_usda(cur))
