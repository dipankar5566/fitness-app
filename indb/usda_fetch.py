"""Fetch USDA FoodData Central data (public domain, CC0) into data/raw/usda/.

- Bulk CSV: SR Legacy (used for name matching of IFCT/UK-sourced ingredients). The current Foundation
  Foods CSV ships sample-level tables only (no food/food_nutrient), so it is not used.
- API: exact records for ingredients INDB took from USDA (food_code_org 'US-<fdc_id>'),
  which include Branded/FNDDS foods not in the bulk files. Uses FDC_API_KEY or DEMO_KEY.
"""
import io
import json
import os
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).parent
OUT = ROOT / "data" / "raw" / "usda"
BULK = {
    "sr_legacy": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip",
}
KEEP = ("food.csv", "food_nutrient.csv", "nutrient.csv")


def fetch_bulk() -> None:
    for name, url in BULK.items():
        dest = OUT / name
        if all((dest / f).exists() for f in KEEP):
            print(f"exists     {name}")
            continue
        dest.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=300) as resp:
            zf = zipfile.ZipFile(io.BytesIO(resp.read()))
        for member in zf.namelist():
            if Path(member).name in KEEP:
                (dest / Path(member).name).write_bytes(zf.read(member))
        print(f"downloaded {name}")


def fetch_api() -> None:
    dest = OUT / "api_foods.json"
    if dest.exists():
        print("exists     api_foods.json")
        return
    recipes = pd.read_excel(ROOT / "data" / "raw" / "recipes.xlsx")
    org = recipes["food_code_org"].dropna().astype(str)
    ids = sorted({int(o[3:]) for o in org if o.startswith("US-")})
    key = os.environ.get("FDC_API_KEY", "DEMO_KEY")
    foods = []
    for i in range(0, len(ids), 20):
        body = json.dumps({"fdcIds": ids[i:i + 20], "format": "full"}).encode()
        req = urllib.request.Request(f"https://api.nal.usda.gov/fdc/v1/foods?api_key={key}", data=body,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            foods += json.load(resp)
    dest.write_text(json.dumps(foods), encoding="utf-8")
    print(f"downloaded api_foods.json ({len(foods)}/{len(ids)} foods)")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    fetch_bulk()
    fetch_api()
