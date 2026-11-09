// LinkedIn media, rendered from the built site (GitHub Actions, commit message with [video] or [posters]):
//   media/post1_islands.png · post2_route.png · post3_new_tree.png (1080×1350) · day13_city_is_lava.mp4 (~20 s) · thumb_full.jpg · cover.png
//   node pipeline/video.mjs        (POSTERS_ONLY=1 skips the video)
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import http from "node:http";
import path from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json", ".bin": "application/octet-stream" };
http.createServer((req, res) => {
  const u = decodeURIComponent(new globalThis.URL(req.url, "http://x").pathname);
  const f = path.join("docs", u.endsWith("/") ? u + "index.html" : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Content-Length": fs.statSync(f).size });
  fs.createReadStream(f).pipe(res);
}).listen(8000);

const URL = "http://localhost:8000/", OUT = "media", FR = "media/frames", FPS = 24;
fs.mkdirSync(FR, { recursive: true });
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"];
const br = await chromium.launch({ args: ARGS });
// LOCAL=1: serve libraries from node_modules and use an empty basemap (sandbox without CDN access)
const NM = process.env.NM || "node_modules/";
async function newPage(o) {
  const p = await br.newPage(o);
  if (process.env.LOCAL) {
    await p.route(/cdn\.jsdelivr\.net/, r => { const u = r.request().url(); const f = u.includes("deck.gl") ? NM + "deck.gl/dist.min.js" : u.endsWith(".css") ? NM + "maplibre-gl/dist/maplibre-gl.css" : NM + "maplibre-gl/dist/maplibre-gl.js";
      r.fulfill({ path: f, contentType: f.endsWith("css") ? "text/css" : "application/javascript" }); });
    await p.route(/basemaps\.cartocdn/, r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#f3f1ed" } }] }) }));
    await p.route(/fonts\.g/, r => r.abort());
  }
  return p;
}
const ready = p => p.waitForFunction(() => window.S && S.ready, null, { timeout: 180000 });
const settle = p => p.evaluate(() => new Promise(r => { let d = false; const f = () => { if (!d) { d = true; setTimeout(r, 30); } }; S.map.once("idle", f); S.map.triggerRepaint(); setTimeout(f, 4000); }));

// hub thumbnail: the desktop page in Squirrel Mode around the longest route
{
  const p = await newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL, { waitUntil: "networkidle" }); await ready(p);
  await p.evaluate(() => { S.manual = true; setJump(2); S.map.jumpTo({ center: [9.948, 53.5905], zoom: 14.6, pitch: 40, bearing: -10 }); });
  await settle(p); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/thumb_full.jpg`, type: "jpeg", quality: 90 }); await p.close();
}

const CSS = `
  .panel, .legend, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-right { display: none !important; }
  #map, #glow { inset: 0 !important; }
  .shade { position: absolute; inset: 0; z-index: 4; pointer-events: none;
    background: linear-gradient(180deg, rgba(250,248,245,.96) 0, rgba(250,248,245,.75) 290px, rgba(250,248,245,0) 460px, rgba(250,248,245,0) 960px, rgba(250,248,245,.85) 1120px, rgba(250,248,245,.97) 1350px); }
  .v { position: absolute; z-index: 6; left: 54px; right: 54px; font-family: Inter; color: #1f1a17; }
  .v.top { top: 48px; }
  .v .eb { font-size: 19px; letter-spacing: .18em; text-transform: uppercase; color: #8a8079; font-weight: 600; }
  .v h1 { font-family: "Bricolage Grotesque", Inter; font-size: 92px; font-weight: 800; line-height: .92; letter-spacing: -.035em; margin: 12px 0 12px; }
  .v h1 span { color: #ff5a1f; text-shadow: 0 0 26px rgba(255,90,31,.25); }
  .v .q { font-size: 29px; color: #4a423c; line-height: 1.3; max-width: 900px; }
  .v.bot { bottom: 50px; }
  .v .big { font-family: "Bricolage Grotesque", Inter; font-size: 50px; font-weight: 800; line-height: 1.04; letter-spacing: -.02em; }
  .v .big b { color: #15803d; } .v .big em { font-style: normal; color: #ea580c; }
  .v .sm { font-size: 24px; color: #4a423c; line-height: 1.35; margin-top: 12px; }
  .v .chips { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 19px; color: #4a423c; margin-top: 16px; }
  .v .chips i { display: inline-block; width: 15px; height: 15px; border-radius: 50%; margin-right: 7px; vertical-align: -2px; }
  .v .att { margin-top: 12px; font-size: 14.5px; color: #8a8079; }
  .card2 { position: absolute; z-index: 7; left: 60px; right: 60px; top: 420px; background: rgba(255,255,255,.95); border: 1px solid rgba(255,90,31,.3); box-shadow: 0 20px 60px rgba(60,40,20,.15); border-radius: 28px;
    padding: 42px 46px; font-family: Inter; color: #1f1a17; opacity: 0; }
  .card2 h2 { text-transform: none; color: #1f1a17; font-weight: 800; font-family: "Bricolage Grotesque"; font-size: 56px; margin: 0 0 18px; line-height: 1; letter-spacing: -.02em; } .card2 h2 span { color: #ff5a1f; }
  .card2 li { font-size: 26px; line-height: 1.38; color: #4a423c; margin: 0 0 12px; } .card2 b { color: #1f1a17; }
  .card2 .url { margin-top: 20px; font-size: 25px; font-weight: 700; color: #168044; } .card2 .att { margin-top: 8px; font-size: 15px; color: #8a8079; }
`;
const CHIPS = `<div class="chips"><span><i style="background:#ea580c"></i>connected</span><span><i style="background:#f97316"></i>10–49</span><span><i style="background:#fdaa64"></i>2–9</span>
  <span><i style="background:#aad6e8"></i>alone</span><span><i style="background:#16a34a"></i>reachable</span><span><i style="background:#e2007a"></i>new tree</span>
  <span><i style="width:22px;height:0;border-radius:0;border-top:3px dashed #7c2d12"></i>squirrel jump</span><span><i style="width:22px;height:6px;border-radius:3px;background:#c3bdb6"></i>major road</span>
  <span><i style="background:#e4ece0;border:1px solid #bcd4b6"></i>park · cemetery · allotment</span></div>`;
const ATT = `<div class="att">Straßenbaumkataster & Digitaler Grünplan © FHH/BUKEA (dl-de/by-2-0) · roads & buildings © OpenStreetMap (ODbL) · OpenFreeMap · © CARTO</div>`;

async function open() {
  const p = await newPage({ viewport: { width: 1080, height: 1350 } });
  p.on("console", m => m.type() === "error" && console.log("console:", m.text()));
  p.on("pageerror", e => console.log("pageerror:", e.message));
  await p.goto(URL, { waitUntil: "networkidle" }); await ready(p);
  await p.addStyleTag({ content: CSS });
  await p.evaluate(({ CHIPS, ATT }) => {
    S.manual = true; S.showExt = false; S.map.resize();
    document.body.insertAdjacentHTML("beforeend", `<div class="shade"></div><div class="v top"><div class="eb">#30DayMapChallenge · Day 13 · Interactions · Hamburg</div>
      <h1>The City <span>Is Lava</span></h1><div class="q" id="vq"></div></div><div class="v bot"><div class="big" id="vb"></div><div class="sm" id="vs"></div>${CHIPS}${ATT}</div>`);
    // node of the route's first tree, so its whole group lights up
    const [x, y] = S.A.route.coords[0]; let best = 0, bd = 1e9;
    for (let i = 0; i < S.N; i++) { const d = (S.lon[i] - x) ** 2 + (S.lat[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
    S.routeNode = best;
  }, { CHIPS, ATT });
  return p;
}
// one frame: mode, camera, selection, squirrel, captions
const scene = (p, o) => p.evaluate(o => {
  if (o.jump !== S.jump) setJump(o.jump);
  const want = o.sel ? S.routeNode : -1;
  if (!o.keep && want !== S.sel) select(want);
  if (o.plant && !S.added.length) { const c = S.crit[o.plant - 1]; plant(c.lon, c.lat); }
  if (o.ext && !S.extResult) { S.extPath = null; extendRoute({ noPlay: true }); S.extPath = S.lastPath; }
  if (o.showExt != null) S.showExt = o.showExt;
  S.pulse = (S.pulse || 0) + 0.35;
  if (o.anim != null) { const c = o.ext ? S.extPath : S.A.route.coords; S.anim = { path: c, k: o.anim * (c.length - 1) }; } else S.anim = null;
  S.map.jumpTo({ center: o.center, zoom: o.zoom, pitch: o.pitch || 0, bearing: o.bearing || 0 });
  frame();
  if (o.extCap && S.extResult) { const X = S.extResult; o.big = `${X.n} new trees:<br>route <em>${X.before.toFixed(2)}</em> → <b>${X.after.toFixed(2)} km</b>`;
    o.sm = `The planted trees (pink) bridge the gaps, partly via parks as safe islands; the group grows from ${X.sz0} to ${X.sz1} trees and the squirrel gets ${Math.round((X.after / X.before - 1) * 100)}% further.`; }
  for (const [id, v] of [["vq", o.q], ["vb", o.big], ["vs", o.sm]]) if (v != null) document.getElementById(id).innerHTML = v;
  if (o.card != null) {
    if (!document.getElementById("c2")) document.body.insertAdjacentHTML("beforeend", `<div class="card2" id="c2"><h2>For a squirrel, Hamburg is <span>mostly lava</span></h2><ul>
      <li><b>228,091</b> street-tree crowns form <b>133,424</b> separate groups when crowns must touch.</li>
      <li>With 2 m jumps: still <b>100,024</b> groups, and <b>71,883</b> trees stand alone.</li>
      <li>The largest group: <b>324 trees</b>. ${S.extResult ? `${S.extResult.n} new trees at the right gaps stretch its longest route from ${S.extResult.before.toFixed(2)} to <b>${S.extResult.after.toFixed(2)} km</b>.` : ""}</li></ul>
      <div class="url">Plant or remove trees yourself · barisparlatangiller.github.io</div>
      <div class="att">Straßenbaumkataster & Digitaler Grünplan © FHH/BUKEA (dl-de/by-2-0) · OpenStreetMap (ODbL)</div></div>`);
    document.getElementById("c2").style.opacity = o.card; document.querySelector(".v.bot").style.opacity = 1 - o.card;
  }
}, o);

let p = await open();
const R = await p.evaluate(() => { const c = S.A.route.coords; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; c.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  return { start: c[0], mid: [(x0 + x1) / 2, (y0 + y1) / 2], critB: [S.crit[5].lon, S.crit[5].lat] }; });
const CITY = { center: [10.0, 53.572], zoom: 10.75 };
const ROUTE = { center: [R.mid[0], R.mid[1] - 0.0012], zoom: 15.35, pitch: 48, bearing: -12 };
// view that holds the route and the suggested trees
const RX = await p.evaluate(() => { const c = S.A.route.coords.concat(S.ext.map(d => [d.lon, d.lat])); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; c.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); return [(x0 + x1) / 2, (y0 + y1) / 2]; });
const ROUTE_X = { center: [RX[0], RX[1] - 0.0016], zoom: 15.0, pitch: 50, bearing: -12 };
const T_EXT = X => ({ big: `${X.n} new trees:<br>route <em>${X.before.toFixed(2)}</em> → <b>${X.after.toFixed(2)} km</b>`,
  sm: `Pink: trees planted where a squirrel cannot jump yet (8 m crowns, gaps ≤ 2 m, never across a major road; parks count as safe islands). The group grows from ${X.sz0} to ${X.sz1} trees.` });
const Q = "Can a squirrel cross Hamburg without touching the ground?";
const T_HARD = { big: "<b>228,091</b> street-tree crowns.<br><em>133,424</em> separate groups.", sm: "Hard Mode: a squirrel only moves where crowns touch. Parks, cemeteries and allotments are safe islands. The rest is lava." };
const T_SQ = { big: "Jumps up to 2 m:<br>still <em>100,024</em> groups.", sm: "71,883 trees stand alone. Even 4 m jumps would link at most 500 trees." };
const T_ROUTE = { big: "The best route: <b>1.28 km</b><br>over 102 crowns.", sm: "Stellingen, Koppelstraße → Hagenbeckstraße, next to the zoo. 93 of the 102 trees are lindens. Its group: 324 trees, 36 green areas." };

// ── posters ──
for (const [name, o] of [
  ["post1_islands", { jump: 0, ...CITY, zoom: 10.85, q: Q, ...T_HARD }],
  ["post2_route", { jump: 2, sel: true, anim: 1, ...ROUTE, q: Q, ...T_ROUTE }],
]) {
  await scene(p, o); await settle(p); await p.waitForTimeout(1200); await scene(p, o); await settle(p);
  await p.screenshot({ path: `${OUT}/${name}.png` }); console.log("poster", name);
}
{ // poster 3: the 5 suggested trees, planted, and the longer route
  const o = { jump: 2, sel: true, keep: true, ...ROUTE_X, q: Q };
  await scene(p, { ...o, ext: true, showExt: true, anim: 1 });
  const X = await p.evaluate(() => S.extResult);
  await scene(p, { ...o, ext: true, showExt: true, anim: 1, ...T_EXT(X) });
  await settle(p); await p.waitForTimeout(1500); await scene(p, { ...o, ext: true, showExt: true, anim: 1, ...T_EXT(X) }); await settle(p);
  await p.screenshot({ path: `${OUT}/post3_extend_route.png` }); console.log("poster post3_extend_route", X);
  await p.evaluate(() => { S.added = []; S.pos = null; S.extResult = null; S.showExt = false; refresh(false); select(-1); });
}
if (process.env.POSTERS_ONLY) { await br.close(); process.exit(0); }

// ── video: close-up → whole city → Squirrel Mode → into Stellingen → the squirrel runs → card ──
const ease = k => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
// zoom-aware camera move: the centre follows the zoom so the target stays in view
function cam(A, B, k) {
  const z = lerp(A.zoom, B.zoom, k), s0 = 2 ** -A.zoom, s1 = 2 ** -B.zoom, w = Math.abs(s1 - s0) < 1e-12 ? k : (2 ** -z - s0) / (s1 - s0);
  return { center: [lerp(A.center[0], B.center[0], w), lerp(A.center[1], B.center[1], w)], zoom: z, pitch: lerp(A.pitch || 0, B.pitch || 0, k), bearing: lerp(A.bearing || 0, B.bearing || 0, k) };
}
const CLOSE0 = { center: [R.start[0] + 0.0004, R.start[1] - 0.0006], zoom: 17.9, pitch: 60, bearing: -38 };
const CLOSE1 = { center: [R.start[0] + 0.0002, R.start[1] - 0.0004], zoom: 17.3, pitch: 58, bearing: -20 };
const plan = [], sec = s => Math.round(s * FPS);
const seg = (n, fn) => { for (let i = 0; i < n; i++) plan.push(fn(n > 1 ? i / (n - 1) : 1)); };
seg(sec(3), k => ({ jump: 0, ...cam(CLOSE0, CLOSE1, ease(k)), q: Q, big: "Every street tree is a crown.", sm: "Crowns that touch form a path through the trees. Everything else is lava." }));
seg(sec(4.5), k => ({ jump: 0, ...cam(CLOSE1, CITY, ease(k)), ...T_HARD }));
seg(sec(1), () => ({ jump: 0, ...CITY }));
seg(sec(2.2), k => ({ jump: 2, ...cam(CITY, { ...CITY, zoom: CITY.zoom + 0.15 }, k), ...T_SQ }));
seg(sec(3), k => ({ jump: 2, sel: k > 0.35, ...cam({ ...CITY, zoom: CITY.zoom + 0.15 }, ROUTE, ease(k)), big: "Where can a squirrel get furthest?", sm: "The largest canopy group in Squirrel Mode: 324 trees and 36 green areas in Stellingen." }));
seg(sec(5.5), k => ({ jump: 2, sel: true, anim: ease(Math.min(1, k * 1.08)), ...cam(ROUTE, { ...ROUTE, zoom: ROUTE.zoom + 0.25, bearing: ROUTE.bearing + 14 }, k), ...T_ROUTE }));
const R2 = { ...ROUTE, zoom: ROUTE.zoom + 0.25, bearing: ROUTE.bearing + 14 };
seg(sec(2), k => ({ jump: 2, sel: true, anim: 1, showExt: true, ...cam(R2, ROUTE_X, ease(k)), big: "Can new trees make it longer?", sm: "Pink rings: the 5 spots where one planted tree (8 m crown) would let the squirrel jump on, chosen one by one for the longest route." }));
seg(sec(5.5), k => ({ jump: 2, sel: true, keep: true, ext: true, showExt: true, anim: ease(Math.min(1, k * 1.1)), ...cam(ROUTE_X, { ...ROUTE_X, zoom: ROUTE_X.zoom + 0.2, bearing: ROUTE_X.bearing + 12 }, k), extCap: true }));
seg(sec(2.8), k => ({ jump: 2, sel: true, keep: true, ext: true, showExt: true, anim: 1, ...cam({ ...ROUTE_X, zoom: ROUTE_X.zoom + 0.2, bearing: ROUTE_X.bearing + 12 }, { ...ROUTE_X, zoom: ROUTE_X.zoom + 0.1, bearing: ROUTE_X.bearing + 16 }, k), card: Math.min(1, k * 3) }));

// warm-up so the squirrel icon is loaded before the first frame that needs it
await scene(p, { ...plan[sec(15)] }); await settle(p); await p.waitForTimeout(1500);
let n = 0;
const ONLY = process.env.FRAMES ? new Set(process.env.FRAMES.split(",").map(Number)) : null;   // test: render a few frames only
for (const o of plan) {
  if (ONLY && !ONLY.has(n)) { n++; continue; }
  await scene(p, o); await settle(p);
  await p.screenshot({ path: `${FR}/f${String(n).padStart(4, "0")}.png` }); n++;
  if (n % 48 === 0) console.log("frame", n, "/", plan.length, new Date().toISOString());
}
if (ONLY) { console.log("plan", plan.length); process.exit(0); }
fs.copyFileSync(`${FR}/f${String(sec(16.5)).padStart(4, "0")}.png`, `${OUT}/cover.png`);
await br.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${FR}/f%04d.png`,
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}/day13_city_is_lava.mp4`]);
console.log(`${n} frames, ${(n / FPS).toFixed(1)} s, ${(fs.statSync(`${OUT}/day13_city_is_lava.mp4`).size / 1e6).toFixed(2)} MB`);
fs.rmSync(FR, { recursive: true });
process.exit(0);
