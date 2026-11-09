"""
Model results for the map and the posters: connected groups for Hard Mode (touching crowns) and Squirrel Mode (≤ 2 m gaps),
with roads allowed or with major roads as lava; the critical gaps where one new tree (8 m crown) would join two large groups;
and the longest park-to-park squirrel route.

  python pipeline/analyse.py
Output  docs/data/analysis.json
"""
import json
from pathlib import Path

import geopandas as gpd
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components, dijkstra

W = Path("docs/data")
T = np.fromfile(W / "trees.bin", dtype=[("lon", "<f4"), ("lat", "<f4"), ("r", "<u2")])
E = np.fromfile(W / "edges.bin", dtype=[("a", "<u4"), ("b", "<u4"), ("g", "u1"), ("f", "u1")])
P = gpd.read_file(W / "parks.geojson")
N, NP = len(T), len(P)
gap = E["g"] / 50.0 - 1
lon = np.r_[T["lon"], P.representative_point().x.values]; lat = np.r_[T["lat"], P.representative_point().y.values]
X, Y = lon * 111320 * np.cos(np.radians(53.55)), lat * 111320                           # metres (local)
r = T["r"] / 10.0
NEW_R = 4.0


def comps(jump, roads_lava):
    m = (gap <= jump) & (((E["f"] & 1) == 0) if roads_lava else True)
    A = coo_matrix((np.ones(m.sum()), (E["a"][m], E["b"][m])), shape=(N + NP, N + NP))
    return connected_components(A, directed=False)[1], m


def stats(lab):
    # largest network = the group (trees + green areas) with the widest extent
    allsz = np.bincount(lab)
    cand_ = np.argsort(-allsz)[:200]
    spans = []
    for c in cand_:
        s_ = lab == c
        spans.append(np.hypot(X[s_].max() - X[s_].min(), Y[s_].max() - Y[s_].min()))
    wide = cand_[int(np.argmax(spans))]
    tl = lab[:N]
    sizes = np.bincount(tl, minlength=lab.max() + 1)
    pc = np.bincount(lab[N:], minlength=lab.max() + 1)
    big = sizes.argmax()
    multi = int(((pc >= 2) & (sizes > 0)).sum())
    sel = tl == big
    span = float(np.hypot(X[:N][sel].max() - X[:N][sel].min(), Y[:N][sel].max() - Y[:N][sel].min()) / 1000)
    return {"groups": int((sizes > 0).sum()), "alone": int((sizes == 1).sum()), "largest": int(sizes.max()), "largest_span_km": round(span, 1),
            "largest_parks": int(pc[big]), "groups_2plus_parks": multi, "parks_in_tree_groups": int(((pc > 0) & (sizes > 0))[lab[N:]].sum()),
            "widest_km": round(float(max(spans)) / 1000, 1), "widest_trees": int(sizes[wide]) if wide < len(sizes) else 0, "widest_parks": int(pc[wide]),
            "wide_id": int(wide)}


out = {"scenarios": {}}
for name, jump, rl in [("hard", 0.0, False), ("squirrel", 2.0, False), ("hard_roads", 0.0, True), ("squirrel_roads", 2.0, True)]:
    lab, _ = comps(jump, rl)
    out["scenarios"][name] = stats(lab)
print(json.dumps(out["scenarios"], indent=1))
# percolation: largest network (trees) and widest extent as the allowed jump grows
out["curve"] = []
for jump in np.arange(0, 4.01, 0.5):
    lab_, _ = comps(float(jump), False); s_ = stats(lab_)
    out["curve"].append({"jump": float(jump), "groups": s_["groups"], "largest": s_["largest"], "widest_km": s_["widest_km"], "alone": s_["alone"]})
print("curve:", [(c["jump"], c["groups"], c["largest"], c["widest_km"]) for c in out["curve"]])

