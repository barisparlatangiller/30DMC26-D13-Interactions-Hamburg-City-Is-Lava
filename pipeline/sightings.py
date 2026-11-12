"""Red squirrel (Sciurus vulgaris) sightings in Hamburg from GBIF -> docs/data/sightings.json.
Open licences only (CC0, CC BY, CC BY-NC), human observations with coordinates, uncertainty <= 100 m, 2010 or later."""
import json, time, urllib.request, urllib.parse, collections
API = "https://api.gbif.org/v1/"
def get(path, **q):
    u = API + path + ("?" + urllib.parse.urlencode(q, doseq=True) if q else "")
    for k in range(5):
        try:
            with urllib.request.urlopen(u, timeout=60) as r: return json.load(r)
        except Exception as e: print("retry", k, e); time.sleep(3 + 5 * k)
    raise SystemExit("GBIF unreachable")
sp = get("species/match", name="Sciurus vulgaris", rank="SPECIES")
key = sp["usageKey"]; print("taxon", key, sp.get("scientificName"), sp.get("matchType"))
base = dict(taxonKey=key, gadmGid="DEU.6_1", hasCoordinate="true", hasGeospatialIssue="false", occurrenceStatus="PRESENT",
            basisOfRecord="HUMAN_OBSERVATION", year="2010,2026", coordinateUncertaintyInMeters="0,100", limit=300)
rows, off, licences, datasets = [], 0, collections.Counter(), collections.Counter()
OK = ("CC0_1_0", "CC_BY_4_0", "CC_BY_NC_4_0")
while True:
    d = get("occurrence/search", offset=off, **base)
    for o in d["results"]:
        lic = (o.get("license") or "").rsplit("/", 2)
        L = o.get("license", "")
        tag = "CC0_1_0" if "zero" in L or "CC0" in L else "CC_BY_NC_4_0" if "by-nc" in L.lower() else "CC_BY_4_0" if "/by/" in L.lower() or "CC_BY_4" in L else L
        if tag not in OK: continue
        rows.append([round(o["decimalLongitude"], 6), round(o["decimalLatitude"], 6), o.get("year") or 0, o.get("month") or 0,
                     int(o.get("coordinateUncertaintyInMeters") or 0), o.get("datasetKey", "")[:8], tag])
        licences[tag] += 1; datasets[(o.get("datasetKey", ""), o.get("datasetName") or o.get("institutionCode") or "")] += 1
    off += d["limit"]
    if d.get("endOfRecords") or off >= d.get("count", 0) or off > 20000: break
print("total in GBIF query:", d.get("count"), "kept:", len(rows), dict(licences))
meta = {"taxon": sp.get("scientificName"), "taxonKey": key, "query": {k: v for k, v in base.items() if k != "limit"}, "retrieved": time.strftime("%Y-%m-%d"),
        "n": len(rows), "licences": dict(licences),
        "datasets": [{"key": k, "name": n, "n": c} for (k, n), c in datasets.most_common()],
        "fields": ["lon", "lat", "year", "month", "uncertainty_m", "dataset", "licence"]}
json.dump({"meta": meta, "rows": rows}, open("docs/data/sightings.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(json.dumps(meta["datasets"][:10], ensure_ascii=False))
