# Mountain Prairie Acres

Orchard and ranch projects for our property in Prairie, Idaho: plans, field checklists, and the data behind them. This repository is public on purpose; nothing here is private.

**Website:** <https://srnichols.github.io/Mountain-Prairie-Acres/>, published with GitHub Pages from the [`docs`](docs/) folder.

## Project tracker

| Project | Status | Pages and downloads | Next steps | Updated |
|---|---|---|---|---|
| Orchard planting, fall 2026 | In progress | [Pollination grid and west windbreak](https://srnichols.github.io/Mountain-Prairie-Acres/orchard_pollination_grid.html) ([PDF](docs/downloads/orchard_pollination_grid.pdf)) · [Metal-tag planting checklist](https://srnichols.github.io/Mountain-Prairie-Acres/metal_tag_planting_checklist.html) ([PDF](docs/downloads/metal_tag_planting_checklist.pdf)) | Plant R2–R12 by metal tag, south to north; hold R1 for grafted rootstock apples; plant the west windbreak, berry guilds, and elderberry hedge | 2026-10-05 |
| Rain and snowmelt harvesting | Planned | [Water-harvesting plan](https://srnichols.github.io/Mountain-Prairie-Acres/orchard_water_harvesting_plan.html) ([PDF](docs/downloads/orchard_water_harvesting_plan.pdf)) | Perc tests in three spots before freeze-up; shape crescent basins as trees go in; set up a rain gauge; gutters, spreader, and driveway basins in 2027 | 2026-10-06 |
| Soil and site data | Reference | [NRCS Web Soil Survey report](docs/soil/WebSoilSurvey_PrairieID.pdf) · [SSURGO metadata](docs/soil/) · USGS 1 m terrain (traced into the water plan) | Add perc-test and rain-gauge results as they come in | 2026-10-06 |
| Plant inventory and purchase records | Ongoing | [Inventory_PrairiePlants.xlsx](docs/Inventory_PrairiePlants.xlsx) · [Trees.xlsx](docs/Trees.xlsx) | Keep the inventory current as trees are planted, moved, or lost | 2026-10-04 |
| First orchard layout | Archived | [Historical orchard overview](https://srnichols.github.io/Mountain-Prairie-Acres/orchard_planting_guide.html) | Replaced by the pollination grid; kept for history | 2026-09-26 |

Status key: **In progress** (work under way), **Planned** (designed, not started), **Ongoing** (kept up to date), **Reference** (source data), **Archived** (kept for history).

## Project log

- **2026-10-06**: Created this repository and website. Added the orchard rain and snowmelt harvesting plan (USGS 1 m terrain, NRCS soil, PRISM climate) and the NRCS Web Soil Survey report for the property.
- **2026-10-05**: Finished the pollination grid with the west windbreak, and the metal-tag planting checklist for fall planting.
- **2026-10-04**: Updated the Prairie plant inventory.
- **2026-09-26**: First orchard layout (now archived).

## Repository layout

```text
Mountain-Prairie-Acres/
├── README.md                              Project tracker and log (this file)
└── docs/                                  Website root for GitHub Pages
    ├── index.html                         Home page: links to every project
    ├── orchard_pollination_grid.html      Planting map, pollination pairings, windbreak
    ├── metal_tag_planting_checklist.html  Field sheet: metal tag to grid position
    ├── orchard_water_harvesting_plan.html Rain and snowmelt harvesting plan
    ├── orchard_planting_guide.html        First orchard layout (archived)
    ├── Inventory_PrairiePlants.xlsx       What is on the property (linked from the grid)
    ├── Trees.xlsx                         Purchase list and fruit data (linked from the grid)
    ├── downloads/                         Printable PDF versions of the pages
    └── soil/                              NRCS Web Soil Survey report and SSURGO metadata
```

## Adding or updating a project

1. Save the page in `docs/` and its PDF, if any, in `docs/downloads/`. Use lowercase file names without spaces so web links stay simple.
2. Add a card for it on [`docs/index.html`](docs/index.html) and a row in the project tracker above.
3. Add a dated line to the project log.
4. Commit and push. GitHub Pages republishes the site within a minute or two.

Keep vendor catalogs, e-books, and text copied from nursery websites out of this public repository; link to the source instead.

## Printing

Each page has its own print setup at the top. The pollination grid prints on Tabloid (11 × 17 in) landscape; the checklist and the water-harvesting plan print on Letter portrait. Turn on background graphics and turn off the browser's headers and footers.

## Sources and credits

- Soil: USDA NRCS Web Soil Survey and Soil Data Access (Simonton loam, map unit 149, Elmore County Area, Idaho).
- Terrain: USGS 1 m elevation data (contours and flow paths).
- Climate: PRISM Climate Group, Oregon State University (1991–2020 normals); ERA5 reanalysis via Open-Meteo.
- Water harvesting: Brad Lancaster, *Rainwater Harvesting for Drylands and Beyond*, Volumes 1 and 2.
- Fruit-tree site and disease guidance: UC Statewide IPM Program; windbreak and plant sources are cited on each page.
