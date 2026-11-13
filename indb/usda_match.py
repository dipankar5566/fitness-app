"""Map INDB ingredients to USDA FoodData Central foods -> data/usda_mapping.csv.

- food_code_org 'US-<fdc_id>' : exact (INDB already used that USDA record)          method=exact_id
- everything else (IFCT / UK) : fuzzy match against SR Legacy after Indian->USDA term normalisation
  (fuzzy candidates kept only as suggestions for adding new overrides)
- data/usda_overrides.csv (food_code,usda_description,match,note) is the reviewed mapping for IFCT/UK items;
  blank description = no USDA equivalent. Fuzzy results are written as status=suggest and never loaded.
"""
import json
import re
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz, process

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
SR = RAW / "usda" / "sr_legacy"
OUT = ROOT / "data" / "usda_mapping.csv"
OVERRIDES = ROOT / "data" / "usda_overrides.csv"
AUTO, REVIEW = 80, 62

# Indian / British food terms -> USDA SR Legacy vocabulary (applied as regex replacements).
SYNONYMS = {
    r"bengal gram|chana|channa|chick ?pea": "chickpeas garbanzo",
    r"green gram|moong|mung": "mung beans",
    r"black gram|urad": "mungo beans",
    r"red gram|arhar|\btur\b|toor|pigeon ?pea": "pigeon peas",
    r"lentil|masoor": "lentils",
    r"\bdal\b|\bdhal\b": "split mature seeds",
    r"curd|dahi": "yogurt plain",
    r"ghee": "butter oil anhydrous",
    r"atta|whole wheat flour": "wheat flour whole-grain",
    r"maida|refined flour|white flour|plain flour": "wheat flour white all-purpose",
    r"besan|gram flour": "chickpea flour besan",
    r"semolina|suji|sooji|rava": "semolina",
    r"jaggery|\bgur\b": "sugars brown",
    r"brinjal|aubergine": "eggplant",
    r"lady'?s ?fingers?|bhindi": "okra",
    r"bottle gourd|lauki|ghiya": "gourd white-flowered calabash",
    r"bitter gourd|karela": "balsam-pear bitter gourd",
    r"coriander leaves|cilantro": "coriander cilantro leaves",
    r"capsicum": "peppers sweet green",
    r"french beans|green beans": "beans snap green",
    r"mutton|goat": "game meat goat",
    r"colocasia|arbi": "taro",
    r"drumstick": "drumstick pods horseradish-tree",
    r"spring onion": "onions spring scallions",
    r"cottage cheese|paneer": "cheese cottage",
    r"groundnut|peanut": "peanuts",
    r"gingelly|sesame|\btil\b": "seeds sesame",
    r"courgette": "squash summer zucchini",
    r"maize": "corn",
    r"prawn": "crustaceans shrimp",
    r"double cream": "cream fluid heavy whipping",
    r"single cream": "cream fluid light",
    r"icing sugar": "sugars powdered",
    r"caster sugar|white sugar|sugar, white": "sugars granulated",
    r"bicarbonate of soda|baking soda": "leavening agents baking soda",
    r"cornflour": "cornstarch",
    r"vegetable oil|refined oil|sunflower oil": "oil sunflower",
    r"mustard oil": "oil mustard",
    r"coconut oil": "oil coconut",
}


def normalise(name: str) -> str:
    s = re.sub(r"\([^)]*\)", " ", name.lower())          # drop scientific names / notes in brackets
    for pat, rep in SYNONYMS.items():
        s = re.sub(pat, rep, s)
    return re.sub(r"[^a-z0-9 ]+", " ", s).strip()


NOISE = re.compile(r"^(babyfood|snacks|candies|cereals ready-to-eat|puddings|cookies?|doughnuts|fast foods|"
                   r"restaurant|desserts|crackers|cake|pie|sweet potatoes, french|soup|sauce|spices, .*seasoning)",
                   re.I)
PROCESSED = re.compile(r"canned|frozen|cooked|boiled|fried|roasted|syrup|dried|dehydrated|baked|juice", re.I)


