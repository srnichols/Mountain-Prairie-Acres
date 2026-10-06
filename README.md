# Mountain Prairie Acres

Orchard and ranch projects for our property in Prairie, Idaho: plans, field checklists, and the data behind them. This repository is public on purpose; nothing here is private.

**Website:** <https://srnichols.github.io/Mountain-Prairie-Acres/>, published with GitHub Pages from the [`docs`](docs/) folder.

**Location:** the driveway leaves the north road at 43.47550, −115.59364 ([map and directions](https://www.google.com/maps/search/?api=1&query=43.475504,-115.593643)).

## Project tracker

| Project | Status | Pages and downloads | Next steps | Updated |
|---|---|---|---|---|
| Orchard planting, fall 2026 | In progress | [Pollination grid and west windbreak](https://srnichols.github.io/Mountain-Prairie-Acres/orchard_pollination_grid.html) ([PDF](docs/downloads/orchard_pollination_grid.pdf)) · [Metal-tag planting checklist](https://srnichols.github.io/Mountain-Prairie-Acres/metal_tag_planting_checklist.html) ([PDF](docs/downloads/metal_tag_planting_checklist.pdf)) | Plant R2–R12 by metal tag, south to north; hold R1 for grafted rootstock apples; plant the west windbreak, berry guilds, and elderberry hedge | 2026-10-06 |
| Rain and snowmelt harvesting | Planned | [Water-harvesting plan](https://srnichols.github.io/Mountain-Prairie-Acres/orchard_water_harvesting_plan.html) ([PDF](docs/downloads/orchard_water_harvesting_plan.pdf)) | Perc tests in three spots before freeze-up; shape crescent basins as trees go in; set up a rain gauge; gutters, spreader, and driveway basins in 2027 | 2026-10-06 |
| Whole-site terrain and water maps | Reference | [Site terrain and water maps](https://srnichols.github.io/Mountain-Prairie-Acres/site_terrain_water_map.html) ([PDF](docs/downloads/site_terrain_water_map.pdf)) | Use to site future projects (tank, pond, basins, outbuildings); check key spots with a level | 2026-10-06 |
| Homestead plot map | Reference | [Homestead plot map](https://srnichols.github.io/Mountain-Prairie-Acres/homestead_plot_map.html) ([PDF](docs/downloads/homestead_plot_map.pdf)) | Stake the planned house, garage, and workshop; trace where the buried water line goes | 2026-10-06 |
| Site master grid and code helpers | Reference | [Site master grid](https://srnichols.github.io/Mountain-Prairie-Acres/site_master_grid.html) ([PDF](docs/downloads/site_master_grid.pdf)) · [`docs/data/`](docs/data/) · [`tools/site_grid.py`](tools/site_grid.py) | Add new features to the grid data as projects start | 2026-10-06 |
| Soil and site data | Reference | [NRCS Web Soil Survey report](docs/soil/WebSoilSurvey_PrairieID.pdf) · [SSURGO metadata](docs/soil/) · USGS lidar terrain ([`site_terrain.js`](docs/data/site_terrain.js)) | Add perc-test and rain-gauge results as they come in | 2026-10-06 |
| Plant inventory and purchase records | Ongoing | [Inventory_PrairiePlants.xlsx](docs/Inventory_PrairiePlants.xlsx) · [Trees.xlsx](docs/Trees.xlsx) | Keep the inventory current as trees are planted, moved, or lost | 2026-10-04 |

Status key: **In progress** (work under way), **Planned** (designed, not started), **Ongoing** (kept up to date), **Reference** (source data), **Archived** (kept for history).

## Project log

- **2026-10-06**: Added the homestead plot map and the site master grid: one coordinate system (feet from the northwest fence corner, 50 ft cells A–G by 1–26, latitude and longitude) shared by every page and by the code helpers, including orchard tree positions. The whole-site maps and the water plan now use USGS 3DEP lidar (6.7 acres drain north, 3.2 south), and the water plan shows the pump house and irrigation tank.
- **2026-10-06**: Moved the planting checklist after the site plan in the pollination grid. Removed the first orchard layout, which was never planted.
- **2026-10-06**: Added whole-site terrain and water maps: elevation and contours, runoff (6.8 acres drain north, 3.3 south), slope, profiles, and a spot-elevation grid for the whole lot, for planning future projects.
- **2026-10-06**: Created this repository and website. Added the orchard rain and snowmelt harvesting plan (USGS 1 m terrain, NRCS soil, PRISM climate) and the NRCS Web Soil Survey report for the property.
- **2026-10-05**: Finished the pollination grid with the west windbreak, and the metal-tag planting checklist for fall planting.
- **2026-10-04**: Updated the Prairie plant inventory.
- **2026-09-26**: First orchard layout (never planted; removed 2026-10-06).

## Repository layout

```text
Mountain-Prairie-Acres/
├── README.md                              Project tracker and log (this file)
├── tools/
│   ├── site_grid.py                       Master-grid helper and command line (reads docs/data)
│   └── test_site_grid.py                  Tests for the helper and the grid data
└── docs/                                  Website root for GitHub Pages
    ├── index.html                         Home page: links to every project
    ├── orchard_pollination_grid.html      Planting map, pollination pairings, windbreak
    ├── metal_tag_planting_checklist.html  Field sheet: metal tag to grid position
    ├── orchard_water_harvesting_plan.html Rain and snowmelt harvesting plan
    ├── site_terrain_water_map.html        Whole-site elevation, runoff, and slope maps
    ├── homestead_plot_map.html            Homestead buildings, pads, and drives to scale
    ├── site_master_grid.html              The master grid, feature coordinates, code usage
    ├── data/
    │   ├── site_grid.js                   Grid, features, lat/long tie, and SiteGrid helpers
    │   └── site_terrain.js                Lidar elevation grid, contours, flow paths, divides
    ├── Inventory_PrairiePlants.xlsx       What is on the property (linked from the grid)
    ├── Trees.xlsx                         Purchase list and fruit data (linked from the grid)
    ├── downloads/                         Printable PDF versions of the pages
    └── soil/                              NRCS Web Soil Survey report and SSURGO metadata
```

## Coordinates and the master grid

Every map and helper uses the same lot coordinates, in feet: **x** is east of the west fence and **y** is south of the north fence, with (0, 0) at the northwest fence corner. The fences run true north–south and east–west, 331 × 1,292 ft (9.83 acres). For quick reference the lot is split into 50 ft cells, column letters A–G west to east and row numbers 1–26 north to south, so the irrigation tank at x 63, y 921 is in **B19**.

- The data lives in [`docs/data/site_grid.js`](docs/data/site_grid.js) (grid, features, and the latitude/longitude tie) and [`docs/data/site_terrain.js`](docs/data/site_terrain.js) (lidar elevations). Each holds strict JSON between `BEGIN` and `END` markers, so pages load it with a `<script>` tag and Python reads the same block.
- In a page, load both files and call `SiteGrid`: `SiteGrid.cellOf(63, 921)` gives `"B19"`, `SiteGrid.center('pump_house')`, `SiteGrid.elevationFt(x, y)`, `SiteGrid.toLatLon(x, y)`, and `SiteGrid.fromLatLon(lat, lon)`.
- From the command line: `python tools/site_grid.py feature pump_house`, `python tools/site_grid.py cell 63 921`, `python tools/site_grid.py tree 5 3` (orchard tree R5-C3), `python tools/site_grid.py fromlatlon 43.473383 -115.594507`, or `python tools/site_grid.py list homestead`.
- To add or move a feature, edit the JSON in `site_grid.js` (shapes: `rect`, `circle`, `polygon`, `line`, `point`), then run `python -m unittest discover -s tools`.

Latitude and longitude come from fitting the fence lines on USGS NAIP imagery and are good to about 10 ft: fine for maps and directions, not for boundary questions.

## Adding or updating a project

1. Save the page in `docs/` and its PDF, if any, in `docs/downloads/`. Use lowercase file names without spaces so web links stay simple.
2. Add a card for it on [`docs/index.html`](docs/index.html) and a row in the project tracker above.
3. Add a dated line to the project log.
4. Commit and push. GitHub Pages republishes the site within a minute or two.

Keep vendor catalogs, e-books, and text copied from nursery websites out of this public repository; link to the source instead.

## Printing

Each page has its own print setup at the top. The pollination grid, the whole-site maps, and the homestead plot map print on Tabloid (11 × 17 in) landscape, and the site master grid on Tabloid portrait; the checklist and the water-harvesting plan print on Letter portrait. Turn on background graphics and turn off the browser's headers and footers.

## Sources and credits

- Soil: USDA NRCS Web Soil Survey and Soil Data Access (Simonton loam, map unit 149, Elmore County Area, Idaho).
- Terrain: USGS 3D Elevation Program (3DEP) 1 m lidar elevation model, used by every map; earlier versions traced the owner's USGS 1 m contour screenshots.
- Lot frame and homestead: USGS NAIP aerial imagery, fitted to the fence lines; the owner's drone photos (October 2026).
- Climate: PRISM Climate Group, Oregon State University (1991–2020 normals); ERA5 reanalysis via Open-Meteo.
- Water harvesting: Brad Lancaster, *Rainwater Harvesting for Drylands and Beyond*, Volumes 1 and 2.
- Fruit-tree site and disease guidance: UC Statewide IPM Program; windbreak and plant sources are cited on each page.
