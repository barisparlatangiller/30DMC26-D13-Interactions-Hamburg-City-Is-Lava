/* Guided story on top of the map (app.js). Every step sets the camera, the model and what is shown, then explains it in one or two sentences.
   The numbers in the text are the site's own results (analysis.json, or computed live in the browser). */
(() => {
  const $ = s => document.querySelector(s);
  const KEY = {
    canopy: `<span><i style="background:#1a602c"></i>long canopy chain</span><span><i style="background:#74a256"></i>short chain</span><span><i style="background:#ba8a62"></i>no neighbour in reach</span>`,
    rule: `<span><i style="background:#267034"></i>crown</span><span><i class="dash"></i>possible jump (≤ 2 m)</span><span><i class="park"></i>park · cemetery · allotment</span>`,
    reach: `<span><i style="background:#f29e16"></i>reachable from here</span><span><i class="park" style="background:#f6ecd2;box-shadow:inset 0 0 0 2px #d98a06"></i>green area on the way</span>`,
    route: `<span><i style="background:#1d3aa0;border-radius:2px;height:5px;width:16px"></i>longest path</span><span><i style="background:#f29e16"></i>reachable</span>`,
    plant: `<span><i style="background:#d6006e"></i>new tree (8 m crown)</span><span><i style="background:#1d3aa0;border-radius:2px;height:5px;width:16px"></i>longer path</span>`,
    seen: `<span><i class="sq"></i>red squirrel seen (GBIF)</span><span><i class="park"></i>public green</span><span><i style="background:#267034"></i>street trees</span>`,
  };
  let R, STEPS, cur = -1;
  const fly = (cam, dur = 2600) => S.map.flyTo({ ...cam, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : dur, essential: true });
  const bld = v => { if (S.map.getLayer("buildings")) S.map.setPaintProperty("buildings", "fill-extrusion-opacity", v); };
  const clean = () => { S.anim = null; if (S.added.length || S.extResult) { S.added = []; S.pos = null; S.extResult = null; refresh(false); } };
  const pad = () => innerWidth < 760 ? { top: 70, bottom: 300, left: 20, right: 20 } : { top: 80, bottom: 80, left: 480, right: 60 };

  function build() {
    const c = S.A.route.coords; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    c.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    const st = c[Math.min(c.length - 1, 84)], sc = S.A.scenarios, sq = sc.squirrel, n = S.sight ? S.sight.length : 0;
    const phone = innerWidth < 760;
    R = { box: [[x0, y0], [x1, y1]], street: { center: [st[0] + 0.0001, st[1] - 0.00035], zoom: phone ? 17.6 : 18.1, pitch: 62, bearing: -158 },
      rule: { center: [st[0] + 0.0002, st[1] - 0.0002], zoom: phone ? 17.0 : 17.4, pitch: 55, bearing: -128 },
      city: { center: [9.995, 53.566], zoom: phone ? 9.9 : 10.7, pitch: 0, bearing: 0 },
      inner: { center: [9.966, 53.573], zoom: phone ? 13.3 : 13.9, pitch: 48, bearing: -18 },
      seen: { center: [10.0, 53.575], zoom: phone ? 10.2 : 11.0, pitch: 20, bearing: 0 } };
    STEPS = [
      { cover: true, kick: "#30DayMapChallenge · Day 13 · Interactions", title: "Can a squirrel cross Hamburg without touching the ground?",
        text: `Hamburg records every street tree: where it stands, how wide its crown is, its trunk and its species. <b>228,091 trees.</b> Do they connect?`,
        btn: "Start", cam: R.city, set: () => { S.showSight = false; select(-1); } },
      { kick: "1 · The trees", title: "Every street tree, at its real size.", key: "canopy",
        text: `Each crown is drawn from the city's register: position, crown width, trunk and species. Heights are estimated; the register does not record them.`,
        cam: R.street, set: () => { S.showSight = false; select(-1); } },
      { kick: "2 · The rule", title: "Through the crowns, or not at all.", key: "rule",
        text: `Crowns that touch form a path. A squirrel can jump gaps of up to <b>2 m</b> (dashed lines). Parks, cemeteries and allotments are safe ground. Anywhere else, it has to climb down.`,
        cam: R.rule, set: () => { S.showSight = false; select(-1); } },
      { kick: "3 · The answer", title: `No. The canopy breaks into ${fmt(sq.groups)} islands.`, key: "canopy",
        text: `Darker green marks longer chains of connected crowns. <b>${fmt(sq.alone)} trees</b>, almost 1 in 3, have no neighbour within reach (grey-brown).`,
        cam: R.inner, set: () => { S.showSight = false; select(-1); bld(0.35); } },
      { kick: "4 · The largest island", title: `${sq.largest} trees in Stellingen.`, key: "reach",
        text: `Next to the zoo, street trees and <b>${sq.largest_parks} green areas</b> link up. Amber shows everything a squirrel can reach from one tree here.`,
        fit: true, set: () => { S.showSight = false; select(S.routeNode ?? (S.routeNode = routeNode())); } },
      { kick: "5 · The longest path", title: `${S.A.route.km.toFixed(2)} km without touching the ground.`, key: "route",
        text: `${S.A.route.trees} crowns, mostly lindens, along ${S.A.route.streets.slice(0, 2).join(" and ")}. Watch the squirrel.`,
        set: () => { S.showSight = false; select(S.routeNode ?? (S.routeNode = routeNode())); play(S.A.route.coords, S.A.route); } },
      { kick: "6 · What if", title: "Five new trees.", key: "plant",
        text: `Planted in the right gaps (8 m crowns, gaps of 2 m or less, never across a main road).`, dyn: true,
        set: () => { S.showSight = false; S.showExt = true; const X = extendRoute(); return `Planted in the right gaps (8 m crowns, gaps of 2 m or less, never across a main road), five trees stretch the path from <b>${X.before.toFixed(2)}</b> to <b>${X.after.toFixed(2)} km</b>, <b>+${Math.round((X.after / X.before - 1) * 100)}%</b>. The island grows from ${fmt(X.sz0)} to ${fmt(X.sz1)} trees.`; } },
      { kick: "7 · Real squirrels", title: "Where squirrels are actually seen.", key: "seen",
        text: n ? `<b>${fmt(n)} red-squirrel sightings</b> (GBIF, 2010–2026). 4 in 5 are outside public green space, and most of those are more than 25 m from any street tree: in gardens and courtyards that the tree register does not cover.
          <span class="src">Sightings show where people noticed and reported squirrels, not everywhere they live.</span>` : `Sightings could not be loaded.`,
        cam: R.seen, set: () => { S.showSight = true; select(-1); } },
      { kick: "Your turn", title: "Plant a tree. Cut one. See what changes.", key: "canopy",
        text: `Tap any tree or park to see how far a squirrel gets from there. Change the jump distance, let main roads block the way, or plant the one tree that joins two islands.`,
        btn: "Explore the map", cam: { ...R.inner, zoom: R.inner.zoom - 0.6, pitch: 35 }, set: () => { S.showSight = false; select(-1); } },
    ];
    $("#s-dots").innerHTML = STEPS.map((_, i) => `<i data-i="${i}" title="Step ${i}"></i>`).join("");
    document.querySelectorAll("#s-dots i").forEach(d => d.onclick = () => go(+d.dataset.i));
  }

  function go(i) {
    i = Math.max(0, Math.min(STEPS.length - 1, i)); const st = STEPS[i], back = i < cur; cur = i;
    S.manual = false; S.showExt = false; S.showCrit = false; S.anim = null; S.playId = (S.playId || 0) + 1;
    if (setJump && S.jump !== 2) setJump(2);
    if (st.kick !== "6 · What if" && (back || S.added.length)) clean();
    bld(S.bOp ?? 0.8);
    let dyn = st.set ? st.set() : null;
    if (st.cam) fly(st.cam); else if (st.fit) S.map.fitBounds(R.box, { padding: pad(), pitch: 52, bearing: -14, duration: 2600, maxZoom: 16 });
    $("#story").classList.toggle("cover", !!st.cover);
    $("#s-kick").textContent = st.kick; $("#s-title").textContent = st.title;
    $("#s-text").innerHTML = typeof dyn === "string" ? dyn : st.text;
    $("#s-key").innerHTML = st.key ? KEY[st.key] : "";
    $("#s-prev").disabled = i === 0;
    $("#s-next").textContent = st.btn || "Next";
    document.querySelectorAll("#s-dots i").forEach((d, k) => d.classList.toggle("on", k === i));
    $("#sightings").checked = !!S.showSight;
    redraw();
    history.replaceState(null, "", i ? `#story-${i}` : location.pathname);
  }
  function mode(m) {
    document.body.classList.toggle("story-on", m === "story");
    $("#m-story").classList.toggle("on", m === "story"); $("#m-explore").classList.toggle("on", m === "explore");
    if (m === "explore") { S.manual = false; S.showCrit = true; S.showExt = S.ext.length > 0 && !S.extResult; history.replaceState(null, "", "#explore"); redraw(); }
    else go(Math.max(cur, 0));
  }
  window.Story = { go: i => { mode("story"); go(i); }, mode, steps: () => STEPS.length };

  const start = () => {
    if (!window.S || !S.ready || !S.A) return setTimeout(start, 200);
    build();
    $("#s-next").onclick = () => cur >= STEPS.length - 1 ? mode("explore") : go(cur + 1);
    $("#s-prev").onclick = () => go(cur - 1);
    $("#s-skip").onclick = () => mode("explore");
    $("#m-story").onclick = () => mode("story"); $("#m-explore").onclick = () => mode("explore");
    $("#brand").onclick = e => { e.preventDefault(); mode("story"); go(0); };
    $("#sightings").onchange = e => { S.showSight = e.target.checked; redraw(); };
    $("#grab").onclick = () => $("#panel").classList.toggle("full");
    addEventListener("keydown", e => { if (!document.body.classList.contains("story-on")) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); $("#s-next").click(); } if (e.key === "ArrowLeft") go(cur - 1); });
    const h = location.hash;
    if (h === "#explore") { cur = 0; mode("explore"); S.map.jumpTo(R.inner); }
    else { const m = h.match(/^#story-(\d+)$/); mode("story"); if (m) go(+m[1]); }
  };
  start();
})();