def rank_score(q: str, desc: str, norm_desc: str) -> float:
    """Blend of subset match and full-string match, with penalties for off-target product types."""
    score = 0.4 * fuzz.token_set_ratio(q, norm_desc) + 0.6 * fuzz.token_sort_ratio(q, norm_desc)
    if NOISE.match(desc) and not NOISE.match(q):
        score -= 20
    if re.search(r"[A-Z]{3,}", desc):                      # brand names in capitals
        score -= 10
    if "raw" in desc.lower() and not PROCESSED.search(q):
        score += 6
    if PROCESSED.search(desc) and not PROCESSED.search(q):
        score -= 6
    if desc.lower().split(",")[0].strip() in q:                # USDA head term appears in the query
        score += 8
    return score


def main() -> None:
    recipes = pd.read_excel(RAW / "recipes.xlsx")
    ing = recipes[["food_code", "food_name", "food_code_org"]].dropna(subset=["food_code"]).drop_duplicates("food_code")
    api = {f["fdcId"]: f["description"] for f in json.loads((RAW / "usda" / "api_foods.json").read_text("utf-8"))}
    food = pd.read_csv(SR / "food.csv")
    choices = {int(r.fdc_id): str(r.description) for r in food.itertuples()}
    norm_choices = {k: normalise(v) for k, v in choices.items()}
    by_desc = {v.lower(): k for k, v in choices.items()}
    overrides, unresolved = {}, []
    if OVERRIDES.exists():
        for r in pd.read_csv(OVERRIDES, dtype=str).fillna("").itertuples():
            desc = r.usda_description.strip()
            fid = None
            if desc:
                fid = by_desc.get(desc.lower())
                if fid is None:   # unique-ish prefix: take the shortest description starting with it
                    hits = sorted((v for v in choices.values() if v.lower().startswith(desc.lower())), key=len)
                    fid = by_desc[hits[0].lower()] if hits else None
                if fid is None:
                    unresolved.append((r.food_code, desc))
                    continue
            overrides[r.food_code.strip()] = (fid, r.match.strip(), r.note.strip())

    rows = []
    for r in ing.itertuples():
        code, name, org = str(r.food_code), str(r.food_name), str(r.food_code_org)
        origin = "US" if org.startswith("US-") else "UK" if org.startswith("UK-") else "IFCT"
        row = {"food_code": code, "food_name": name, "origin": origin, "fdc_id": None, "usda_description": None,
               "score": None, "method": None, "status": "unmatched", "match": None, "note": None,
               "alt1": None, "alt2": None}
        if origin != "US" and code in overrides:
            fid, match, note = overrides[code]
            row.update(method="override", match=match, note=note)
            if fid:
                row.update(fdc_id=fid, usda_description=choices[fid], score=100, status="override")
        elif origin == "US":
            fid = int(org[3:])
            row.update(fdc_id=fid, usda_description=api.get(fid), score=100, method="exact_id", status="auto",
                       match="exact", note="INDB used this USDA record")
        else:
            q = normalise(name)
            cands = process.extract(q, norm_choices, scorer=fuzz.token_set_ratio, limit=40)
            ranked = sorted(((rank_score(q, choices[fid], nc), fid) for nc, _, fid in cands), reverse=True)
            (score, fid), *alts = ranked[:3]
            alts = [(None, None, a[1]) for a in alts]
            # Fuzzy results are suggestions only (never loaded) - confirm them via usda_overrides.csv.
            status = "suggest" if score >= REVIEW else "unmatched"
            row.update(fdc_id=fid if status != "unmatched" else None, usda_description=choices[fid],
                       score=round(score), method="fuzzy", status=status,
                       alt1=f"{alts[0][2]}: {choices[alts[0][2]]}" if alts else None,
                       alt2=f"{alts[1][2]}: {choices[alts[1][2]]}" if len(alts) > 1 else None)
        rows.append(row)

    df = pd.DataFrame(rows).sort_values(["status", "score"], ascending=[True, False])
    df.to_csv(OUT, index=False, encoding="utf-8")
    print(df.groupby(["origin", "status"]).size().unstack(fill_value=0))
    if unresolved:
        print("override descriptions not found in SR Legacy:")
        for code, desc in unresolved:
            print(f"  {code}: {desc}")


if __name__ == "__main__":
    main()
