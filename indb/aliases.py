"""Add Hindi / regional / spelling-variant names to food_name.

Sources:
  indb_bracket  - Indian-language names INDB embeds in brackets, e.g. "Boiled rice (Uble chawal)".
                  Romanised and language not stated, so tagged lang='und-Latn'.
  indb_variant  - spelling variants written with '/', e.g. "Plain parantha/paratha" (lang 'en').
  indb_scientific - Latin binomials on ingredients, e.g. "(Prunus cerasus)" (lang 'la').
  curated       - native-script names from data/curated_names.csv (code,lang,name); review before shipping.

Run standalone (`python aliases.py`) or via load.py. Re-runnable: replaces all non-'indb' names.
"""
import csv
import re
from pathlib import Path

from psycopg2.extras import execute_values

CURATED = Path(__file__).parent / "data" / "curated_names.csv"

# Bracket contents made only of these words are English descriptions, not names.
DESCRIPTOR_WORDS = {
    "stirred", "thick", "thin", "vegetarian", "non", "veg", "salted", "sweet", "with", "without", "squash",
    "squashes", "boiled", "fried", "baked", "steamed", "raw", "cooked", "homemade", "instant", "small", "large",
    "medium", "low", "fat", "sugar", "free", "diet", "plain", "mixed", "fresh", "dry", "special", "and", "or",
    "a", "the", "of", "in", "no", "milk", "water", "ice", "cream", "toned", "skimmed", "whole", "cow", "buffalo",
    "toasted", "grilled", "roasted", "mashed", "chopped", "sliced", "frozen", "canned", "tinned", "sweetened",
    "unsweetened", "light", "heavy", "regular", "unsalted", "thickened", "diluted", "ready", "to", "eat", "serve",
}
SCIENTIFIC = re.compile(r"^[A-Z][a-z]+ [a-z]+(?: (?:var\.|subsp\.)? ?[a-z]+)?$")


def is_description(text: str) -> bool:
    words = re.findall(r"[a-z]+", text.lower())
    return not words or all(w in DESCRIPTOR_WORDS for w in words) or text.lower().startswith("with ")


def expand_slashes(name: str) -> list[str]:
    """'Plain parantha/paratha' -> ['Plain parantha', 'Plain paratha']; 'Chapati/Roti' -> ['Chapati', 'Roti']."""
    if "/" not in name:
        return [name]
    parts = [p.strip() for p in name.split("/")]
    # "Suji/Rava dhokla": single-word head, multi-word tail -> word-level ("Suji dhokla", "Rava dhokla").
    word_level = " " not in parts[0] and any(" " in p for p in parts[1:])
    # Whole-phrase alternatives ("Crispy okra/Crispy lady's fingers"): each later part starts uppercase.
    if not word_level and all(p[:1].isupper() for p in parts[1:]):
        return parts
    if word_level and len(parts) == 2:
        words = parts[1].split(" ")
        # A possessive head word ("Lady's fingers") spans two words, so swap both.
        span = 2 if words[0].endswith("'s") and len(words) > 2 else 1
        return [" ".join([parts[0], *words[span:]]), parts[1]]
    # Word-level alternatives: replace the slashed token with each option.
    out = [name]
    while any("/" in n for n in out):
        nxt = []
        for n in out:
            m = re.search(r"(\S+)/(\S+)", n)
            if not m:
                nxt.append(n)
                continue
            for opt in (m.group(1), m.group(2)):
                nxt.append(n[:m.start()] + opt + n[m.end():])
        out = nxt
    return out


def derive(name: str, food_type: str = "recipe") -> list[tuple[str, str, str]]:
    """Return (alias, lang, origin) triples derived from one INDB name."""
    aliases = []
    base = name
    for inner in re.findall(r"\(([^()]+)\)", name):
        base = base.replace(f"({inner})", "")
        if is_description(inner):
            continue
        if food_type == "ingredient" and SCIENTIFIC.match(inner.strip()):
            aliases.append((inner.strip(), "la", "indb_scientific"))
            continue
        for part in inner.split(","):
            for alias in expand_slashes(part.strip()):
                if alias and not is_description(alias):
                    aliases.append((alias, "und-Latn", "indb_bracket"))
    base = re.sub(r"\s+", " ", base).strip()
    variants = expand_slashes(base)
    if len(variants) > 1:
        aliases += [(v, "en", "indb_variant") for v in variants]
    return aliases


def apply_aliases(cur) -> dict[str, int]:
    cur.execute("DELETE FROM food_name WHERE origin <> 'indb'")
    cur.execute("SELECT id, code, name, food_type FROM food")
    foods = cur.fetchall()
    code_to_id = {code: fid for fid, code, _, _ in foods}
    cur.execute("SELECT food_id, lower(name) FROM food_name")
    existing = set(cur.fetchall())

    rows = {}
    for fid, _, name, food_type in foods:
        for alias, lang, origin in derive(name, food_type):
            key = (fid, alias.lower())
            if key not in existing and alias.lower() != name.lower():
                rows.setdefault(key, (fid, alias, lang, origin))

    missing = []
    with CURATED.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            fid = code_to_id.get(r["code"].strip())
            if fid is None:
                missing.append(r["code"])
                continue
            name = r["name"].strip()
            rows.setdefault((fid, name.lower()), (fid, name, r["lang"].strip(), "curated"))

    execute_values(cur, "INSERT INTO food_name (food_id, name, lang, origin) VALUES %s ON CONFLICT DO NOTHING",
                   list(rows.values()))
    if missing:
        print("curated codes not found:", sorted(set(missing)))
    cur.execute("SELECT origin, count(*) FROM food_name GROUP BY 1 ORDER BY 1")
    return dict(cur.fetchall())


if __name__ == "__main__":
    from load import connect

    with connect() as conn, conn.cursor() as cur:
        cur.execute((Path(__file__).parent / "schema.sql").read_text(encoding="utf-8"))
        print(apply_aliases(cur))
