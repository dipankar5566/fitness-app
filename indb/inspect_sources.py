"""Print sheets, headers and row counts of the downloaded INDB spreadsheets."""
from pathlib import Path

import pandas as pd

RAW = Path(__file__).parent / "data" / "raw"

for path in sorted(RAW.glob("*.xlsx")):
    sheets = pd.read_excel(path, sheet_name=None)
    for sheet, df in sheets.items():
        print(f"\n## {path.name} [{sheet}] rows={len(df)} cols={len(df.columns)}")
        print(list(df.columns))
        print(df.head(2).to_string(max_colwidth=30))
