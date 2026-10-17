# Mountain Prairie Acres

Orchard and ranch projects for our property in Prairie, Idaho: plans, field checklists, and the data behind them. This repository is public on purpose; nothing here is private.

**Website:** <https://srnichols.github.io/Mountain-Prairie-Acres/>, published with GitHub Pages from the [`docs`](docs/) folder.

**Property records:** Git-tracked JSON in [`data/`](data/) is the source of truth. The [data guide](data/README.md), [SQLite schema and queries](database/README.md), and [website guide](https://srnichols.github.io/Mountain-Prairie-Acres/property_data.html) cover editing, rebuilding, and querying.

**Location:** the driveway leaves the north road at 43.47550, −115.59364 ([map and directions](https://www.google.com/maps/search/?api=1&query=43.475504,-115.593643)).

## Project tracker

| Project | Status | Pages and downloads | Next steps | Updated |
|---|---|---|---|---|
| Orchard planting, fall 2026 | In progress | [Pollination grid and west windbreak](https://srnichols.github.io/Mountain-Prairie-Acres/orchard_pollination_grid.html) ([PDF](docs/downloads/orchard_pollination_grid.pdf)) · [Metal-tag planting checklist](https://srnichols.github.io/Mountain-Prairie-Acres/metal_tag_planting_checklist.html) ([PDF](docs/downloads/metal_tag_planting_checklist.pdf)) | Hold R1 for grafted rootstock apples; leave R4-C9, R5-C9, and R5-C10 open for 2027 trees, and R8-C1 for a 2027 pear; locate the Urban apples outside the orchard; the R6-C3 M-111 rootstock and the R8-C3 PR-Asian pear are planted; plant the windbreak, berry guilds, and hedge | 2026-10-17 |
| Cultivar library and guide | Ongoing | [Cultivar guide](https://srnichols.github.io/Mountain-Prairie-Acres/cultivar_guide.html) ([PDF](docs/downloads/cultivar_guide.pdf)) · [`data/cultivar_library.json`](data/cultivar_library.json) | Add a profile for each new plant; note bark, leaf, and habit observations on your own trees; upgrade general-knowledge entries to sourced | 2026-10-17 |
| Unidentified apples (AL-UnKn) | Ongoing | [Possibility list and ID log](https://srnichols.github.io/Mountain-Prairie-Acres/unidentified_apple_id_sheet.html) ([PDF](docs/downloads/unidentified_apple_id_sheet.pdf)) | Number the six trees at planting; log bloom, fruit, bark, and leaves; narrow the possibilities as each tree identifies itself | 2026-10-17 |
| Unidentified stone fruit (CR-Sweet, PC-Unk, AT-Unk) | Ongoing | [Possibility lists and ID logs](https://srnichols.github.io/Mountain-Prairie-Acres/unidentified_stone_fruit_id_sheet.html) ([PDF](docs/downloads/unidentified_stone_fruit_id_sheet.pdf)) | Confirm whether every purchased cherry, peach, and apricot arrived; number the six trees at planting; log bloom, fruit, bark, and leaves; compare the two Moorpark-tagged apricots with the unidentified one | 2026-10-17 |
| Rain and snowmelt harvesting | Planned | [Water-harvesting plan](https://srnichols.github.io/Mountain-Prairie-Acres/orchard_water_harvesting_plan.html) ([PDF](docs/downloads/orchard_water_harvesting_plan.pdf)) | Perc tests in three spots before freeze-up; shape crescent basins as trees go in; set up a rain gauge; gutters, spreader, and driveway basins in 2027 | 2026-10-06 |
| Whole-site terrain and water maps | Reference | [Site terrain and water maps](https://srnichols.github.io/Mountain-Prairie-Acres/site_terrain_water_map.html) ([PDF](docs/downloads/site_terrain_water_map.pdf)) | Use to site future projects (tank, pond, basins, outbuildings); check key spots with a level | 2026-10-06 |
| Homestead plot map | Reference | [Homestead plot map](https://srnichols.github.io/Mountain-Prairie-Acres/homestead_plot_map.html) ([PDF](docs/downloads/homestead_plot_map.pdf)) | Stake the planned house, garage, and workshop; check the hydrant spots on the ground | 2026-10-07 |
| Site master grid and code helpers | Reference | [Site master grid](https://srnichols.github.io/Mountain-Prairie-Acres/site_master_grid.html) ([PDF](docs/downloads/site_master_grid.pdf)) · [`docs/data/`](docs/data/) · [`tools/site_grid.py`](tools/site_grid.py) | Use SiteRef codes for individual planting locations; add new features to the grid data as projects start | 2026-10-11 |
| Canonical property data and SQLite | Ongoing | [Data and query guide](https://srnichols.github.io/Mountain-Prairie-Acres/property_data.html) · [`data/`](data/) · [`database/`](database/) · [`tools/property_data.py`](tools/property_data.py) | Edit JSON, rebuild and validate, query locally; add measured outside locations and water observations when supplied | 2026-10-12 |
| Soil and site data | Reference | [NRCS Web Soil Survey report](docs/soil/WebSoilSurvey_PrairieID.pdf) · [SSURGO metadata](docs/soil/) · USGS lidar terrain ([`site_terrain.js`](docs/data/site_terrain.js)) | Add perc-test and rain-gauge results as they come in | 2026-10-06 |
| Plant inventory and purchase records | Ongoing | [`data/`](data/) · original [Inventory_PrairiePlants.xlsx](docs/Inventory_PrairiePlants.xlsx) and [Trees.xlsx](docs/Trees.xlsx) | Keep canonical JSON current as plants are assigned, planted, moved, or lost; original workbooks remain provenance | 2026-10-12 |

Status key: **In progress** (work under way), **Planned** (designed, not started), **Ongoing** (kept up to date), **Reference** (source data), **Archived** (kept for history).

## Project log

- **2026-10-17**: Added possibility lists with printable ID logs for the six other unidentified trees: three CR-Sweet cherries, two PC-Unk peaches, and the AT-Unk apricot. They reason from the purchase list as the apple list does, on the assumption (not yet confirmed) that every purchased tree arrived. The apricot list also flags that two trees are tagged Moorpark although only one was bought. The cultivar library grows to 137 profiles: the four candidate cultivars (Regina, Sam Sweet, Veteran, Patterson), the other purchases that have no tagged tree (Thorn perry pear, shellbark hickory, eastern serviceberry), and all 28 species on the seed list (the `Trees` sheet). Profiles link to their seed-list row, and the guide shows your zone, size, and sowing notes beside each.
- **2026-10-17**: Recorded the PR-Asian pear (inventory row 94) as planted at R8-C3, not the planned R8-C1. R8-C1 is empty and is now the open 2027 pear spot, so the Pineapple's open slot moved from R8-C3 to R8-C1. The grid marks planted trees with a check mark, the planting checklist checks their boxes, and the berry guild at R8-C1 stays in place. Extended the cultivar library to every inventory line (112 profiles: fruit, nut, and berry plants, windbreak and shade trees, perennials, an unconfirmed raspberry, and the apple rootstocks). Added habit, bark, and leaf notes wherever a source describes the specific plant, a general note for each fruit-tree type, and bark and leaf lines to the unidentified-apple ID log.
- **2026-10-16**: Added a cultivar library with a searchable guide, short descriptions on the pollination grid and planting checklist, and a possibility list with a printable ID log for the six unidentified AL-UnKn apples. Every purchased apple arrived, so purchases with no tagged tree are presumed to have died in Boise, unrecorded.
- **2026-10-12**: Created canonical JSON collections and a validated SQLite build/query workflow for plants, locations/history, purchase and cultivar records, mapped site features, full lidar terrain, climate/soil, and water harvesting. Both planting checklists now share one generated model; the water plan uses current orchard occupants rather than its old snapshot. Unknown outside locations, dates, and roof areas remain unknown. Added source-fidelity, integrity, freshness, CLI, and browser-model tests plus GitHub Actions validation; refreshed the four affected PDFs.
- **2026-10-11**: Adopted compact SiteRef location codes (`CELL-Eoffset-Soffset`) in the master-grid guide, orchard planting checklist, and tree inventory. The M-111 at R6-C3 is `B10-E33-S35`; outside-orchard locations not yet supplied remain `PENDING`. Added shared JavaScript and Python formatting/decoding helpers and tests, and refreshed the three related printable PDFs. Metal tags, plant IDs, planting positions, and inventory workbooks are unchanged.
- **2026-10-11**: Left R4-C9 (AL-UrbGrn), R5-C9 (AL-UrbR), and R5-C10 (AL-UrbGld) open for new trees in 2027. These three living Urban apples will be planted outside the orchard; grid locations are pending. Recorded an M-111 apple rootstock from inventory row 56 as planted at R6-C3, leaving 11 of the original 12 M-111 rootstocks available. The orchard now holds 110 living fruit trees plus 1 planted rootstock; the dead pear and outside-orchard trees are not pollen partners.
- **2026-10-11**: Marked the Pineapple pear (PR-Pineap, inventory row 108) at R8-C3 as dead. The spot stays open for now, with a new pear planned for 2027 (variety not yet chosen). Updated the planting grid, checklist, and printable copies; other tree positions are unchanged, and the dead tree is excluded from living-tree counts and pollination partners.
- **2026-10-07**: Added the hydrant at the end of the 2 in branch into the island, for eight hydrants in all.
- **2026-10-06**: Added the buried water lines and seven frost-free hydrants from the owner's hand-drawn map to the grid data, the site master grid, and the homestead plot map: a 2 in PVC main from the pump house east through the yard and north beside the driveway to the north end, with 2 in branches, and 1.5 in lines west to the fence, along the west fence, and at the north end. The site master grid PDF is now two pages.
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
├── data/                                  Canonical, editable JSON records and editing guide
│   ├── site.json                          Lot/grid/GPS, features, water pipes, and hydrants
│   ├── terrain.json                       Complete lidar mesh, contours, flow paths, drainage
│   ├── inventory.json                     Original quantity groups and source metadata
│   ├── catalog.json                       Cultivar and structured purchase-workbook records
│   ├── cultivar_library.json              Plant profiles (appearance, use, bark, leaves, sources) and group notes
│   ├── plants.json                        Stable IDs for individual plants/items
│   ├── locations.json                     Orchard spots and other measured locations
│   ├── plantings.json                     Planned/planted/vacated assignments
│   ├── plant_events.json                  Owner reports and history
│   ├── orchard.json                       Pollination and windbreak/guild design rules
│   └── water_harvesting.json              Climate, soil, techniques, catchments, observations
├── database/
│   ├── schema.sql                         Typed SQLite tables, relationships, and query views
│   └── queries/                           Reusable orchard, terrain, and water SQL
├── build/                                 Ignored, regenerable property.sqlite
├── web/                                   Authored browser helpers/model/checklist renderer
├── tools/
│   ├── property_data.py                   Validate/build/check/read-only query command
│   ├── site_grid.py                       Master-grid helper and command line (reads data/)
│   ├── test_property_data.py              Data, database, integrity, freshness tests
│   ├── test_property_cli.py               Isolated end-to-end command-line workflows
│   ├── test_property_data.js              Generated browser-model parity tests
│   ├── test_site_grid.py                  Tests for the Python helper and the grid data
│   └── test_site_grid.js                  Tests for the JavaScript SiteRef helpers
└── docs/                                  Website root for GitHub Pages
    ├── index.html                         Home page: links to every project
    ├── property_data.html                 Public editing/build/query guide
    ├── orchard_pollination_grid.html      Planting map, pollination pairings, windbreak
    ├── metal_tag_planting_checklist.html  Field sheet: metal tag to grid position
    ├── cultivar_guide.html                Searchable guide to every plant profile
    ├── unidentified_apple_id_sheet.html   Possibility list and ID log for the AL-UnKn apples
    ├── unidentified_stone_fruit_id_sheet.html Possibility lists and ID logs for the unlabeled cherries, peaches, and apricot
    ├── orchard_water_harvesting_plan.html Rain and snowmelt harvesting plan
    ├── site_terrain_water_map.html        Whole-site elevation, runoff, and slope maps
    ├── homestead_plot_map.html            Homestead buildings, pads, and drives to scale
    ├── site_master_grid.html              The master grid, feature coordinates, code usage
    ├── data/
    │   ├── site_grid.js                   Generated grid and coordinate helpers
    │   ├── site_terrain.js                Generated full terrain layer
    │   ├── orchard_model.js               Generated records and shared orchard model
    │   ├── cultivar_library.js            Generated plant profiles and shared lookup helper
    │   ├── planting_checklist.js          Generated shared field-sheet renderer
    │   ├── water_harvesting.js            Generated climate, soil, techniques, catchments
    │   └── manifest.json                 Source fingerprint and generated record counts
    ├── Inventory_PrairiePlants.xlsx       Original inventory source workbook
    ├── Trees.xlsx                         Original purchase/cultivar source workbook
    ├── downloads/                         Printable PDF versions of the pages
    └── soil/                              NRCS Web Soil Survey report and SSURGO metadata
```

## Coordinates and the master grid

Every map and helper uses the same lot coordinates, in feet: **x** is east of the west fence and **y** is south of the north fence, with (0, 0) at the northwest fence corner. The fences run true north–south and east–west, 331 × 1,292 ft (9.83 acres). For quick reference the lot is split into 50 ft cells, column letters A–G west to east and row numbers 1–26 north to south, so the irrigation tank at x 63, y 921 is in **B19**.

### Compact SiteRef codes

Use **`CELL-Eoffset-Soffset`** in a single printed location column. Both offsets are feet from **that master cell's northwest corner**: east first, south second. For example, **`C17-E12-S18`** is x 112, y 818; **`B10-E33-S35`** is the M-111 rootstock's orchard spot R6-C3 at x 83, y 485 in the current layout. Decimals are feet (`E12.5` means 12.5 ft, not 12 ft 5 in).

- Keep cell and offsets as underlying planting-location values; generate SiteRef rather than editing a second copy. Track each plant individually when tags or inventory quantity rows cover several trees.
- SiteRef identifies a **spot**, not a permanent plant identity. Keep metal tags and Plant IDs separately. A replacement tree may reuse a location code; a dead tree and a vacant spot are different records.
- Use **`PENDING`** for a location not yet supplied. The Urban apples planned outside the orchard remain unlocated; their vacated orchard spots have known codes, not the trees' new locations.
- Generated codes round to 0.01 ft. Offsets must be nonnegative, less than 50 ft, and resolve inside the fenced lot. East and south are compass directions, regardless of the orchard map's south-up view. Code precision does not make the roughly 10 ft GPS tie survey-grade; use measured offsets for precise planting.
- GPS coordinates correlate to the same grid: `SiteGrid.siteRef(...SiteGrid.fromLatLon(latitude, longitude))` or Python `grid.site_ref(*grid.from_latlon(latitude, longitude))`. The shared georeference calculates each cell's corner latitude/longitude; it is not a second manually maintained coordinate table. Supply latitude first and negative longitude for Idaho. Phone GPS error adds to the map's approximate 10 ft accuracy, especially near cell boundaries.

### Using the shared helpers

- Canonical data lives in [`data/site.json`](data/site.json) and [`data/terrain.json`](data/terrain.json). The builder generates [`docs/data/site_grid.js`](docs/data/site_grid.js) and [`docs/data/site_terrain.js`](docs/data/site_terrain.js) for synchronous/offline-compatible browser use. Python reads the canonical JSON directly; generated marker blocks remain compatible with existing consumers.
- In a page, load both files and call `SiteGrid`: `SiteGrid.cellOf(63, 921)` gives `"B19"`, `SiteGrid.center('pump_house')`, `SiteGrid.elevationFt(x, y)`, `SiteGrid.toLatLon(x, y)`, and `SiteGrid.fromLatLon(lat, lon)`.
- From the command line: `python tools/site_grid.py feature pump_house`, `python tools/site_grid.py cell 63 921`, `python tools/site_grid.py tree 5 3` (orchard tree R5-C3), `python tools/site_grid.py fromlatlon 43.473383 -115.594507`, or `python tools/site_grid.py list homestead`.
- Format a SiteRef with `SiteGrid.siteRef(112, 818)` or Python `grid.site_ref(112, 818)`; decode one with `SiteGrid.fromSiteRef('C17-E12-S18')`, `grid.from_site_ref('C17-E12-S18')`, or `python tools/site_grid.py site-ref C17-E12-S18`. Decoding `PENDING` returns `null` in JavaScript and `None` in Python, not invented coordinates.
- To add or move a feature, edit [`data/site.json`](data/site.json) (shapes: `rect`, `circle`, `polygon`, `line`, `point`), run `python tools/property_data.py build`, and test. Water lines are `line` features with `"kind": "water_pipe"` and `"size_in"`, and hydrants are `point` features with `"kind": "hydrant"`; maps read the generated data.

Latitude and longitude come from fitting the fence lines on USGS NAIP imagery and are good to about 10 ft: fine for maps and directions, not for boundary questions.

Run tests with `python -m unittest discover -s tools` and `node --test tools/test_site_grid.js tools/test_property_data.js`.

## JSON to SQLite and website workflow

```powershell
python tools\property_data.py build
python tools\property_data.py check
python tools\property_data.py query "SELECT metal_tag, site_ref, status FROM current_plantings WHERE cell = 'C17'"
python tools\property_data.py query --file database\queries\terrain_by_cell.sql
python tools\property_data.py query --file database\queries\water_budget.sql
```

The local database is [`build/property.sqlite`](build/property.sqlite), ignored by Git and rebuilt atomically from validated records. Queries automatically rebuild stale data, stay read-only, and do not publish the website. For an external SQLite viewer, run `build` first. Source/schema/compiler fingerprints detect changes rather than trusting timestamps.

`current_plantings` and `orchard_spots` distinguish a planned assignment, a confirmed planting, a dead plant, and an open spot. A reporting date is not an invented planting date. Unknown outside locations and catchment areas remain `PENDING`/`NULL`. Full source JSON, structured workbook cells, terrain geometry, units, and provenance remain queryable. See the [editing guide](data/README.md) and [table/view guide](database/README.md).

Publish JSON and generated browser files together, refresh affected PDFs, and run `check` before committing. [GitHub Actions](.github/workflows/property-data.yml) verifies data freshness and tests; GitHub Pages remains a static site without database writes.

## Adding or updating a project

1. Save the page in `docs/` and its PDF, if any, in `docs/downloads/`. Use lowercase file names without spaces so web links stay simple.
2. Add a card for it on [`docs/index.html`](docs/index.html) and a row in the project tracker above.
3. Add a dated line to the project log.
4. Commit and push. GitHub Pages republishes the site within a minute or two.

Keep vendor catalogs, e-books, and text copied from nursery websites out of this public repository; link to the source instead.

## Printing

Each page has its own print setup at the top. The pollination grid, the whole-site maps, and the homestead plot map print on Tabloid (11 × 17 in) landscape, and the site master grid on Tabloid portrait (two pages: the map and coordinates, then the code examples); the checklist and the water-harvesting plan print on Letter portrait. Turn on background graphics and turn off the browser's headers and footers.

## Sources and credits

- Soil: USDA NRCS Web Soil Survey and Soil Data Access (Simonton loam, map unit 149, Elmore County Area, Idaho).
- Terrain: USGS 3D Elevation Program (3DEP) 1 m lidar elevation model, used by every map; earlier versions traced the owner's USGS 1 m contour screenshots.
- Lot frame and homestead: USGS NAIP aerial imagery, fitted to the fence lines; the owner's drone photos (October 2026).
- Water lines and hydrants: the owner's hand-drawn map on a printed aerial (October 2026), registered to the mapped buildings.
- Climate: PRISM Climate Group, Oregon State University (1991–2020 normals); ERA5 reanalysis via Open-Meteo.
- Water harvesting: Brad Lancaster, *Rainwater Harvesting for Drylands and Beyond*, Volumes 1 and 2.
- Fruit-tree site and disease guidance: UC Statewide IPM Program; windbreak and plant sources are cited on each page.
