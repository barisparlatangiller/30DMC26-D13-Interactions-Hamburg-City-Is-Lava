// "Can a squirrel cross Hamburg?" — 41 s LinkedIn film, filmed from the live site (1080×1350, 24 fps).
// One camera move: a street at crown level → the whole city → canopy islands → Stellingen → the longest path → five new trees
// → real squirrel sightings appearing year by year → end card.
//   node pipeline/film.mjs            SHARD=i NSHARD=n renders frame block i of n · FRAMES=12,300 renders single test frames
import { chromium } from "playwright";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json", ".bin": "application/octet-stream" };
http.createServer((req, res) => {
  const u = decodeURIComponent(new globalThis.URL(req.url, "http://x").pathname);
  const f = path.join("docs", u.endsWith("/") ? u + "index.html" : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Content-Length": fs.statSync(f).size });
  fs.createReadStream(f).pipe(res);
}).listen(8001);

const URL = "http://localhost:8001/#explore", FR = process.env.CUT === "short" ? "film/frames_short" : process.env.CUT === "loop" ? "film/frames_loop" : "film/frames", FPS = 24;
fs.mkdirSync(FR, { recursive: true });
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"];
const br = await chromium.launch({ args: ARGS, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const NM = process.env.NM || "node_modules/";
const p = await br.newPage({ viewport: { width: 1080, height: 1350 } });
p.setDefaultTimeout(240000);
if (process.env.LOCAL) {   // sandbox test without CDN / basemap access
  await p.route(/cdn\.jsdelivr\.net/, r => { const u = r.request().url(); const f = u.includes("deck.gl") ? NM + "deck.gl/dist.min.js" : u.endsWith(".css") ? NM + "maplibre-gl/dist/maplibre-gl.css" : NM + "maplibre-gl/dist/maplibre-gl.js";
    r.fulfill({ path: f, contentType: f.endsWith("css") ? "text/css" : "application/javascript" }); });
  await p.route(/basemaps\.cartocdn/, r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#f2f0ea" } }] }) }));
  await p.route(/fonts\.g|openfreemap/, r => r.abort());
}
p.on("pageerror", e => console.log("pageerror:", e.message));
await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForFunction(() => window.S && S.ready && window.Story, null, { timeout: 180000 });
await p.waitForTimeout(1500);
const settle = () => p.evaluate(() => new Promise(r => { let d = false; const f = () => { if (!d) { d = true; setTimeout(r, 30); } }; S.map.once("idle", f); S.map.triggerRepaint(); setTimeout(f, 4000); }));

// ── stage: full-bleed map, captions only ──
await p.addStyleTag({ content: `
  .top, .story, .panel, .legend, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-right { display: none !important; }
  .fade { position: absolute; left: 0; right: 0; top: 0; height: 540px; z-index: 4; pointer-events: none;
    background: linear-gradient(180deg, rgba(247,245,240,.95) 0, rgba(247,245,240,.82) 240px, rgba(247,245,240,0) 540px); }
  .cap { position: absolute; z-index: 6; left: 54px; right: 54px; top: 96px; text-align: center; font-family: "Source Serif 4", Georgia, serif;
    font-weight: 700; font-size: 72px; line-height: 1.04; letter-spacing: -.015em; color: #1c1b19; }
  .cap .s { display: block; font-family: Inter, sans-serif; font-weight: 500; font-size: 29px; letter-spacing: 0; color: #4d4943; margin-top: 20px; line-height: 1.35; }
  .cap .num { font-size: 150px; letter-spacing: -.03em; display: block; line-height: 1; font-variant-numeric: tabular-nums; }
  .cap .k { display: block; font-family: Inter, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #2f6b3a; margin-bottom: 18px; }
  .g { color: #2f6b3a; } .a { color: #c97d05; } .br { color: #9a6a44; } .p { color: #d6006e; } .r { color: #b04014; } .bl { color: #1d3aa0; }
  .yr { position: absolute; z-index: 6; right: 54px; bottom: 120px; font-family: "Source Serif 4", Georgia, serif; font-weight: 700; font-size: 96px; color: #b04014; opacity: 0;
    text-shadow: 0 2px 18px rgba(247,245,240,.9); font-variant-numeric: tabular-nums; }
  .chip { position: absolute; z-index: 6; left: 50px; right: 50px; top: 70px; font-family: "Source Serif 4", Georgia, serif; font-weight: 700; font-size: 64px; line-height: 1.06; color: #1c1b19; letter-spacing: -.015em; }
  .chip .s { display: block; font-family: Inter, sans-serif; font-weight: 600; font-size: 26px; color: #4d4943; margin-top: 14px; letter-spacing: 0; }
  .meter { position: absolute; z-index: 6; left: 50px; right: 50px; bottom: 70px; display: flex; align-items: flex-end; justify-content: space-between; opacity: 0;
    font-family: Inter, sans-serif; color: #1c1b19; }
  .meter .n { font-family: "Source Serif 4", Georgia, serif; font-weight: 700; font-size: 132px; line-height: .9; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
  .meter .l { font-size: 28px; font-weight: 600; color: #4d4943; margin-top: 10px; }
  .meter .j { text-align: right; } .meter .j b { display: block; font-family: "Source Serif 4", Georgia, serif; font-size: 72px; color: #c97d05; font-variant-numeric: tabular-nums; }
  .meter .j span { font-size: 24px; font-weight: 600; color: #4d4943; }
  .bfade { position: absolute; left: 0; right: 0; bottom: 0; height: 460px; z-index: 4; pointer-events: none; opacity: 0;
    background: linear-gradient(0deg, rgba(247,245,240,.96) 0, rgba(247,245,240,.85) 220px, rgba(247,245,240,0) 460px); }
  .end { position: absolute; inset: 0; z-index: 8; background: #f7f5f0; display: flex; flex-direction: column; justify-content: center; padding: 0 76px; opacity: 0; }
  .end h2 { font-family: "Source Serif 4", Georgia, serif; text-transform: none; font-size: 96px; font-weight: 700; line-height: 1.02; letter-spacing: -.02em; margin: 0; color: #1c1b19; }
  .end h2 span { color: #2f6b3a; }
  .end .u { font-family: Inter; font-size: 30px; font-weight: 600; color: #1c1b19; margin-top: 60px; } .end .u b { color: #2f6b3a; }
  .end .a2 { font-family: Inter; font-size: 17px; color: #8b857c; position: absolute; left: 76px; right: 76px; bottom: 58px; line-height: 1.5; }
` });
await p.evaluate(() => {
  S.manual = true; S.showExt = false; S.showCrit = false; S.map.resize();
  document.body.classList.remove("story-on");
  document.body.insertAdjacentHTML("beforeend", `<div class="fade" id="fade"></div><div class="bfade" id="bfade"></div><div class="cap" id="cap"></div><div class="chip" id="chip"></div><div class="yr" id="yr"></div>
    <div class="meter" id="meter"><div><div class="n" id="mn"></div><div class="l">separate canopy islands</div></div><div class="j"><b id="mj"></b><span>jump allowed</span></div></div>
    <div class="end" id="end"><h2>We count trees.<br><span>Squirrels count connections.</span></h2>
    <div class="u">Explore the map: <b>barisparlatangiller.github.io</b></div>
    <div class="a2">#30DayMapChallenge · Day 13 · Interactions · Hamburg<br>Street-tree register & Digitaler Grünplan © FHH/BUKEA (dl-de/by-2-0) · sightings via GBIF.org · roads & buildings © OpenStreetMap (ODbL) · © CARTO.
    Positions, crown widths, trunks and species are from the register; tree heights are estimated. A link is a possible path, not an observed squirrel.</div></div>`);
  S.sightAll = S.sight || [];
  const c = S.A.route.coords; const cum = [0];
  for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + Math.hypot((c[i][0] - c[i - 1][0]) * KX, (c[i][1] - c[i - 1][1]) * KY));
  S.routeCum = cum;
  S.routeNode = S.routeNode ?? routeNode();
});

// ── one frame ──
const scene = o => p.evaluate(o => {
  const J = o.jump ?? 2; if (S.jump !== J) setJump(J);
  S.manual = true; S.showCrit = false;
  const want = o.sel ? S.routeNode : -1;
  if (!o.keep && want !== S.sel) select(want);
  if (o.ext && !S.extResult) { extendRoute({ noPlay: true }); S.extPath = S.lastPath; select(S.routeNode); }
  S.showExt = !!o.ext;
  S.pulse = (S.pulse || 0) + 0.3;
  if (o.year != null) { S.showSight = true; const y = o.year; S.sight = S.sightAll.filter(r => r[2] <= y); } else { S.showSight = false; }
  if (o.anim != null) { const c = o.ext ? S.extPath : S.A.route.coords; S.anim = { path: c, k: o.anim * (c.length - 1) }; } else S.anim = null;
  if (S.map.getLayer("buildings")) S.map.setPaintProperty("buildings", "fill-extrusion-opacity", o.bld ?? 0.8);
  S.map.jumpTo({ center: o.center, zoom: o.zoom, pitch: o.pitch || 0, bearing: o.bearing || 0 });
  frame();
  // captions
  let html = o.cap || "";
  if (o.counter != null) {
    const K = o.counter * (S.routeCum.length - 1), i = Math.floor(K), f = K - i;
    const m = i + 1 < S.routeCum.length ? S.routeCum[i] + (S.routeCum[i + 1] - S.routeCum[i]) * f : S.routeCum[S.routeCum.length - 1];
    html = `<span class="k">The longest path</span><span class="num bl">${(m / 1000).toFixed(2)} km</span><span class="s">${Math.round(o.counter * S.A.route.trees)} crowns, never touching the ground</span>`;
  }
  if (o.extCounter != null && S.extResult) {
    const X = S.extResult, km = X.before + (X.after - X.before) * o.extCounter;
    html = `<span class="k">Plant ${X.n} trees in the right gaps</span><span class="num p">${km.toFixed(2)} km</span><span class="s">The path grows by <b class="p">${Math.round((X.after / X.before - 1) * 100)}%</b>, the island to ${fmt(X.sz1)} trees</span>`;
  }
  if (o.year != null) {
    html = `<span class="k">Real squirrels</span><span class="r">${fmt(S.sight.length)}</span> red-squirrel sightings<span class="s">4 in 5 are outside public green space, mostly in gardens the tree register does not cover.</span>`;
    const yr = document.getElementById("yr"); yr.textContent = o.year; yr.style.opacity = o.yrA ?? 1;
  } else document.getElementById("yr").style.opacity = 0;
  const cap = document.getElementById("cap"); if (cap.dataset.h !== html) { cap.innerHTML = html; cap.dataset.h = html; }
  cap.style.opacity = o.capA ?? 1; cap.style.transform = `translateY(${(1 - (o.capA ?? 1)) * 14}px)`;
  document.getElementById("fade").style.opacity = o.fadeA ?? 1;
  const ch = document.getElementById("chip"), chH = o.chip || ""; if (ch.dataset.h !== chH) { ch.innerHTML = chH; ch.dataset.h = chH; } ch.style.opacity = o.chipA ?? (chH ? 1 : 0);
  const me = document.getElementById("meter"); me.style.opacity = o.meterA || 0; document.getElementById("bfade").style.opacity = o.meterA || 0;
  if (o.meterA) { document.getElementById("mn").textContent = fmt(Math.round(o.islands)); document.getElementById("mj").textContent = J.toFixed(1) + " m"; }
  document.getElementById("end").style.opacity = o.end || 0;
}, o);

// ── camera plan ──
const ease = k => k * k * (3 - 2 * k), lerp = (a, b, k) => a + (b - a) * k, cl = x => Math.max(0, Math.min(1, x));
function cam(A, B, k) {     // zoom-aware: the centre follows the zoom so the target stays in view
  const z = lerp(A.zoom, B.zoom, k), s0 = 2 ** -A.zoom, s1 = 2 ** -B.zoom, w = Math.abs(s1 - s0) < 1e-12 ? k : (2 ** -z - s0) / (s1 - s0);
  return { center: [lerp(A.center[0], B.center[0], w), lerp(A.center[1], B.center[1], w)], zoom: z, pitch: lerp(A.pitch || 0, B.pitch || 0, k), bearing: lerp(A.bearing || 0, B.bearing || 0, k) };
}
const R = await p.evaluate(() => { const c = S.A.route.coords; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; c.concat(S.ext.map(d => [d.lon, d.lat])).forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  return { st: c[84], st2: c[94], mid: [(x0 + x1) / 2, (y0 + y1) / 2], n: c.length }; });
const S0 = 84 / (R.n - 1), S1 = 94 / (R.n - 1);
const CLOSE0 = { center: [R.st[0] + 0.0001, R.st[1] - 0.0003], zoom: 18.7, pitch: 66, bearing: -150 };
const CLOSE0b = { ...CLOSE0, zoom: 18.45, bearing: -166 };
const CLOSE1 = { center: [R.st2[0] + 0.0001, R.st2[1] - 0.0005], zoom: 17.5, pitch: 62, bearing: -182 };
const CITY = { center: [10.0, 53.572], zoom: 10.95, pitch: 30, bearing: -8 };
const INNER = { center: [9.966, 53.574], zoom: 13.6, pitch: 52, bearing: -20 };
const INNER2 = { ...INNER, zoom: 14.1, bearing: -30, center: [9.962, 53.5755] };
const ROUTE = { center: [R.mid[0] + 0.0005, R.mid[1] - 0.0022], zoom: 15.15, pitch: 55, bearing: -18 };
const ROUTE2 = { ...ROUTE, zoom: 15.25, bearing: -8 };
const ROUTE3 = { ...ROUTE2, zoom: 15.05, bearing: 2 };
const SEEN = { center: [10.0, 53.58], zoom: 10.85, pitch: 18, bearing: 0 };

const SHORT = process.env.CUT === "short", D = (full, short) => SHORT ? short : full;   // short cut: about 32 s, same story
const plan = [], sec = s => Math.round(s * FPS);
const seg = (s, fn) => { const n = sec(s); for (let i = 0; i < n; i++) plan.push(fn(n > 1 ? i / (n - 1) : 1, i / FPS, s)); };
const fade = (t, s, a = 0.35, b = 0.3) => Math.min(ease(cl(t / a)), ease(cl((s - t) / b)));
const C1 = `Can a squirrel cross Hamburg<span class="s">without ever touching the ground?</span>`;
// A 0–4.5 s: one street, crown level; the squirrel waits on its tree
seg(D(4.5, 3.0), (k, t, s) => ({ ...cam(CLOSE0, CLOSE0b, ease(k)), anim: S0, cap: C1, capA: fade(t, s, 0.6, 0.01) }));
// B 4.5–8.5 s: it runs along the crowns, the camera follows and rises
seg(D(4.0, 2.6), (k, t, s) => ({ ...cam(CLOSE0b, CLOSE1, ease(k)), anim: lerp(S0, S1, ease(k)), cap: C1, capA: fade(t + 1, s + 1, 0.01, 0.4) }));
// C 8.5–13 s: up and out to the whole city
seg(D(4.5, 3.4), (k, t, s) => ({ ...cam(CLOSE1, CITY, ease(k)), anim: k < 0.25 ? S1 : null,
  cap: `<span class="g">228,091</span> street trees<span class="s">Every one in the city register, at its real crown width.</span>`, capA: fade(t - 1.8, s - 1.8) }));
// D 13–17 s: into the inner city — the canopy breaks into islands
seg(D(4.0, 3.4), (k, t, s) => ({ ...cam(CITY, INNER, ease(k)), bld: lerp(0.8, 0.3, ease(k)),
  cap: `They form <span class="g">100,024</span> islands<span class="s">Crowns connect if they touch or are ≤ 2 m apart. Parks are safe ground.</span>`, capA: fade(t - 0.6, s - 0.6) }));
// E 17–20.5 s: lone trees
seg(D(3.5, 2.6), (k, t, s) => ({ ...cam(INNER, INNER2, ease(k)), bld: 0.3,
  cap: `<span class="br">1 in 3 trees</span> stands alone<span class="s">${"71,883"} crowns with no neighbour within reach.</span>`, capA: fade(t, s) }));
// F 20.5–24 s: Stellingen, the largest island lights up
seg(D(3.5, 2.8), (k, t, s) => ({ sel: k > 0.55, ...cam(INNER2, ROUTE, ease(k)), bld: lerp(0.3, 0.8, ease(k)),
  cap: `The largest island<span class="s"><b class="a">324 trees</b> and 36 green areas in Stellingen, next to the zoo.</span>`, capA: fade(t - 1.1, s - 1.1) }));
// G 24–28.5 s: the squirrel runs the longest path
seg(D(4.5, 3.6), (k, t, s) => ({ sel: true, ...cam(ROUTE, ROUTE2, ease(k)), anim: ease(cl(k * 1.15)), counter: ease(cl(k * 1.15)), capA: fade(t, s + 1, 0.3, 0.01) }));
// H 28.5–33 s: five new trees, a longer run
seg(D(4.5, 3.6), (k, t, s) => ({ sel: true, keep: true, ext: true, ...cam(ROUTE2, ROUTE3, ease(k)), anim: ease(cl(k * 1.2)), extCounter: ease(cl(k * 1.2)), capA: fade(t, s, 0.3, 0.3) }));
// I 33–38 s: real sightings appear year by year across the city
seg(D(5.0, 4.0), (k, t, s) => ({ ...cam(ROUTE3, SEEN, ease(cl(k * 1.6))), year: Math.round(lerp(2010, 2026, ease(cl((t - 0.9) / (s - 1.7))))), yrA: fade(t - 0.9, s - 0.9, 0.3, 0.4), capA: fade(t - 0.9, s - 0.9, 0.4, 0.4) }));
// J 38–42 s: end card
seg(D(4.0, 3.0), (k, t) => ({ ...SEEN, year: 2026, yrA: 0, capA: 0, fadeA: 1 - ease(cl(t / 0.6)), end: ease(cl(t / 0.6)) }));

// ── 12 s loop: the result in one move (the Day 5 recipe) ──
if (process.env.CUT === "loop") {
  plan.length = 0;
  await p.evaluate(() => { S.sqPx = 100; });   // the squirrel twice its site size, so it reads on a phone
  const RC = await p.evaluate(() => S.A.route.coords);
  const at = q => { const K = q * (RC.length - 1), i = Math.min(RC.length - 2, Math.floor(K)), f = K - i; return [RC[i][0] + (RC[i + 1][0] - RC[i][0]) * f, RC[i][1] + (RC[i + 1][1] - RC[i][1]) * f]; };
  const follow = (q, base) => { const [x, y] = at(q), [x0, y0] = R.st; return { ...base, center: [base.center[0] + (x - x0), base.center[1] + (y - y0)] }; };   // keep the squirrel in frame
  const CUR = await p.evaluate(() => S.A.curve.map(c => [c.jump, c.groups]));
  const islandsAt = j => { for (let i = 1; i < CUR.length; i++) if (j <= CUR[i][0]) { const [a, ga] = CUR[i - 1], [b, gb] = CUR[i]; return ga + (gb - ga) * (j - a) / (b - a); } return CUR[CUR.length - 1][1]; };
  const Q = `Can a squirrel cross Hamburg<span class="s">without ever touching the ground?</span>`;
  const MID = { center: [9.9585, 53.5745], zoom: 15.7, pitch: 52, bearing: -24 };
  // 0–2.6 s: crown level, the squirrel hops; the question
  seg(3.0, (k, t, s) => ({ ...follow(lerp(S0, S0 + 4 / (R.n - 1), k), cam(CLOSE0, CLOSE0b, ease(k))), anim: lerp(S0, S0 + 4 / (R.n - 1), k), chip: Q, chipA: fade(t, s + 1, 0.25, 0.01), cap: "", capA: 0 }));
  // 2.6–4.8 s: straight up over the inner city; islands show (jump 0 m)
  const END = follow(S0 + 4 / (R.n - 1), CLOSE0b), UP = { ...END, zoom: 16.4, pitch: 56 };
  seg(2.2, (k, t, s) => ({ ...(k < 0.45 ? cam(END, UP, ease(k / 0.45)) : cam(UP, MID, ease((k - 0.45) / 0.55))), jump: k < 0.5 ? 2 : 0,
    anim: k < 0.42 ? S0 + 4 / (R.n - 1) : null, bld: lerp(0.8, 0.3, ease(k)), chip: Q, chipA: 1 - ease(cl((t - 1.4) / 0.6)),
    meterA: ease(cl((t - 1.6) / 0.5)), islands: islandsAt(0), capA: 0 }));
  // 4.8–10.2 s: the squirrel learns to jump: 0 → 4 m in 0.5 m steps, the map recolours, the count falls
  seg(5.0, (k, t, s) => { const j = Math.min(4, Math.floor(t / 0.55) * 0.5); return { ...cam(MID, { ...MID, zoom: 15.5, bearing: -32 }, k), jump: j, bld: 0.3,
    chip: `What if it could jump further?`, chipA: ease(cl(t / 0.3)), meterA: 1, islands: islandsAt(j), capA: 0 }; });
  // 10.2–12 s: the answer
  seg(1.8, (k, t, s) => ({ ...cam({ ...MID, zoom: 15.5, bearing: -32 }, { ...MID, zoom: 15.4, bearing: -34 }, k), jump: 4, bld: 0.3,
    chip: `No.<span class="s">Even 4 m jumps leave 70,821 islands. Street trees grow in rows, and the rows rarely meet.</span>`, chipA: ease(cl(t / 0.25)), meterA: 1, islands: islandsAt(4), capA: 0 }));
}

// ── render ──
const SHARD = +(process.env.SHARD || 0), NSHARD = +(process.env.NSHARD || 1);
const lo = Math.floor(plan.length * SHARD / NSHARD), hi = Math.floor(plan.length * (SHARD + 1) / NSHARD);
const ONLY = process.env.FRAMES ? new Set(process.env.FRAMES.split(",").map(Number)) : null;
await scene(plan[Math.min(sec(26), plan.length - 1)]); await settle(); await p.waitForTimeout(1500);      // warm-up: icons and fonts
await p.evaluate(() => { S.added = []; S.pos = null; S.extResult = null; S.showExt = false; refresh(false); select(-1); });
for (let n = 0; n < plan.length; n++) {
  if (ONLY ? !ONLY.has(n) : (n < lo || n >= hi)) continue;
  for (let tries = 0; ; tries++) {
    try {
      await scene(plan[n]); await settle();
      await p.screenshot({ path: `${FR}/f${String(n).padStart(4, "0")}.jpg`, type: "jpeg", quality: 93, timeout: 240000 });
      break;
    } catch (e) { console.log("retry frame", n, e.message.split("\n")[0]); if (tries >= 2) throw e; await p.waitForTimeout(3000); }
  }
  if (n % 24 === 0) console.log("frame", n, "/", plan.length, new Date().toISOString());
}
console.log(`shard ${SHARD}: frames ${lo}–${hi - 1} of ${plan.length}`);
await br.close(); process.exit(0);
