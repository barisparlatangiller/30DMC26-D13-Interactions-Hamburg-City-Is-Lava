// "Can a squirrel cross Hamburg?" — 36 s LinkedIn film, filmed from the live map (1080×1350, 24 fps).
// One camera move: a street close-up → the whole city → canopy islands → into Stellingen → the longest route → 5 new trees.
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

const URL = "http://localhost:8001/", FR = "film/frames", FPS = 24;
fs.mkdirSync(FR, { recursive: true });
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"];
const br = await chromium.launch({ args: ARGS, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const NM = process.env.NM || "node_modules/";
const p = await br.newPage({ viewport: { width: 1080, height: 1350 } });
if (process.env.LOCAL) {   // sandbox test without CDN / basemap access
  await p.route(/cdn\.jsdelivr\.net/, r => { const u = r.request().url(); const f = u.includes("deck.gl") ? NM + "deck.gl/dist.min.js" : u.endsWith(".css") ? NM + "maplibre-gl/dist/maplibre-gl.css" : NM + "maplibre-gl/dist/maplibre-gl.js";
    r.fulfill({ path: f, contentType: f.endsWith("css") ? "text/css" : "application/javascript" }); });
  await p.route(/basemaps\.cartocdn/, r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#f3f1ed" } }] }) }));
  await p.route(/fonts\.g|openfreemap/, r => r.abort());
}
p.on("pageerror", e => console.log("pageerror:", e.message));
await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForFunction(() => window.S && S.ready, null, { timeout: 180000 });
const settle = () => p.evaluate(() => new Promise(r => { let d = false; const f = () => { if (!d) { d = true; setTimeout(r, 30); } }; S.map.once("idle", f); S.map.triggerRepaint(); setTimeout(f, 4000); }));

// ── stage: full-bleed map, captions only ──
await p.addStyleTag({ content: `
  .panel, .legend, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-right { display: none !important; }
  #map, #glow { inset: 0 !important; } #glow { display: none; }
  .fade { position: absolute; left: 0; right: 0; top: 0; height: 520px; z-index: 4; pointer-events: none;
    background: linear-gradient(180deg, rgba(250,249,247,.94) 0, rgba(250,249,247,.78) 230px, rgba(250,249,247,0) 520px); }
  .cap { position: absolute; z-index: 6; left: 50px; right: 50px; top: 92px; text-align: center; font-family: "Bricolage Grotesque", Inter, sans-serif;
    font-weight: 800; font-size: 74px; line-height: 1.02; letter-spacing: -.025em; color: #1b1714; }
  .cap .s { display: block; font-family: Inter, sans-serif; font-weight: 600; font-size: 30px; letter-spacing: 0; color: #4a423c; margin-top: 18px; line-height: 1.3; }
  .cap .num { font-size: 150px; letter-spacing: -.04em; display: block; line-height: 1; }
  .g { color: #15803d; } .o { color: #ea580c; } .b { color: #3b8fb0; } .p { color: #d4006f; }
  .end { position: absolute; inset: 0; z-index: 8; background: #faf9f7; display: flex; flex-direction: column; justify-content: center; padding: 0 70px;
    font-family: "Bricolage Grotesque", Inter; opacity: 0; }
  .end h2 { text-transform: none; font-size: 92px; font-weight: 800; line-height: 1; letter-spacing: -.035em; margin: 0; color: #1b1714; } .end h2 span { color: #ea580c; }
  .end .u { font-family: Inter; font-size: 30px; font-weight: 600; color: #15803d; margin-top: 56px; }
  .end .a { font-family: Inter; font-size: 17px; color: #8a8079; position: absolute; left: 70px; right: 70px; bottom: 56px; line-height: 1.5; }
` });
await p.evaluate(() => {
  S.manual = true; S.showExt = false; S.map.resize();
  document.body.insertAdjacentHTML("beforeend", `<div class="fade" id="fade"></div><div class="cap" id="cap"></div>
    <div class="end" id="end"><h2>We count trees.<br><span>Squirrels count connections.</span></h2>
    <div class="u">Plant or cut trees yourself · barisparlatangiller.github.io</div>
    <div class="a">#30DayMapChallenge · Day 13 · Interactions · Hamburg<br>Street-tree register & Digitaler Grünplan © FHH/BUKEA (dl-de/by-2-0) · roads & buildings © OpenStreetMap (ODbL) · © CARTO.
    Positions, crown widths, trunks and species are from the register; tree heights are estimated. A link is a possible path, not an observed squirrel.</div></div>`);
  // the site's colours, and a natural green palette for the opening
  S.SITE = { g50: [...C.g50], g10: [...C.g10], g2: [...C.g2], alone: [...C.alone] };
  S.NAT = { g50: [64, 140, 62], g10: [74, 148, 68], g2: [84, 152, 74], alone: [92, 150, 80] };
  const c = S.A.route.coords; const cum = [0];
  for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + Math.hypot((c[i][0] - c[i - 1][0]) * KX, (c[i][1] - c[i - 1][1]) * KY));
  S.routeCum = cum;
  const [x, y] = c[0]; let best = 0, bd = 1e9;
  for (let i = 0; i < S.N; i++) { const d = (S.lon[i] - x) ** 2 + (S.lat[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
  S.routeNode = best;
});

// ── one frame ──
const scene = o => p.evaluate(o => {
  if (S.jump !== 2) setJump(2);
  const pal = o.natural ? S.NAT : S.SITE;
  if (S.palNow !== pal) { Object.assign(C, pal); S.palNow = pal; redraw(); }
  const want = o.sel ? S.routeNode : -1;
  if (!o.keep && want !== S.sel) select(want);
  if (o.ext && !S.extResult) { extendRoute({ noPlay: true }); S.extPath = S.lastPath; }
  S.showExt = !!o.ext;
  S.pulse = (S.pulse || 0) + 0.3;
  if (o.anim != null) { const c = o.ext ? S.extPath : S.A.route.coords; S.anim = { path: c, k: o.anim * (c.length - 1) }; } else S.anim = null;
  S.map.jumpTo({ center: o.center, zoom: o.zoom, pitch: o.pitch || 0, bearing: o.bearing || 0 });
  frame();
  // captions
  let html = o.cap || "";
  if (o.counter != null) {
    const K = o.counter * (S.routeCum.length - 1), i = Math.floor(K), f = K - i;
    const m = i + 1 < S.routeCum.length ? S.routeCum[i] + (S.routeCum[i + 1] - S.routeCum[i]) * f : S.routeCum[S.routeCum.length - 1];
    html = `<span class="num g">${(m / 1000).toFixed(2)} km</span><span class="s">through ${Math.round(o.counter * 102)} crowns, never touching the ground</span>`;
  }
  if (o.extCounter != null && S.extResult) {
    const X = S.extResult, km = X.before + (X.after - X.before) * o.extCounter;
    html = `<span class="num p">${km.toFixed(2)} km</span><span class="s">${X.n} new trees in the right gaps: <b class="p">+${Math.round((X.after / X.before - 1) * 100)}%</b></span>`;
  }
  const cap = document.getElementById("cap"); if (cap.dataset.h !== html) { cap.innerHTML = html; cap.dataset.h = html; }
  cap.style.opacity = o.capA ?? 1; cap.style.transform = `translateY(${(1 - (o.capA ?? 1)) * 14}px)`;
  document.getElementById("end").style.opacity = o.end || 0;
}, o);

// ── camera plan ──
const ease = k => k * k * (3 - 2 * k), lerp = (a, b, k) => a + (b - a) * k, cl = x => Math.max(0, Math.min(1, x));
function cam(A, B, k) {     // zoom-aware: the centre follows the zoom so the target stays in view
  const z = lerp(A.zoom, B.zoom, k), s0 = 2 ** -A.zoom, s1 = 2 ** -B.zoom, w = Math.abs(s1 - s0) < 1e-12 ? k : (2 ** -z - s0) / (s1 - s0);
  return { center: [lerp(A.center[0], B.center[0], w), lerp(A.center[1], B.center[1], w)], zoom: z, pitch: lerp(A.pitch || 0, B.pitch || 0, k), bearing: lerp(A.bearing || 0, B.bearing || 0, k) };
}
const R = await p.evaluate(() => { const c = S.A.route.coords; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; c.concat(S.ext.map(d => [d.lon, d.lat])).forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  return { start: c[0], s8: c[8], mid: [(x0 + x1) / 2, (y0 + y1) / 2] }; });
const CLOSE0 = { center: [R.start[0] + 0.00005, R.start[1] - 0.00025], zoom: 18.7, pitch: 64, bearing: -150 };
const CLOSE1 = { center: [R.s8[0], R.s8[1] - 0.0004], zoom: 17.6, pitch: 62, bearing: -175 };
const CITY = { center: [10.0, 53.575], zoom: 10.95, pitch: 28, bearing: -8 };
const INNER = { center: [9.968, 53.574], zoom: 13.1, pitch: 50, bearing: -20 };
const ROUTE = { center: [R.mid[0] + 0.0005, R.mid[1] - 0.0022], zoom: 15.15, pitch: 55, bearing: -18 };
const ROUTE2 = { ...ROUTE, zoom: 15.25, bearing: -8 };

const plan = [], sec = s => Math.round(s * FPS);
const seg = (s, fn) => { const n = sec(s); for (let i = 0; i < n; i++) plan.push(fn(n > 1 ? i / (n - 1) : 1, i / FPS, s)); };
const fade = (t, s, a = 0.35, b = 0.3) => Math.min(ease(cl(t / a)), ease(cl((s - t) / b)));
const C1 = `Can a squirrel cross Hamburg<span class="s">without ever touching the ground?</span>`;
// A 0–4 s: one street, crown level; the squirrel waits
seg(4.0, (k, t, s) => ({ natural: true, ...cam(CLOSE0, { ...CLOSE0, zoom: 18.45, bearing: -165 }, ease(k)), anim: 0, cap: C1, capA: fade(t, s, 0.5, 0.01) }));
// B 4–8 s: it runs along the crowns, the camera follows and rises
seg(4.0, (k, t, s) => ({ natural: true, ...cam({ ...CLOSE0, zoom: 18.45, bearing: -165 }, CLOSE1, ease(k)), anim: 0.09 * ease(k), cap: C1, capA: fade(t + 1, s + 1, 0.01, 0.4) }));
// C 8–12.5 s: up and out to the whole city
seg(4.5, (k, t, s) => ({ natural: true, ...cam(CLOSE1, CITY, ease(k)), anim: k < 0.25 ? 0.09 : null,
  cap: `<span class="g">228,091</span> street trees.<span class="s">Every one in the city register, at its real crown size.</span>`, capA: fade(t - 1.6, s - 1.6) }));
// D 12.5–16.5 s: the canopy breaks into islands (the map's own colours)
seg(4.0, (k, t, s) => ({ natural: k < 0.12, ...cam(CITY, INNER, ease(k)),
  cap: `But they form <span class="o">100,024</span> islands.<span class="s">Crowns that touch or are ≤ 2 m apart connect. Parks are safe. The rest is lava.</span>`, capA: fade(t - 0.4, s - 0.4) }));
// E 16.5–19.5 s: lone trees
seg(3.0, (k, t, s) => ({ ...cam(INNER, { ...INNER, zoom: 13.35, bearing: -26 }, ease(k)),
  cap: `<span class="b">1 in 3 trees</span> stands alone.<span class="s">71,883 crowns with no neighbour in reach.</span>`, capA: fade(t, s) }));
// F 19.5–23 s: into Stellingen, the largest island lights up
seg(3.5, (k, t, s) => ({ sel: k > 0.55, ...cam({ ...INNER, zoom: 13.35, bearing: -26 }, ROUTE, ease(k)),
  cap: `The largest island:<span class="s">324 trees and 36 green areas in Stellingen, next to the zoo.</span>`, capA: fade(t - 1.2, s - 1.2) }));
// G 23–27.5 s: the squirrel runs the longest path
seg(4.5, (k, t, s) => ({ sel: true, ...cam(ROUTE, ROUTE2, ease(k)), anim: ease(cl(k * 1.15)), counter: ease(cl(k * 1.15)), capA: fade(t, s + 1, 0.3, 0.01) }));
// H 27.5–32 s: five new trees, a longer run
seg(4.5, (k, t, s) => ({ sel: true, keep: true, ext: true, ...cam(ROUTE2, { ...ROUTE2, zoom: 15.05, bearing: 2 }, ease(k)), anim: ease(cl(k * 1.2)), extCounter: ease(cl(k * 1.2)), capA: fade(t, s, 0.3, 0.3) }));
// I 32–36 s: end card
seg(4.0, (k, t) => ({ sel: true, keep: true, ext: true, ...cam({ ...ROUTE2, zoom: 15.05, bearing: 2 }, { ...ROUTE2, zoom: 14.9, bearing: 6 }, ease(k)), anim: 1, end: ease(cl(t / 0.6)), capA: 0 }));

// ── render ──
const SHARD = +(process.env.SHARD || 0), NSHARD = +(process.env.NSHARD || 1);
const lo = Math.floor(plan.length * SHARD / NSHARD), hi = Math.floor(plan.length * (SHARD + 1) / NSHARD);
const ONLY = process.env.FRAMES ? new Set(process.env.FRAMES.split(",").map(Number)) : null;
await scene(plan[sec(25)]); await settle(); await p.waitForTimeout(1500);      // warm-up: icons and fonts
await p.evaluate(() => { S.added = []; S.pos = null; S.extResult = null; S.showExt = false; refresh(false); select(-1); });
for (let n = 0; n < plan.length; n++) {
  if (ONLY ? !ONLY.has(n) : (n < lo || n >= hi)) continue;
  await scene(plan[n]); await settle();
  await p.screenshot({ path: `${FR}/f${String(n).padStart(4, "0")}.jpg`, type: "jpeg", quality: 93 });
  if (n % 24 === 0) console.log("frame", n, "/", plan.length, new Date().toISOString());
}
console.log(`shard ${SHARD}: frames ${lo}–${hi - 1} of ${plan.length}`);
await br.close(); process.exit(0);
