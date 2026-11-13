# INDB starter — Indian food database in PostgreSQL

Loads the **Indian Nutrient Databank (INDB)** — 1,014 commonly consumed Indian recipes with 39 nutrients
per 100 g and per serving, plus 10k recipe ingredient lines — into a local PostgreSQL database.

## Setup
```bash
pip install pandas openpyxl psycopg2-binary rapidfuzz
python download.py            # fetch spreadsheets into data/raw/ (+ manifest.json with SHA-256)
python inspect_sources.py     # optional: show sheets/headers
python usda_fetch.py          # USDA SR Legacy CSV + API records for INDB's US ingredients
python usda_match.py          # writes data/usda_mapping.csv from reviewed data/usda_overrides.csv
createdb -U postgres indb     # once
python load.py                # creates schema, (re)loads INDB, adds aliases + USDA ingredient nutrients
python aliases.py             # optional: re-apply aliases only (after editing data/curated_names.csv)
psql -U postgres -d indb -f queries.sql
```
Connection uses libpq env vars / pgpass: `PGHOST` (localhost), `PGPORT` (5432), `PGUSER` (postgres),
`PGDATABASE` (indb), password via `PGPASSWORD` or `%APPDATA%\postgresql\pgpass.conf`. No password is stored here.

## Tables
| table | contents |
|---|---|
| `source` | dataset, license, citation, retrieval date, file checksums |
| `food` | recipes (`food_type='recipe'`, code e.g. `ASC001`) and referenced ingredients (`'ingredient'`, IFCT/UK/US codes) |
| `food_name` | primary + alias names with `lang` and `origin` (see *Names* below); trigram index |
| `nutrient` | 39 nutrients (`energy_kcal`, `protein_g`, …) with units |
| `food_nutrient` | per-100 g (+ per-serving for recipes) values; `source_id` = INDB or USDA |
| `food_external_ref` | ingredient → USDA FDC id, description and match quality (`exact`/`close`/`proxy`) |
| `serving_measure` | default household serving (bowl, plate, piece…) with grams derived from INDB values |
| `recipe_ingredient` | ingredient lines with quantity + unit |
| `v_food_macros` (view) | kcal/protein/fat/carbs/fibre per 100 g and per serving |
| `search_foods(q, lim)` | fuzzy name search |

## Ingredient nutrients (USDA FoodData Central, CC0)
306 of 332 ingredients have per-100 g values from USDA (9,060 values):
- **53 exact by FDC id** — INDB itself took these ingredients from USDA (`food_code_org = US-<fdc_id>`), fetched via API.
- **253 via reviewed mapping** `data/usda_overrides.csv` (IFCT/UK-sourced items) matched to SR Legacy: 253 exact,
  35 close (e.g. split dal → whole pulse), 18 **proxy** (nearest substitute: rohu → carp, pomfret → butterfish,
  jaggery → brown sugar, green mango → mango). Check `food_external_ref.match` before relying on proxies.
- **26 have no USDA equivalent** and stay without values: paneer, khoa, ragi, poha, horse gram, amla, curry leaves,
  methi leaves, asafoetida, garam masala, tinda, sweet lime, wood apple, etc. → need IFCT 2017 (NIN permission).
- Not provided by USDA: free sugar, chromium, molybdenum. Carotenoids = sum of α/β-carotene, β-cryptoxanthin,
  lycopene, lutein+zeaxanthin. Fuzzy matches (`status=suggest` in usda_mapping.csv) are never loaded.
To change a mapping, edit `data/usda_overrides.csv` (exact SR Legacy description or unique prefix) and run
`python usda_match.py && python usda_load.py`.

## Names (`food_name.origin`)
| origin | lang | how |
|---|---|---|
| `indb` | en | INDB standard name (`is_primary`) + original recipe name |
| `indb_bracket` | `und-Latn` | romanised Indian-language names INDB puts in brackets — *Uble chawal*, *Suji ka halwa*, *Puliyodharai* (language not stated) |
| `indb_variant` | en | spelling variants written with `/` — *paratha / parantha*, *Chapati / Roti* |
| `indb_scientific` | la | Latin names on ingredients — *Prunus cerasus* |
| `curated` | hi, ta, te, kn, bn, mr, gu | native-script names from `data/curated_names.csv` (~65 common dishes) |

Curated names were written by hand for this starter — **have a native speaker review them before shipping**.
To add more, append `code,lang,name` rows to `data/curated_names.csv` and run `python aliases.py`.
Note: on Windows, pass non-Latin search text from an app/driver (psycopg2 etc.); Git Bash garbles it as a `psql` argument.

## Attribution (required — CC BY 4.0)
Data: Indian Nutrient Databank (INDB), Anuvaad Solutions —
Vijayakumar A, et al. *Development of an Indian Food Composition Database.* Current Developments in Nutrition, 2024.
Source repository: https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- · https://www.anuvaad.org.in/indian-nutrient-databank/
Ingredient nutrients: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, fdc.nal.usda.gov (public domain).
Show this attribution in your app (e.g. About / Data sources screen).
