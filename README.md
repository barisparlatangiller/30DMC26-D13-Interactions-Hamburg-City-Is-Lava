# The City Is Lava · Hamburg

**#30DayMapChallenge 2026 · Day 13 · Interactions**

**Can a squirrel cross Hamburg without touching the ground?**

👉 **Live map:** https://barisparlatangiller.github.io/30DMC26-D13-Interactions-Hamburg-City-Is-Lava/

The map treats every street tree as a crown. Crowns that touch, or are close enough to jump between, form a path. Parks, cemeteries and allotments are safe islands, and everything else is lava. The network is recomputed in the browser (union–find over 290,709 links) whenever you change something:

- **Hard Mode / Squirrel Mode.** In Hard Mode crowns must touch. In Squirrel Mode a squirrel can jump gaps of up to 2 m, and a slider tries anything from 0 to 4 m.
- **Major roads are lava too.** This switch cuts every link whose trunk-to-trunk line crosses a motorway, trunk, primary or secondary road.
- **Tap a tree or a park** to light up everything a squirrel can reach from there.
- **🌳 Plant / 🪓 Remove.** Add a tree with an 8 m crown, or cut one down, and see how many groups merge or split.
- **Critical gaps.** These are 20 places where a single new tree would join two large groups. Tap one to fly there and plant it.
- **🐿️ Squirrel route.** This shows the longest canopy path inside the selected group.

## Findings

| | Hard Mode (touching) | Squirrel Mode (≤ 2 m) |
|---|---|---|
| separate canopy groups | 133,424 | 100,024 |
| trees standing alone | 106,402 | 71,883 |
| largest group | 270 trees | 324 trees, 36 green areas |
| … with major roads as lava | 134,255 groups | 101,471 groups |

- Even 4 m jumps leave 70,821 groups, and the largest of them has 500 trees.
- The longest path in the largest Squirrel-Mode group runs 1.28 km over 102 crowns in Stellingen, along Koppelstraße and Hagenbeckstraße next to the zoo. 93 of those 102 trees are lindens.
- One new tree at the 11.4 m gap next to that group would join it with a group of 70 trees, giving 395 trees and 51 green areas.
- So, for a squirrel, Hamburg is mostly lava. Street trees form short chains along streets, and those chains rarely connect.

## Data

- **Straßenbaumkataster Hamburg.** 229,013 street trees. The 228,091 with a crown diameter between 0 and 35 m are used. © Freie und Hansestadt Hamburg, BUKEA, licence dl-de/by-2-0.
- **Digitaler Grünplan.** 3,673 public green areas, 2,054 allotment gardens and 70 cemeteries. © FHH, BUKEA, licence dl-de/by-2-0.
- **Roads.** OpenStreetMap, © OpenStreetMap contributors (ODbL).
- **Basemap.** © CARTO.

## Method

1. Each crown is drawn as a circle with the recorded diameter. Two trees are linked if gap = distance − r₁ − r₂ ≤ 4 m. The gap is stored, so each model is just a threshold.
2. A tree links to a green area if its crown comes within 4 m of the polygon. Green areas that touch or lie within 4 m of each other are linked too.
3. Road flags come from the straight trunk-to-trunk line (bit 1 = major road, bit 2 = any road). Tunnels are excluded.
4. Critical gaps are pairs of trees from two different Squirrel-Mode groups whose crowns are at most 12 m apart. A new 8 m crown placed between them closes both gaps to 2 m or less. Pairs whose line crosses a major road are skipped.

```bash
python pipeline/build_network.py --data "<folder with the BUKEA JSON files and Hamburg_OSM_Roads.gpkg>"   # → docs/data/*
python pipeline/analyse.py                                                                               # → docs/data/analysis.json
LOCAL=1 node pipeline/video.mjs        # posters + video (normally in GitHub Actions: commit message with [video] / [posters])
```

The raw inputs are too large for the repo, so `docs/data` is built locally and committed. GitHub Actions deploys `docs/` to Pages and renders the LinkedIn media onto the `media` branch.

## Limits

- Circles are not real branches. Crown height and shape are unknown, and so is whether two crowns above a road actually meet.
- The 2 m jump is a starting assumption to compare against, not a measured squirrel jump.
- Trees inside parks and on private land are not in the register. That is why parks count as whole islands, and why private gardens, which squirrels love, are missing.
- A link is a possible path, not an observed squirrel.

Barış Parlatangiller · built with Claude (Anthropic) · code MIT, data under the licences above.