# critical gaps: one new tree (8 m crown) can link trees i and j of different Squirrel-Mode groups if both crowns are within 2 m of it,
# i.e. centre distance ≤ (r_i + 6) + (r_j + 6); it is placed on the line between them; gaps whose line crosses a major road are skipped
lab, m = comps(2.0, False)
tl = lab[:N]; sizes = np.bincount(tl)
from scipy.spatial import cKDTree
kd = cKDTree(np.c_[X[:N], Y[:N]])
pairs = kd.query_pairs(2 * r.max() + 12, output_type="ndarray")
d = np.hypot(X[pairs[:, 0]] - X[pairs[:, 1]], Y[pairs[:, 0]] - Y[pairs[:, 1]])
ok = (d <= r[pairs[:, 0]] + r[pairs[:, 1]] + 2 * (NEW_R + 2)) & (tl[pairs[:, 0]] != tl[pairs[:, 1]])
pairs, d = pairs[ok], d[ok]
ga, gb = tl[pairs[:, 0]], tl[pairs[:, 1]]
score = np.minimum(sizes[ga], sizes[gb])
order = np.argsort(-score)
seen, crit = set(), []
pc = np.bincount(lab[N:], minlength=lab.max() + 1)
from shapely import STRtree, LineString
RD = gpd.read_file(W / "roads_major.geojson").geometry.values
rtree = STRtree(RD)
for k in order:
    key = tuple(sorted((ga[k], gb[k])))
    if key in seen: continue
    i, j = pairs[k]
    seg_ = LineString([(lon[i], lat[i]), (lon[j], lat[j])])
    if len(rtree.query(seg_, predicate="intersects")): continue          # would hop a major road
    seen.add(key)
    # new crown centred so that the two gaps (old crown → new crown) are equal: each = (gap − 8 m) / 2 ≤ 2 m
    gap_ = float(d[k] - r[i] - r[j]); t_ = (r[i] + max(gap_ - 2 * NEW_R, 0) / 2 + NEW_R) / max(d[k], 1e-6)
    t_ = min(max(t_, 0.0), 1.0)
    crit.append({"lon": round(float(lon[i] + (lon[j] - lon[i]) * t_), 7), "lat": round(float(lat[i] + (lat[j] - lat[i]) * t_), 7),
                 "a": int(sizes[ga[k]]), "b": int(sizes[gb[k]]), "parks": int(pc[ga[k]] + pc[gb[k]]), "gap_m": round(gap_, 1)})
    if len(crit) >= 20: break
out["critical"] = crit
print("critical gaps:", crit[:5])

# showcase route: the longest canopy path inside the largest Squirrel-Mode tree group (roads allowed), between its two farthest trees
import pandas as pd
attr = pd.read_parquet("build/trees_attr.parquet")
big = int(np.bincount(tl).argmax())
nodes = np.flatnonzero(lab == big)
tnodes = nodes[nodes < N]
parks_in = nodes[nodes >= N]
w = np.hypot(X[E["a"]] - X[E["b"]], Y[E["a"]] - Y[E["b"]]) + 0.1
G = coo_matrix((w[m], (E["a"][m], E["b"][m])), shape=(N + NP, N + NP)).tocsr()
d0 = dijkstra(G, directed=False, indices=tnodes[0])
p1 = tnodes[np.argmax(np.where(np.isfinite(d0[tnodes]), d0[tnodes], -1))]
d1, pred = dijkstra(G, directed=False, indices=p1, return_predecessors=True)
p2 = tnodes[np.argmax(np.where(np.isfinite(d1[tnodes]), d1[tnodes], -1))]
path = [p2]
while path[-1] != p1: path.append(pred[path[-1]])
path = path[::-1]
tr = [n for n in path if n < N]
streets = pd.unique(attr.strasse.values[tr]).tolist()
out["route"] = {"km": round(float(d1[p2]) / 1000, 2), "trees": len(tr), "parks": int(sum(1 for n in path if n >= N)),
                "area": attr.stadtteil.values[tr[0]], "streets": [s_ for s_ in streets if isinstance(s_, str)][:6],
                "genera": attr.gattung_deutsch.value_counts().index[:0].tolist(),
                "main_genus": pd.Series(attr.gattung_deutsch.values[tr]).str.split(" / ").str[-1].value_counts().index[0],
                "group_trees": int(len(tnodes)), "group_parks": int(len(parks_in)),
                "coords": [[round(float(lon[n]), 6), round(float(lat[n]), 6)] for n in path]}
print({k: v for k, v in out["route"].items() if k != "coords"})

