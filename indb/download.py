"""Download INDB source spreadsheets into data/raw/ and record their checksums."""
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = "lindsayjaacks/Indian-Nutrient-Databank-INDB-"
FILES = ["INDB.xlsx", "recipes.xlsx", "recipes_names.xlsx", "recipes_servingsize.xlsx", "Units.xlsx"]
RAW = Path(__file__).parent / "data" / "raw"


def fetch(name: str) -> bytes:
    for branch in ("main", "master"):
        url = f"https://raw.githubusercontent.com/{REPO}/{branch}/{name}"
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
    raise FileNotFoundError(name)


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = {"repo": f"https://github.com/{REPO}", "files": {}}
    for name in FILES:
        path = RAW / name
        if not path.exists():
            path.write_bytes(fetch(name))
            print(f"downloaded {name}")
        else:
            print(f"exists     {name}")
        manifest["files"][name] = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "bytes": path.stat().st_size,
        }
    manifest["retrieved_at"] = datetime.now(timezone.utc).isoformat()
    (RAW / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
