/* The City Is Lava · #30DayMapChallenge 2026 · Day 13 · Interactions · Hamburg
   228,091 street-tree crowns as a network. Groups are recomputed in the browser (union–find) for every model, road rule,
   planted or removed tree. */
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString("en-GB");
const KX = 111320 * Math.cos(53.55 * Math.PI / 180), KY = 111320;
const C = { reach: [255, 176, 0], g50: [22, 128, 68], g10: [64, 168, 96], g2: [140, 200, 140], alone: [196, 188, 180], newt: [226, 0, 122] };
const SQ = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<defs><filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4" result="b"/><feFlood flood-color="#ffd27a" flood-opacity=".8"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<g filter="url(#g)" fill="#ff9f43" stroke="#3a1a08" stroke-width="2.5" stroke-linejoin="round">
<path d="M60 104 C26 106 8 78 14 50 C20 22 50 10 64 28 C74 42 64 58 50 54 C44 70 52 90 70 94 Z" fill="#ff8c2a"/>
<path d="M58 106 C54 88 60 70 74 64 C88 58 98 70 96 86 C94 100 82 108 58 106 Z"/>
<circle cx="88" cy="54" r="14"/>
<path d="M80 44 L84 30 L92 42 Z"/>
<path d="M100 56 L104 58 L100 60" fill="none"/>
</g>
<circle cx="93" cy="51" r="2.6" fill="#1a0a03"/>
<path d="M84 86 C90 84 94 80 96 76" fill="none" stroke="#3a1a08" stroke-width="2.5" stroke-linecap="round"/>
</svg>`);
const S = { jump: 0, roads: false, removed: new Uint8Array(0), added: [], sel: -1, tool: null, ver: 0 };
window.S = S;

async function load() {
  const bin = u => fetch(u).then(r => r.arrayBuffer()), j = u => fetch(u).then(r => r.json());
  const [tb, eb, parks, roads, A, meta] = await Promise.all([bin("data/trees.bin?v=1"), bin("data/edges.bin?v=1"), j("data/parks.geojson?v=1"),
    j("data/roads_major.geojson?v=1"), j("data/analysis.json?v=2"), j("data/meta.json?v=1")]);
  const tv = new DataView(tb), N = tb.byteLength / 10;
  S.N = N; S.lon = new Float64Array(N); S.lat = new Float64Array(N); S.r = new Float32Array(N);
  for (let i = 0; i < N; i++) { S.lon[i] = tv.getFloat32(i * 10, true); S.lat[i] = tv.getFloat32(i * 10 + 4, true); S.r[i] = tv.getUint16(i * 10 + 8, true) / 10; }
  const ev = new DataView(eb), M = eb.byteLength / 10;
  S.M = M; S.ea = new Uint32Array(M); S.eb = new Uint32Array(M); S.eg = new Float32Array(M); S.ef = new Uint8Array(M);
  for (let i = 0; i < M; i++) { S.ea[i] = ev.getUint32(i * 10, true); S.eb[i] = ev.getUint32(i * 10 + 4, true); S.eg[i] = ev.getUint8(i * 10 + 8) / 50 - 1; S.ef[i] = ev.getUint8(i * 10 + 9); }
  Object.assign(S, { parks, roadsGeo: roads, A, meta, NP: parks.features.length });
  S.removed = new Uint8Array(N + S.NP);
  // grid index over trees (50 m cells) for planting
  S.grid = new Map();
  for (let i = 0; i < N; i++) { const k = gkey(S.lon[i] * KX, S.lat[i] * KY); (S.grid.get(k) || S.grid.set(k, []).get(k)).push(i); }
  S.pbox = parks.features.map(f => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; rings(f).forEach(r => r.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); })); return [x0, y0, x1, y1]; });
  S.rsegs = []; for (const f of roads.features) { const L = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates; for (const l of L) for (let i = 1; i < l.length; i++) S.rsegs.push([l[i - 1][0] * KX, l[i - 1][1] * KY, l[i][0] * KX, l[i][1] * KY]); }
}
const gkey = (x, y) => Math.floor(x / 50) + "," + Math.floor(y / 50);
const rings = f => f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();

// ── union–find over the allowed links ──
function compute() {
  const N = S.N, NP = S.NP, NA = S.added.length, T = N + NP + NA;
  const par = new Int32Array(T); for (let i = 0; i < T; i++) par[i] = i;
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  const ok = (g, f) => g <= S.jump && !(S.roads && (f & 1));
  for (let i = 0; i < S.M; i++) { const a = S.ea[i], b = S.eb[i]; if (ok(S.eg[i], S.ef[i]) && !S.removed[a] && !S.removed[b]) uni(a, b); }
  S.added.forEach((t, k) => { if (t.gone) return; for (const l of t.links) if (ok(l.g, l.f) && !S.removed[l.b] && !(l.b >= N + NP && S.added[l.b - N - NP].gone)) uni(N + NP + k, l.b); });
  const root = new Int32Array(T), size = new Int32Array(T), parks = new Int32Array(T);
  for (let i = 0; i < T; i++) root[i] = find(i);
  for (let i = 0; i < N; i++) if (!S.removed[i]) size[root[i]]++;
  for (let k = 0; k < NA; k++) if (!S.added[k].gone) size[root[N + NP + k]]++;
  for (let p = 0; p < NP; p++) parks[root[N + p]]++;
  let groups = 0, alone = 0, largest = 0;
  for (let i = 0; i < T; i++) if (size[i] > 0) { groups++; if (size[i] === 1) alone++; if (size[i] > largest) largest = size[i]; }
  let multi = 0; for (let i = 0; i < T; i++) if (size[i] > 0 && parks[i] >= 2) multi++;
  Object.assign(S, { root, size, parksOf: parks, stats: { groups, alone, largest, multi } });
  // the squirrel's possible jumps (tree ↔ tree), drawn as dashed lines between crowns
  // only a spanning forest (shortest jumps first), so each group reads as one chain instead of a ladder of every possible jump
  if (!S.eord) { const d = new Float32Array(S.M); for (let i = 0; i < S.M; i++) { const a = S.ea[i], b = S.eb[i]; d[i] = b < N ? Math.hypot((S.lon[a] - S.lon[b]) * KX, (S.lat[a] - S.lat[b]) * KY) : 1e9; }
    S.eord = Uint32Array.from({ length: S.M }, (_, i) => i).sort((x, y) => d[x] - d[y]); }
  for (let i = 0; i < T; i++) par[i] = i;
  const la = [], lb = [];
  for (let q = 0; q < S.M; q++) { const i = S.eord[q], a = S.ea[i], b = S.eb[i]; if (b >= N) continue; if (ok(S.eg[i], S.ef[i]) && !S.removed[a] && !S.removed[b] && find(a) !== find(b)) { uni(a, b); la.push(a); lb.push(b); } }
  S.added.forEach((t, k) => { if (t.gone) return; const n = N + NP + k; for (const l of t.links) if ((l.b < N || (l.b >= N + NP && !S.added[l.b - N - NP].gone)) && ok(l.g, l.f) && !S.removed[l.b] && find(n) !== find(l.b)) { uni(n, l.b); la.push(n); lb.push(l.b); } });
  S.la = Int32Array.from(la); S.lb = Int32Array.from(lb); S.visKey = null;
}
function treeColour(i) {
  const N = S.N, ro = S.root[i], sz = S.size[ro];
  if (i >= N + S.NP) return C.newt;
  if (S.sel >= 0 && ro === S.root[S.sel]) return C.reach;
  return sz >= 50 ? C.g50 : sz >= 10 ? C.g10 : sz >= 2 ? C.g2 : C.alone;
}

// ── layers ──
let map, overlay;
function initMap() {
  map = S.map = new maplibregl.Map({ container: "map", style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center: [9.99, 53.565], zoom: 11.2, pitch: 0, maxPitch: 70, attributionControl: false });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Bäume & Grünplan © FHH/BUKEA (dl-de/by-2-0) · roads © OSM (ODbL) · © CARTO" }), "bottom-right");
  overlay = new deck.MapboxOverlay({ interleaved: false, layers: [], getCursor: ({ isHovering }) => S.tool ? "crosshair" : isHovering ? "pointer" : "grab" });
  map.addControl(overlay);
}
function styleBase() {
  for (const l of map.getStyle().layers) {
    try {
      if (l.type === "background") map.setPaintProperty(l.id, "background-color", "#f3f1ed");
      else if (l.type === "fill" && /water/.test(l.id)) map.setPaintProperty(l.id, "fill-color", "#cfe0e8");
      else if (l.type === "fill") map.setPaintProperty(l.id, "fill-color", "#eeebe6");
      else if (l.type === "line" && /road|bridge|tunnel|street|path/.test(l.id)) map.setPaintProperty(l.id, "line-color", "#d9d5cf");
      else if (l.type === "line" && /building/.test(l.id)) map.setLayoutProperty(l.id, "visibility", "none");
      else if (l.type === "fill-extrusion") map.setLayoutProperty(l.id, "visibility", "none");
    } catch (e) {}
  }
}
function addLayers() {
  if (map.getLayer("parks")) return true;
  try {
    styleBase();
    map.addSource("parks", { type: "geojson", data: S.parks, promoteId: "id" });
    map.addLayer({ id: "parks", type: "fill", source: "parks", paint: { "fill-color": ["case", ["boolean", ["feature-state", "reach"], false], "#fff0c4", "#d5ead2"], "fill-opacity": 0.85 } });
    map.addLayer({ id: "parks-l", type: "line", source: "parks", paint: { "line-color": ["case", ["boolean", ["feature-state", "reach"], false], "#f0a500", "#a8cfa4"], "line-width": 0.8 } });
    // major roads in grey, drawn at roughly their real width (metres by class)
    map.addSource("roads", { type: "geojson", data: S.roadsGeo });
    const wm = ["match", ["get", "fclass"], "motorway", 26, "trunk", 20, "primary", 16, "secondary", 12, 7];
    const px = k => ["max", 0.6, ["*", k, wm]];                       // metres → pixels at lat 53.6 (92.9 m/px at z10)
    map.addLayer({ id: "roads", type: "line", source: "roads", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#c3bdb6", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 10, px(1 / 92.9), 20, px(1024 / 92.9)] } });
    // 3D buildings (OpenStreetMap via OpenFreeMap), half transparent so the trees stay in front
    try {
      map.addSource("ofm", { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: "Buildings: OpenFreeMap © OpenMapTiles © OpenStreetMap" });
      map.addLayer({ id: "buildings", type: "fill-extrusion", source: "ofm", "source-layer": "building", minzoom: 13,
        paint: { "fill-extrusion-color": "#d7d2cb", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 9], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": S.bOp ?? 0.45 } });
    } catch (e) { console.warn("buildings", e); }
    map.on("click", e => onClick(e));
    return true;
  } catch (e) { console.warn(e); return false; }
}
const Z3 = 14;                                         // from this zoom on, crowns are drawn in 3D
const crownH = r => Math.max(3, r * 1.15), BASE = 2.5;  // crown thickness and trunk height (m): a sketch, the register has no heights
const topZ = r => BASE + crownH(r);
// low-poly crown: a squashed sphere, unit radius, centred
const MESH = (() => { const P = [], Nn = [], I = [], LA = 6, LO = 12;
  for (let a = 0; a <= LA; a++) { const t = Math.PI * a / LA; for (let o = 0; o <= LO; o++) { const f = 2 * Math.PI * o / LO, x = Math.sin(t) * Math.cos(f), y = Math.sin(t) * Math.sin(f), z = Math.cos(t); P.push(x, y, z); Nn.push(x, y, z); } }
  for (let a = 0; a < LA; a++) for (let o = 0; o < LO; o++) { const p = a * (LO + 1) + o, q = p + LO + 1; I.push(p, q, p + 1, q, q + 1, p + 1); }
  return { attributes: { positions: { value: new Float32Array(P), size: 3 }, normals: { value: new Float32Array(Nn), size: 3 } }, indices: { value: new Uint16Array(I), size: 1 } }; })();
function nodeXY(n) { const N = S.N, NP = S.NP; return n < N ? [S.lon[n], S.lat[n], S.r[n]] : [S.added[n - N - NP].lon, S.added[n - N - NP].lat, S.added[n - N - NP].r]; }
function colours() {                                    // one colour per drawn tree (index: trees, then added trees)
  const N = S.N, NP = S.NP, NA = S.added.length;
  S.col = new Uint8Array((N + NA) * 4);
  for (let i = 0; i < N + NA; i++) {
    const node = i < N ? i : i + NP, gone = i < N ? S.removed[i] : S.added[i - N].gone;
    const c = treeColour(node); S.col[i * 4] = c[0]; S.col[i * 4 + 1] = c[1]; S.col[i * 4 + 2] = c[2]; S.col[i * 4 + 3] = gone ? 0 : 240;
  }
  S.colVer = (S.colVer || 0) + 1; S.visKey = null;
}
function visible() {                                    // trees in view (3D draws only these, so it stays smooth)
  const z = map.getZoom(), b = map.getBounds(), key = z >= Z3 ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth(), S.colVer].map(v => v.toFixed ? v.toFixed(4) : v).join() : "flat";
  if (key === S.visKey) return; S.visKey = key; S.z3 = z >= Z3;
  if (!S.z3) return;
  const N = S.N, NA = S.added.length, padX = (b.getEast() - b.getWest()) * 0.15, padY = (b.getNorth() - b.getSouth()) * 0.15;
  const w = b.getWest() - padX, e = b.getEast() + padX, so = b.getSouth() - padY, no = b.getNorth() + padY, idx = [];
  for (let i = 0; i < N + NA; i++) { const lo = i < N ? S.lon[i] : S.added[i - N].lon, la = i < N ? S.lat[i] : S.added[i - N].lat; if (lo > w && lo < e && la > so && la < no && S.col[i * 4 + 3]) idx.push(i); }
  const n = idx.length, pos = new Float32Array(n * 3), sc = new Float32Array(n * 3), col = new Uint8Array(n * 4);
  idx.forEach((i, k) => { const r = i < N ? S.r[i] : S.added[i - N].r, h = crownH(r);
    pos[3 * k] = i < N ? S.lon[i] : S.added[i - N].lon; pos[3 * k + 1] = i < N ? S.lat[i] : S.added[i - N].lat; pos[3 * k + 2] = BASE + h / 2;
    sc[3 * k] = sc[3 * k + 1] = r; sc[3 * k + 2] = h / 2; col.set(S.col.subarray(i * 4, i * 4 + 4), k * 4); });
  S.v3 = { idx: Int32Array.from(idx), pos, sc, col, n, ver: (S.v3?.ver || 0) + 1 };
  // dashed jumps between crowns in view; the selected group's jumps are drawn stronger
  const inV = new Uint8Array(N + NA + S.NP); idx.forEach(i => inV[i < N ? i : i + S.NP] = 1);
  const ro = S.sel >= 0 ? S.root[S.sel] : -1, A = [], B = [];
  for (let k = 0; k < S.la.length; k++) { const a = S.la[k], bb = S.lb[k]; if (inV[a] || inV[bb]) (ro >= 0 && S.root[a] === ro ? B : A).push(a, bb); }
  const mk = L => { const m = L.length / 2, v = new Float32Array(m * 6), st = new Uint32Array(m);
    for (let k = 0; k < m; k++) { const p = nodeXY(L[2 * k]), q = nodeXY(L[2 * k + 1]); v.set([p[0], p[1], topZ(p[2]) + 1.2, q[0], q[1], topZ(q[2]) + 1.2], 6 * k); st[k] = 2 * k; }
    return { length: m, startIndices: st, attributes: { getPath: { value: v, size: 3 } } }; };
  S.lnA = mk(A); S.lnB = mk(B);
}
function deckLayers() {
  const N = S.N, NA = S.added.length;
  if (S.colDirty || !S.col) { colours(); S.colDirty = false; }
  if (!S.pos || S.pos.length !== (N + NA) * 2) {
    S.pos = new Float32Array((N + NA) * 2); S.rad = new Float32Array(N + NA);
    for (let i = 0; i < N; i++) { S.pos[2 * i] = S.lon[i]; S.pos[2 * i + 1] = S.lat[i]; S.rad[i] = S.r[i]; }
    S.added.forEach((t, k) => { S.pos[2 * (N + k)] = t.lon; S.pos[2 * (N + k) + 1] = t.lat; S.rad[N + k] = t.r; });
  }
  visible();
  const L = [];
  if (!S.z3) L.push(new deck.ScatterplotLayer({ id: "crowns", data: { length: N + NA, attributes: { getPosition: { value: S.pos, size: 2 }, getRadius: { value: S.rad, size: 1 }, getFillColor: { value: S.col, size: 4 } } },
    radiusUnits: "meters", radiusMinPixels: 0.8, pickable: true, autoHighlight: true, highlightColor: [226, 0, 122, 255], updateTriggers: { getFillColor: S.colVer, getRadius: S.colVer } }));
  else {
    const dash = new deck.PathStyleExtension({ dash: true });
    L.push(new deck.PathLayer({ id: "jumps", data: S.lnA, _pathType: "open", getColor: [255, 90, 31, 210], getWidth: 2, widthUnits: "pixels", getDashArray: [3, 2], dashJustified: true, extensions: [dash], updateTriggers: { getPath: S.v3.ver } }));
    L.push(new deck.SimpleMeshLayer({ id: "crowns3d", data: { length: S.v3.n, attributes: { getPosition: { value: S.v3.pos, size: 3 }, getColor: { value: S.v3.col, size: 4 } } },
      getScale: (_, { index }) => [S.v3.sc[3 * index], S.v3.sc[3 * index + 1], S.v3.sc[3 * index + 2]],
      mesh: MESH, getOrientation: [0, 0, 0], pickable: true, autoHighlight: true, highlightColor: [226, 0, 122, 255], material: { ambient: 0.55, diffuse: 0.6, shininess: 12, specularColor: [40, 40, 40] },
      updateTriggers: { getPosition: S.v3.ver, getScale: S.v3.ver, getColor: S.v3.ver } }));
    L.push(new deck.PathLayer({ id: "jumps-sel", data: S.lnB, _pathType: "open", getColor: [230, 70, 10, 255], getWidth: 3, widthUnits: "pixels", getDashArray: [3, 1.6], dashJustified: true, extensions: [dash], updateTriggers: { getPath: S.v3.ver } }));
  }
  if (S.crit) L.push(new deck.ScatterplotLayer({ id: "crit", data: S.crit, getPosition: d => [d.lon, d.lat], getRadius: 18, radiusUnits: "meters", radiusMinPixels: 6,
    filled: false, stroked: true, getLineColor: [226, 0, 122, 200], lineWidthMinPixels: 2, pickable: true }));
  if (S.ext && S.showExt) {                             // suggested trees that would lengthen the route: pink, pulsing
    const ph = S.manual ? (S.pulse || 0) : performance.now() / 600;
    L.push(new deck.ScatterplotLayer({ id: "ext-ring", data: S.ext, getPosition: d => [d.lon, d.lat, 0.5], getRadius: 9 + 3 * Math.sin(ph), radiusUnits: "meters", radiusMinPixels: 7 + 2 * Math.sin(ph),
      filled: true, getFillColor: [226, 0, 122, 60], stroked: true, getLineColor: [226, 0, 122, 255], lineWidthMinPixels: 2.5, pickable: true, updateTriggers: { getRadius: ph } }));
    L.push(new deck.TextLayer({ id: "ext-lbl", data: S.extLbl || (S.extLbl = S.ext.reduce((L, d, i) => { const l = L[L.length - 1]; if (l && Math.hypot((d.lon - l.lon) * KX, (d.lat - l.lat) * KY) < 30) l.t = "+" + l.a + "–" + (i + 1); else L.push({ lon: d.lon, lat: d.lat, a: i + 1, t: "+" + (i + 1) }); return L; }, [])),
      getPosition: d => [d.lon, d.lat, 12], getText: d => d.t, getSize: 15, getColor: [226, 0, 122, 255],
      fontWeight: 800, fontFamily: "Inter, sans-serif", outlineWidth: 4, outlineColor: [255, 255, 255, 255], fontSettings: { sdf: true }, getPixelOffset: [0, -16] }));
  }
  if (S.anim) {
    const { path, k } = S.anim, upto = Math.floor(k), f = k - upto, zz = S.z3 ? 10 : 0;
    const P = path.map(p => [p[0], p[1], zz]);
    const head = upto + 1 < P.length ? [P[upto][0] + (P[upto + 1][0] - P[upto][0]) * f, P[upto][1] + (P[upto + 1][1] - P[upto][1]) * f, zz] : P[P.length - 1];
    const trail = P.slice(0, upto + 1).concat([head]);
    L.push(new deck.PathLayer({ id: "trail", data: [trail], getPath: d => d, getColor: [60, 40, 140, 240], getWidth: 4, widthUnits: "pixels", jointRounded: true, capRounded: true }));
    L.push(new deck.ScatterplotLayer({ id: "sq-glow", data: [head], getPosition: d => d, getRadius: 16, radiusUnits: "pixels", getFillColor: [255, 176, 0, 90] }));
    L.push(new deck.IconLayer({ id: "sq", data: [{ p: head }], getPosition: d => d.p, getIcon: () => ({ url: SQ, width: 128, height: 128, anchorY: 96 }),
      getSize: 58, sizeUnits: "pixels", billboard: true }));
  }
  return L;
}
function redraw() { S.ver++; S.colDirty = true; if (overlay) overlay.setProps({ layers: deckLayers() }); }
function frame() { if (overlay) overlay.setProps({ layers: deckLayers() }); }   // camera / animation only: no recolouring

// ── panel ──
function kpis() {
  const s = S.stats, b = S.base || s;
  const d = (v, w) => v === w ? "" : (v > w ? "+" : "−") + fmt(Math.abs(v - w));
  $("#kpis").innerHTML = `<div class="kpi"><b>${fmt(s.groups)}</b><span>separate canopy groups</span><b class="d">${d(s.groups, b.groups)}</b></div>
    <div class="kpi"><b>${fmt(s.alone)}</b><span>trees standing alone in the lava</span><b class="d">${d(s.alone, b.alone)}</b></div>
    <div class="kpi"><b>${fmt(s.largest)}</b><span>trees in the largest group</span><b class="d">${d(s.largest, b.largest)}</b></div>`;
}
function select(node) {
  S.sel = node; S.anim = null;
  for (const f of S.parks.features) map.setFeatureState({ source: "parks", id: f.properties.id }, { reach: false });
  if (node < 0) { $("#sel").innerHTML = ""; redraw(); return; }
  const ro = S.root[node], N = S.N, NP = S.NP; const names = [];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let p = 0; p < NP; p++) if (S.root[N + p] === ro) { map.setFeatureState({ source: "parks", id: p }, { reach: true }); const pr = S.parks.features[p].properties; names.push(pr.name); }
  for (let i = 0; i < N; i++) if (S.root[i] === ro && !S.removed[i]) { const x = S.lon[i] * KX, y = S.lat[i] * KY; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const km = x1 > x0 ? Math.hypot(x1 - x0, y1 - y0) / 1000 : 0;
  const what = node < N ? "this tree" : node < N + NP ? `<b>${S.parks.features[node - N].properties.name}</b>` : "your new tree";
  $("#sel").innerHTML = `<div class="card">From ${what}, a squirrel reaches <b>${fmt(S.size[ro])} trees</b>${S.parksOf[ro] ? ` and <b>${S.parksOf[ro]} green area${S.parksOf[ro] > 1 ? "s" : ""}</b>` : ""}${km ? `, across <b>${km.toFixed(2)} km</b>` : ""} without touching the ground.
    ${names.length ? `<div class="fine" style="margin-top:4px">${[...new Set(names)].slice(0, 6).join(" · ")}${names.length > 6 ? " …" : ""}</div>` : ""}
    <div class="fine" style="margin-top:4px">Tap 🐿️ to see the longest path in this group.</div></div>`;
  redraw();
}
function refresh(keepSel = true) {
  compute(); kpis();
  if (keepSel && S.sel >= 0) select(S.sel); else redraw();
}

// ── tools ──
function plant(lon, lat, r = 4) {
  const x = lon * KX, y = lat * KY, N = S.N, NP = S.NP, links = [];
  const cx = Math.floor(x / 50), cy = Math.floor(y / 50);
  for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const i of S.grid.get(gx + "," + gy) || []) {
    const d = Math.hypot(S.lon[i] * KX - x, S.lat[i] * KY - y), g = d - r - S.r[i];
    if (g <= 4) links.push({ b: i, g: Math.max(g, -1), f: crossesMajor(x, y, S.lon[i] * KX, S.lat[i] * KY) ? 1 : 0 });
  }
  S.parks.features.forEach((f, p) => { const [bx0, by0, bx1, by1] = S.pbox[p]; if (lon < bx0 - 0.001 || lon > bx1 + 0.001 || lat < by0 - 0.0007 || lat > by1 + 0.0007) return;
    const g = polyDist(f, x, y) - r; if (g <= 4) links.push({ b: N + p, g: Math.max(g, -1), f: 0 }); });
  S.added.forEach((t, k) => { if (t.gone) return; const g = Math.hypot(t.x - x, t.y - y) - r - t.r; if (g <= 4) { links.push({ b: N + NP + k, g, f: 0 }); t.links.push({ b: N + NP + S.added.length, g, f: 0 }); } });
  const before = { ...S.stats };
  S.added.push({ lon, lat, x, y, r, links }); S.pos = null;
  refresh(false);
  const node = N + NP + S.added.length - 1;
  const merged = before.groups - S.stats.groups + 1;
  log(`🌳 New tree (8 m crown): ${links.filter(l => l.g <= S.jump).length} neighbour${links.length === 1 ? "" : "s"} in reach · ${merged > 1 ? `joins <b>${merged} groups</b> into one of ${fmt(S.size[S.root[node]])} trees` : merged === 1 ? "extends one group" : "stands alone"}${S.parksOf[S.root[node]] ? `, reaching ${S.parksOf[S.root[node]]} green areas` : ""}.`);
  select(node);
}
function chop(node) {
  const before = { ...S.stats };
  if (node < S.N) S.removed[node] = 1; else S.added[node - S.N - S.NP].gone = true;
  refresh(false);
  const split = S.stats.groups - before.groups + 1;
  log(`🪓 Tree removed · ${split > 1 ? `its group falls apart into <b>${split}</b>` : "no group split"}.`);
  select(-1);
}
function crossesMajor(x0, y0, x1, y1) {
  const mnx = Math.min(x0, x1), mxx = Math.max(x0, x1), mny = Math.min(y0, y1), mxy = Math.max(y0, y1);
  const o = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  for (const [a, b, c, d] of S.rsegs) {
    if (Math.max(a, c) < mnx || Math.min(a, c) > mxx || Math.max(b, d) < mny || Math.min(b, d) > mxy) continue;
    if (o(x0, y0, x1, y1, a, b) !== o(x0, y0, x1, y1, c, d) && o(a, b, c, d, x0, y0) !== o(a, b, c, d, x1, y1)) return true;
  }
  return false;
}
function polyDist(f, x, y) {
  let inside = false, best = 1e9;
  for (const ring of rings(f)) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0] * KX, yi = ring[i][1] * KY, xj = ring[j][0] * KX, yj = ring[j][1] * KY;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    const dx = xj - xi, dy = yj - yi, t = Math.max(0, Math.min(1, ((x - xi) * dx + (y - yi) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - xi - t * dx, y - yi - t * dy));
  }
  return inside ? 0 : best;
}
function log(html) { $("#log").innerHTML = html + ` <a href="#" id="reset" style="color:#8a8079">reset</a>`; $("#reset").onclick = e => { e.preventDefault(); S.added = []; S.removed.fill(0); S.pos = null; $("#log").innerHTML = ""; refresh(false); select(-1); }; }

// longest path inside the selected group (or the showcase route)
function route() {
  if (S.sel < 0) { const R = S.A.route; play(R.coords, R); return; }
  const ro = S.root[S.sel], N = S.N, NP = S.NP, nodes = [];
  const pos = n => n < N ? [S.lon[n], S.lat[n]] : n < N + NP ? S.A.park_pts[n - N] : [S.added[n - N - NP].lon, S.added[n - N - NP].lat];   // parks: safe islands, crossed via an inner point
  const adj = new Map(), add = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); };
  const ok = (g, f) => g <= S.jump && !(S.roads && (f & 1));
  for (let i = 0; i < S.M; i++) { const a = S.ea[i], b = S.eb[i]; if (S.root[a] === ro && ok(S.eg[i], S.ef[i]) && !S.removed[a] && !S.removed[b] && pos(a) && pos(b)) { add(a, b); add(b, a); } }
  S.added.forEach((t, k) => { const n = N + NP + k; if (S.root[n] !== ro || t.gone) return; for (const l of t.links) if (ok(l.g, l.f) && !(l.b >= N + NP && S.added[l.b - N - NP].gone)) { add(n, l.b); add(l.b, n); } });
  if (!adj.size) { $("#hint").textContent = "This tree has no neighbour in reach: it stands alone in the lava."; return; }
  const far = src => {                                  // Dijkstra (binary heap) over the crown links
    const dist = new Map([[src, 0]]), prev = new Map(), H = [[0, src]], done = new Set(); let best = src;
    const push = e => { H.push(e); let i = H.length - 1; while (i) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
    const pop = () => { const t = H[0], l = H.pop(); if (H.length) { H[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return t; };
    while (H.length) { const [du, u] = pop(); if (done.has(u)) continue; done.add(u); if (du > dist.get(best) && (u < N || u >= N + NP)) best = u;
      const [ux, uy] = pos(u); for (const v of adj.get(u) || []) { const [vx, vy] = pos(v), nd = du + Math.hypot((vx - ux) * KX, (vy - uy) * KY) + 0.1; if (!dist.has(v) || nd < dist.get(v)) { dist.set(v, nd); prev.set(v, u); push([nd, v]); } } }
    return { best, prev, dist }; };
  let start = -1; for (const n of adj.keys()) if (n < N && (start < 0 || n < start)) start = n;   // same start as the analysis: lowest tree id
  if (start < 0) start = adj.keys().next().value;
  const a = far(start).best, { best: b, prev, dist } = far(a);
  const path = [b]; while (path[path.length - 1] !== a) path.push(prev.get(path[path.length - 1]));
  const info = { km: dist.get(b) / 1000, trees: path.filter(n => n < N || n >= N + NP).length };
  S.lastRoute = info; play(path.reverse().map(pos), info);
  return info;
}
function play(coords, info) {
  S.lastPath = coords;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; coords.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  map.fitBounds([[x0, y0], [x1, y1]], { padding: 90, pitch: 50, duration: 1500, maxZoom: 17.5 });
  $("#hint").innerHTML = `🐿️ ${info.km.toFixed(2)} km over ${fmt(info.trees)} crowns without touching the ground${info.streets ? ` (${info.area}: ${info.streets.join(" → ")})` : ""}.`;
  const t0 = performance.now() + 1500, dur = Math.max(5000, coords.length * 90);
  const step = now => { const k = Math.max(0, Math.min(1, (now - t0) / dur)); S.anim = { path: coords, k: k * (coords.length - 1) }; frame(); if (k < 1 && !S.manual) requestAnimationFrame(step); };
  if (!S.manual) requestAnimationFrame(step);
}

function onClick(e) {
  const pick = overlay.pickObject({ x: e.point.x, y: e.point.y, radius: 4, layerIds: ["crowns", "crowns3d", "crit", "ext-ring"] });
  if (S.tool === "plant") { plant(e.lngLat.lng, e.lngLat.lat); return; }
  if (pick && (pick.layer.id === "crit" || pick.layer.id === "ext-ring")) { plant(pick.object.lon, pick.object.lat); return; }
  if (pick && (pick.layer.id === "crowns" || pick.layer.id === "crowns3d")) { const i = pick.layer.id === "crowns3d" ? S.v3.idx[pick.index] : pick.index, node = i < S.N ? i : i - S.N + S.N + S.NP; if (S.tool === "axe") chop(node); else select(node); return; }
  const f = map.queryRenderedFeatures(e.point, { layers: ["parks"] })[0];
  if (f) { select(S.N + f.properties.id); return; }
  select(-1);
}
function setTool(t) { S.tool = S.tool === t ? null : t; $("#t-plant").classList.toggle("on", S.tool === "plant"); $("#t-axe").classList.toggle("on", S.tool === "axe");
  $("#hint").textContent = S.tool === "plant" ? "Tap the map to plant a tree with an 8 m crown." : S.tool === "axe" ? "Tap a tree to remove it." : "Tap a tree or a park to see how far a squirrel gets from there."; }
function setJump(j) { S.jump = j; $("#jump").value = j; $("#jv").textContent = j + " m"; document.querySelectorAll("[data-j]").forEach(b => b.classList.toggle("on", +b.dataset.j === j)); S.base = null; refresh(); S.base = { ...S.stats }; kpis(); }

function curve() {
  const c = S.A.curve, W = 340, H = 120, P = 26, mx = Math.max(...c.map(d => d.groups)), ml = Math.max(...c.map(d => d.largest));
  const X = j => P + (W - P - 8) * j / 4, Y1 = v => H - 18 - (H - 32) * v / mx, Y2 = v => H - 18 - (H - 32) * v / ml;
  $("#curve").innerHTML = `<polyline fill="none" stroke="#ff5a1f" stroke-width="2" points="${c.map(d => X(d.jump) + "," + Y1(d.groups)).join(" ")}"/>
    <polyline fill="none" stroke="#168044" stroke-width="2" points="${c.map(d => X(d.jump) + "," + Y2(d.largest)).join(" ")}"/>
    ${[0, 1, 2, 3, 4].map(j => `<text x="${X(j)}" y="${H - 4}" fill="#8a8079" font-size="10" text-anchor="middle">${j} m</text>`).join("")}
    <text x="${P}" y="12" fill="#e04a12" font-size="10.5">groups: ${fmt(c[0].groups)} → ${fmt(c[c.length - 1].groups)}</text>
    <text x="${W - 8}" y="12" fill="#168044" font-size="10.5" text-anchor="end">largest: ${c[0].largest} → ${c[c.length - 1].largest} trees</text>`;
}

async function main() {
  initMap(); await load();
  S.crit = S.A.critical.slice(0, 12);
  const go = () => { if (S.ready) return true; if (!addLayers()) return false; S.ready = true; setJump(0); return true; };
  map.on("load", go); const p = setInterval(() => { if (S.ready) return clearInterval(p); if (map.isStyleLoaded() && go()) clearInterval(p); }, 300);
  document.querySelectorAll("[data-j]").forEach(b => b.onclick = () => setJump(+b.dataset.j));
  $("#jump").oninput = e => setJump(+e.target.value);
  $("#roads").onchange = e => { S.roads = e.target.checked; S.base = null; refresh(); S.base = { ...S.stats }; kpis(); };
  $("#t-plant").onclick = () => setTool("plant"); $("#t-axe").onclick = () => setTool("axe"); $("#t-route").onclick = () => route();
  $("#crit").innerHTML = S.crit.slice(0, 8).map((c, i) => `<li data-i="${i}">joins ${c.a} + ${c.b} trees <span>· gap ${c.gap_m} m${c.parks ? ` · ${c.parks} green areas` : ""}</span></li>`).join("");
  document.querySelectorAll("#crit li").forEach(li => li.onclick = () => { const c = S.crit[+li.dataset.i]; if (S.jump < 2) setJump(2);
    map.flyTo({ center: [c.lon, c.lat], zoom: 17, pitch: 45, duration: 1600 }); setTimeout(() => plant(c.lon, c.lat), 1700); });
  curve();
  // route extension: the suggested trees, and a button that plants them and runs the squirrel again
  S.ext = (S.A.extend && S.A.extend.trees) || []; S.showExt = S.ext.length > 0;
  if (S.ext.length) { $("#t-ext").textContent = `🌱 Plant ${S.ext.length} trees to extend the longest route`; $("#t-ext").onclick = () => extendRoute(); } else $("#t-ext").style.display = "none";
  map.on("move", () => { if (S.ready) frame(); });
  const pulse = () => { if (S.ready && S.showExt && !S.manual && !S.anim) frame(); setTimeout(() => requestAnimationFrame(pulse), 60); }; pulse();
  $("#bop").oninput = e => { S.bOp = +e.target.value; if (map.getLayer("buildings")) map.setPaintProperty("buildings", "fill-extrusion-opacity", S.bOp); $("#bopv").textContent = Math.round(S.bOp * 100) + "%"; };
}
// plant the suggested trees next to the largest group, then show how much longer the squirrel's route gets
function routeNode() { const [x, y] = S.A.route.coords[0]; let best = 0, bd = 1e9; for (let i = 0; i < S.N; i++) { const d = (S.lon[i] - x) ** 2 + (S.lat[i] - y) ** 2; if (d < bd) { bd = d; best = i; } } return best; }
function extendRoute(opts = {}) {
  if (S.jump !== 2) setJump(2);
  S.added = []; S.pos = null; refresh(false);
  const rn = S.routeNode ?? (S.routeNode = routeNode());
  select(rn); const quiet = () => { const m = S.manual; S.manual = true; const r = route(); S.manual = m; return r; };
  const before = quiet();
  const sz0 = S.size[S.root[rn]];
  for (const t of S.ext) plant(t.lon, t.lat);
  select(rn); S.anim = null;
  const after = opts.noPlay ? quiet() : route();
  const msg = `🌱 ${S.ext.length} new trees: the group grows from ${fmt(sz0)} to <b>${fmt(S.size[S.root[rn]])} trees</b>, and the longest route from ${before.km.toFixed(2)} to <b>${after.km.toFixed(2)} km</b>.`;
  log(msg); S.extResult = { before: before.km, after: after.km, sz0, sz1: S.size[S.root[rn]], n: S.ext.length };
  return S.extResult;
}
main();
