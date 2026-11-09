"""Genus per street tree (same order as docs/data/trees.bin) for the 3D crown shapes and the hover label.
Output docs/data/genus.bin (uint8 index per tree) + docs/data/genus.json (names, shape class per name)."""
import json
from pathlib import Path
import numpy as np
import pandas as pd

W = Path("docs/data")
g = pd.read_parquet("build/trees_attr.parquet").gattung_deutsch.fillna("unbekannt").str.split(" / ").str[-1].str.strip()
top = g.value_counts().index[:80].tolist()
names = top + ["andere"]
code = g.map({n: i for i, n in enumerate(top)}).fillna(len(top)).astype(np.uint8).values
assert len(code) == (W / "trees.bin").stat().st_size // 10
# crown shape classes: 0 round · 1 tall oval · 2 broad dome · 3 narrow column · 4 cone (conifer) · 5 small round (fruit & small trees)
SHAPE = {"Linde": 1, "Hainbuche": 1, "Erle": 1, "Amberbaum": 1, "Hopfenbuchen": 1, "Baumhasel": 1, "Tulpenbaum": 1,
         "Eiche": 2, "Platane": 2, "Kastanie": 2, "Edelkastanie": 2, "Walnuss": 2, "Weide": 2, "Schnurbaum": 2, "Trompetenbaum": 2,
         "Pappel": 3, "Birke": 3, "Fächerblattbaum": 3,
         "Kiefer": 4, "Fichte": 4, "Tanne": 4, "Lärche": 4, "Eibe": 4, "Douglasie": 4, "Zeder": 4, "Urweltmammutbaum": 4, "Sumpfzypresse": 4, "Lebensbaum": 4, "Scheinzypresse": 4,
         "Vogelbeere": 5, "Steinobst": 5, "Apfelbaum": 5, "Birnbaum": 5, "Weissdorn": 5, "Hasel": 5, "Felsenbirne": 5, "Zierapfel": 5, "Mehlbeere": 5}
code.tofile(W / "genus.bin")
json.dump({"names": names, "shape": [SHAPE.get(n, 0) for n in names]}, open(W / "genus.json", "w"), ensure_ascii=False)
print(len(names), "genera;", pd.Series([SHAPE.get(n, 0) for n in names])[code].value_counts().to_dict())