# route extension: up to 5 new trees (8 m crown) that make the longest canopy path in the largest group longest, chosen greedily.
# Each new tree links one tree of the current group with one tree outside it (both gaps ≤ 2 m, no major-road crossing).
def diameter(nodes_, Gs):
    sub = Gs[nodes_][:, nodes_]
    tn = np.flatnonzero(nodes_ < N) if True else None
    d0_ = dijkstra(sub, directed=False, indices=0)
    a_ = int(np.argmax(np.where(np.isfinite(d0_), d0_, -1)))
    d1_ = dijkstra(sub, directed=False, indices=a_)
    return float(np.max(np.where(np.isfinite(d1_), d1_, -1)))

Gx = G.tolil()
cur = set(nodes.tolist())
labs = lab.copy()
ext, used, BUDGET = [], 0, 5
base_km = out["route"]["km"]; now_km = base_km
reach_ = r.max() + 2 * (2 * NEW_R + 2) + 2 + 10
while used < BUDGET:
    members = np.array(sorted(n for n in cur if n < N))
    best, seenc = None, set()
    for i in members:
        for j in kd.query_ball_point([X[i], Y[i]], r[i] + reach_):
            if j in cur or j >= N: continue
            dd = float(np.hypot(X[i] - X[j], Y[i] - Y[j])); g_ = dd - r[i] - r[j]
            k = 1 if g_ <= 2 * NEW_R + 4 else 2 if g_ <= 4 * NEW_R + 6 else 0      # 1 tree spans ≤ 12 m, 2 trees ≤ 22 m
            if k == 0 or used + k > BUDGET: continue
            cj = labs[j]
            if (i, cj, k) in seenc: continue
            if len(rtree.query(LineString([(lon[i], lat[i]), (lon[j], lat[j])]), predicate="intersects")): continue
            seenc.add((i, cj, k))
            # k new crowns evenly spread in the gap
            gs = max(g_ - 2 * NEW_R * k, 0) / (k + 1)                              # equal gaps between all crowns in the chain
            ts = [(r[i] + gs + NEW_R + q * (2 * NEW_R + gs)) / dd for q in range(k)]
            pts = [(X[i] + (X[j] - X[i]) * t, Y[i] + (Y[j] - Y[i]) * t, t) for t in ts]
            H = Gx.copy(); n0 = H.shape[0]; H.resize((n0 + k, n0 + k))
            chain = [i] + list(range(n0, n0 + k)) + [j]
            xy = [(X[i], Y[i])] + [(x, y) for x, y, _ in pts] + [(X[j], Y[j])]
            for u in range(len(chain) - 1):
                H[chain[u], chain[u + 1]] = H[chain[u + 1], chain[u]] = float(np.hypot(xy[u][0] - xy[u + 1][0], xy[u][1] - xy[u + 1][1])) + 0.1
            comp_j = np.flatnonzero(labs == cj)
            idx = np.array(sorted(cur | set(comp_j.tolist()) | set(range(n0, n0 + k))))
            km = diameter(idx, H.tocsr()) / 1000
            score = (km - now_km) / k
            if best is None or score > best[0]: best = (score, km, k, i, j, pts, cj, H, comp_j, n0)
    if best is None or best[1] - now_km < 0.005: break
    score, km, k, i, j, pts, cj, H, comp_j, n0 = best
    Gx = H; labs = np.r_[labs, [labs[i]] * k]; labs[comp_j] = labs[i]
    cur |= set(comp_j.tolist()) | set(range(n0, n0 + k)); used += k; now_km = km
    for x_, y_, t in pts:
        ext.append({"lon": round(float(lon[i] + (lon[j] - lon[i]) * t), 7), "lat": round(float(lat[i] + (lat[j] - lat[i]) * t), 7), "km": round(km, 2), "joins": int(len(comp_j))})
    print("extend +", k, "tree(s) →", round(km, 2), "km, joins", len(comp_j))
out["extend"] = {"base_km": base_km, "trees": ext}
out["largest_group_parks"] = P.name[(parks_in - N)].value_counts().head(12).index.tolist() if len(parks_in) else []
out["park_pts"] = [[round(float(a_), 5), round(float(b_), 5)] if np.isfinite(a_) else None for a_, b_ in zip(lon[N:], lat[N:])]
(W / "analysis.json").write_text(json.dumps(out, ensure_ascii=False))
