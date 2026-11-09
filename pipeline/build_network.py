"""
The City Is Lava — a canopy network for Hamburg's squirrels.

Every street tree (Straßenbaumkataster Hamburg) is a circle with its recorded crown diameter. Two crowns are linked when the gap
between them is at most 4 m (the browser then keeps only the links allowed by the chosen jump: 0 m = Hard Mode, touching crowns;
2 m = Squirrel Mode). Public green spaces, cemeteries and allotments (Digitaler Grünplan) are "safe islands": a crown that
reaches one links to it, and green areas that touch each other are linked.

Every link records whether its straight line between the two trunks crosses a major road (OSM motorway, trunk, primary,
secondary and their links) or any road, so roads can be switched on as lava too.

  python pipeline/build_network.py --data "<folder with the Hamburg files>"
Output  docs/data/trees.bin · edges.bin · parks.geojson · roads_major.geojson · meta.json
"""
import argparse, json, time
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely
from scipy.spatial import cKDTree

MAXGAP = 4.0
MAJOR = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"}
ROADS = MAJOR | {"tertiary", "tertiary_link", "residential", "unclassified", "living_street", "service"}
W = Path("docs/data")


def main(data):
    t0 = time.time()
    t = pyogrio.read_dataframe(data / "strassenbaumkataster_json/de_hh_up_strassenbaumkataster_EPSG_25832.json",
                               columns=["baumid", "gattung_deutsch", "pflanzjahr", "kronendurchmesser", "strasse", "stadtteil"]).set_crs(25832, allow_override=True)
    n_all = len(t)
    t = t[(t.kronendurchmesser > 0) & (t.kronendurchmesser <= 35)].reset_index(drop=True)
    t["geometry"] = t.geometry.apply(lambda g: g.geoms[0] if g.geom_type == "MultiPoint" else g)
    xy = t.get_coordinates().values; r = t.kronendurchmesser.values / 2.0
    print(f"trees: {n_all:,} · with a crown diameter: {len(t):,}  ({time.time() - t0:.0f} s)", flush=True)

    # tree ↔ tree
    kd = cKDTree(xy)
    pairs = kd.query_pairs(2 * r.max() + MAXGAP, output_type="ndarray")
    d = np.hypot(*(xy[pairs[:, 0]] - xy[pairs[:, 1]]).T)
    gap = d - r[pairs[:, 0]] - r[pairs[:, 1]]
    keep = gap <= MAXGAP
    pairs, gap = pairs[keep], gap[keep]
    print(f"tree links (gap ≤ {MAXGAP} m): {len(pairs):,}  ({time.time() - t0:.0f} s)", flush=True)

    # green areas (the files say EPSG:25832 in their name; GeoJSON readers assume 4326, so the CRS is set explicitly)
    gs = []
    for f, kind in [("de_hh_up_verzeichnis_oeffentlicher_gruenanlagen_EPSG_25832.json", "green"), ("de_hh_up_friedhoefe_EPSG_25832.json", "cemetery"),
                    ("de_hh_up_kleingartenanlagen_EPSG_25832.json", "allotment")]:
        g = gpd.read_file(data / "gruenplan_json_232353_snap_9" / f).set_crs(25832, allow_override=True)
        g["kind"] = kind; gs.append(g[["benennung", "belegenheit", "gruen_art", "stadtteil", "flaeche_ha", "kind", "geometry"]])
    p = pd.concat(gs, ignore_index=True)
    p["geometry"] = p.geometry.make_valid().buffer(0)
    p = p[~p.geometry.is_empty].reset_index(drop=True)
    p["area_ha"] = (p.area / 1e4).round(2)
    p["name"] = p.benennung.fillna(p.belegenheit).fillna(p.gruen_art)
    print(f"green areas: {len(p):,} ({p.kind.value_counts().to_dict()})", flush=True)
    N = len(t)
    pt = shapely.points(xy)
    tree_idx = shapely.STRtree(p.geometry.values)
    ti, pi = tree_idx.query(shapely.buffer(pt, r + MAXGAP), predicate="intersects")
    pg = shapely.distance(pt[ti], p.geometry.values[pi]) - r[ti]
    tp = pd.DataFrame({"a": ti, "b": N + pi, "gap": np.maximum(pg, -1)})
    tp = tp[tp.gap <= MAXGAP]
    pa, pb = tree_idx.query(p.geometry.values, predicate="dwithin", distance=MAXGAP)
    m = pa < pb
    pp = pd.DataFrame({"a": N + pa[m], "b": N + pb[m], "gap": shapely.distance(p.geometry.values[pa[m]], p.geometry.values[pb[m]])})
    print(f"tree → green links: {len(tp):,} · green ↔ green: {len(pp):,}", flush=True)

    E = pd.concat([pd.DataFrame({"a": pairs[:, 0], "b": pairs[:, 1], "gap": gap}), tp, pp], ignore_index=True)

    # roads crossed by a link's straight line (trunk to trunk; tree → green uses the nearest point of the green area)
    rd = pyogrio.read_dataframe(data / "Hamburg_OSM_Roads.gpkg", columns=["fclass", "name", "bridge", "tunnel"])
    rd = rd[rd.fclass.isin(ROADS) & (rd.tunnel != "T")].to_crs(25832)
    allxy = np.r_[xy, np.c_[p.representative_point().x, p.representative_point().y]]
    A, Bn = E.a.values, E.b.values
    endB = allxy[Bn].copy()
    isp = (Bn >= N) & (A < N)
    endA = allxy[A]
    if isp.any():
        near = shapely.shortest_line(pt[A[isp]], p.geometry.values[Bn[isp] - N])
        endB[isp] = shapely.get_coordinates(shapely.get_point(near, 1))
    seg = shapely.linestrings(np.stack([endA, endB], axis=1))
    flags = np.zeros(len(E), dtype=np.uint8)
    for bit, cls in [(1, MAJOR), (2, ROADS)]:
        rr = shapely.STRtree(rd[rd.fclass.isin(cls)].geometry.values)
        si, _ = rr.query(seg, predicate="intersects")
        flags[np.unique(si)] |= bit
    flags[(A >= N) & (Bn >= N)] = 0
    E["fl"] = flags
    print(f"links crossing a major road: {(flags & 1 > 0).sum():,} · any road: {(flags & 2 > 0).sum():,}  ({time.time() - t0:.0f} s)", flush=True)

    # web: binary arrays
    W.mkdir(parents=True, exist_ok=True)
    ll = gpd.GeoSeries(pt, crs=25832).to_crs(4326).get_coordinates().values
    T = np.zeros(len(t), dtype=[("lon", "<f4"), ("lat", "<f4"), ("r", "<u2")])
    T["lon"], T["lat"], T["r"] = ll[:, 0], ll[:, 1], np.round(r * 10)
    T.tofile(W / "trees.bin")
    Ed = np.zeros(len(E), dtype=[("a", "<u4"), ("b", "<u4"), ("g", "u1"), ("f", "u1")])
    Ed["a"], Ed["b"] = E.a.values, E.b.values
    Ed["g"] = np.round((np.clip(E.gap.values, -1, MAXGAP) + 1) * 50).astype(np.uint8)
    Ed["f"] = E["fl"].values
    Ed.tofile(W / "edges.bin")
    po = p.to_crs(4326)
    po["geometry"] = po.simplify(0.00002)
    po["id"] = np.arange(len(po))
    po[["id", "name", "kind", "stadtteil", "area_ha", "geometry"]].to_file(W / "parks.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    maj = rd[rd.fclass.isin(MAJOR)].to_crs(4326)
    maj["geometry"] = maj.simplify(0.00003)
    maj[["fclass", "geometry"]].to_file(W / "roads_major.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)
    Path("build").mkdir(exist_ok=True); t[["gattung_deutsch", "pflanzjahr", "strasse", "stadtteil"]].to_parquet("build/trees_attr.parquet")
    meta = {"n_trees_register": n_all, "n_trees": len(t), "n_parks": len(p), "n_edges": len(E), "maxgap": MAXGAP,
            "kinds": p.kind.value_counts().to_dict(), "crown_median_m": float(np.median(r * 2))}
    (W / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta, indent=1))
    print({f.name: round(f.stat().st_size / 1e6, 1) for f in W.iterdir()})


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True)
    main(Path(ap.parse_args().data))
