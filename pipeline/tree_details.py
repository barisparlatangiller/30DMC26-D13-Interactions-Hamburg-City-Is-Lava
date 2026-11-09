"""Per-tree details for the 3D view and the hover label, in the same order as docs/data/trees.bin (same filter as build_network.py):
trunk circumference (cm) → real trunk thickness, planting year, species, and cultivar form (columnar 'Säulen-', globe 'Kugel-', weeping 'Hänge-').
Output docs/data/details.bin  (uint16 trunk_cm, uint16 year, uint16 species, uint8 form) · docs/data/details.json (species names)."""
import argparse, json
from pathlib import Path
import numpy as np
import pandas as pd
import pyogrio

ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True); a = ap.parse_args()
W = Path("docs/data")
t = pyogrio.read_dataframe(Path(a.data) / "strassenbaumkataster_json/de_hh_up_strassenbaumkataster_EPSG_25832.json", read_geometry=False,
                           columns=["kronendurchmesser", "stammumfang", "pflanzjahr", "art_deutsch", "sorte_deutsch", "strasse"])
t = t[(t.kronendurchmesser > 0) & (t.kronendurchmesser <= 35)].reset_index(drop=True)
assert len(t) == (W / "trees.bin").stat().st_size // 10
ref = Path("build/trees_attr.parquet")
if ref.exists():                                   # same order as the network?
    s0 = pd.read_parquet(ref).strasse.fillna("").values; assert (s0 == t.strasse.fillna("").values).all()
sp = t.art_deutsch.fillna("unbekannt").str.strip()
top = sp.value_counts().index[:999].tolist(); names = top + ["andere"]
so = t.sorte_deutsch.fillna("").str.lower()
form = np.select([so.str.contains("säulen|pyramiden|fastigiata"), so.str.contains("kugel|globos|nana"), so.str.contains("hänge|trauer|pendula")], [3, 5, 2], 255).astype(np.uint8)
D = np.zeros(len(t), dtype=[("trunk", "<u2"), ("year", "<u2"), ("sp", "<u2"), ("form", "u1")])
D["trunk"] = pd.to_numeric(t.stammumfang, errors="coerce").fillna(0).clip(0, 2000).astype(int)
D["year"] = pd.to_numeric(t.pflanzjahr, errors="coerce").fillna(0).clip(0, 2100).astype(int)
D["sp"] = sp.map({n: i for i, n in enumerate(top)}).fillna(len(top)).astype(int)
D["form"] = form
D.tofile(W / "details.bin")
json.dump({"species": names}, open(W / "details.json", "w"), ensure_ascii=False)
print("details:", len(D), "· trunk known", int((D["trunk"] > 0).sum()), "· forms", pd.Series(form).value_counts().to_dict(), "· species", len(names))
