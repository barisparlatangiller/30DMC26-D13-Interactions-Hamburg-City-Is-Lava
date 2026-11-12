// Screenshots of every story step (desktop + phone) and the explore view, for review before going live.
//   node pipeline/preview.mjs   → preview/*.jpg      (LOCAL=1 CHROME=… for a sandbox without CDN access)
import { chromium } from "playwright";
import fs from "node:fs"; import http from "node:http"; import path from "node:path";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json", ".bin": "application/octet-stream" };
http.createServer((req, res) => { const u = decodeURIComponent(new globalThis.URL(req.url, "http://x").pathname); const f = path.join("docs", u.endsWith("/") ? u + "index.html" : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); }).listen(8002);
fs.mkdirSync("preview", { recursive: true });
const br = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"], ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const NM = process.env.NM || "node_modules/";
for (const [tag, vp] of [["desk", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844, deviceScaleFactor: 2 }]]) {
  const p = await br.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor || 1 });
  p.setDefaultTimeout(240000);
  if (process.env.LOCAL) {
    await p.route(/cdn\.jsdelivr\.net/, r => { const u = r.request().url(); const f = u.includes("deck.gl") ? NM + "deck.gl/dist.min.js" : u.endsWith(".css") ? NM + "maplibre-gl/dist/maplibre-gl.css" : NM + "maplibre-gl/dist/maplibre-gl.js"; r.fulfill({ path: f, contentType: f.endsWith("css") ? "text/css" : "application/javascript" }); });
    await p.route(/basemaps\.cartocdn/, r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#f2f0ea" } }] }) }));
    await p.route(/fonts\.g|openfreemap/, r => r.abort());
  }
  p.on("pageerror", e => console.log(tag, "pageerror:", e.message));
  p.on("console", m => m.type() === "error" && console.log(tag, "console:", m.text()));
  await p.goto("http://localhost:8002/", { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.Story && window.S && S.ready, null, { timeout: 180000 });
  const settle = () => p.evaluate(() => new Promise(r => { let d = false; const f = () => { if (!d) { d = true; setTimeout(r, 60); } }; S.map.once("idle", f); S.map.triggerRepaint(); setTimeout(f, 6000); }));
  const n = await p.evaluate(() => Story.steps());
  for (let i = 0; i < n; i++) {
    if (process.env.ONLY && !process.env.ONLY.split(",").includes(String(i))) continue;
    await p.evaluate(i => Story.go(i), i);
    await p.waitForTimeout(i === 5 || i === 6 ? 9000 : 3600); await settle();
    await p.screenshot({ path: `preview/${tag}_step${i}.jpg`, type: "jpeg", quality: 85 }); console.log(tag, "step", i);
  }
  await p.evaluate(() => { Story.mode("explore"); S.map.jumpTo({ center: [9.944, 53.588], zoom: 15.6, pitch: 50, bearing: -15 }); select(S.routeNode); });
  await p.waitForTimeout(2500); await settle();
  await p.screenshot({ path: `preview/${tag}_explore.jpg`, type: "jpeg", quality: 85 }); console.log(tag, "explore");
  await p.close();
}
await br.close(); process.exit(0);
