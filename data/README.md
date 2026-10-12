# Canonical property records

These JSON files are the source of truth. SQLite and the browser files in [`docs/data`](../docs/data/) are generated copies. The original [inventory](../docs/Inventory_PrairiePlants.xlsx) and [purchase workbook](../docs/Trees.xlsx) are retained for provenance; editing those workbooks does not update the canonical records automatically.

## Collections

| File | Information |
|---|---|
| [site.json](site.json) | Lot frame, 50 ft master cells, GPS tie, orchard coordinate system, buildings, water pipes, hydrants, and other mapped features |
| [terrain.json](terrain.json) | Complete USGS lidar mesh, contours, flow paths, drainage split, ridge, ditch, high/low points, and drainage areas; elevations are NAVD88 |
| [inventory.json](inventory.json) | 119 original inventory quantity groups, metal tags, disease flags, locations, relocation-date text, notes, and workbook zones |
| [catalog.json](catalog.json) | Cultivar source entries and structured Fruit, Berry, Herbs, and Trees workbook cells, including zero-quantity purchase-list entries |
| [plants.json](plants.json) | One stable Plant ID per individual inventory item, inventory/instance link, planning group, and living/dead status |
| [locations.json](locations.json) | Orchard spots and any additional named planting locations; lot feet, optional orchard row/column, reservations, and replacements |
| [plantings.json](plantings.json) | Planned, confirmed-planted, vacated, dead, and outside-orchard assignments; unknown planting dates remain `null` |
| [plant_events.json](plant_events.json) | Owner reports and history; reporting date is separate from the event's actual date |
| [orchard.json](orchard.json) | Purchase reconciliation, pollination research/rules, fruit-row blocks, windbreak, hedge, and guild design |
| [water_harvesting.json](water_harvesting.json) | Monthly precipitation/ET0, sources and units, soil layers, sizing assumptions, ten water-harvesting techniques, calendar, catchments, and observations |

The initial records were imported from the existing website and workbooks. Nursery prose in the purchase workbook's Notes sheet is not republished as a new JSON collection. It remains in the original source workbook.

## Daily workflow

From the repository root:

```powershell
python tools\property_data.py build
python tools\property_data.py check
python tools\property_data.py query "SELECT plant_id, metal_tag, status, site_ref FROM current_plantings WHERE cell = 'C17'"
```

`build` validates the records, atomically rebuilds [`build/property.sqlite`](../build/property.sqlite) if the inputs changed, and generates the browser data. `query` performs the same freshness check but does not publish or rewrite website data. `check` rejects invalid records and stale generated browser files. Python 3.11+ is recommended; SQLite 3.37+ with JSON functions is required.

Use the existing test runners:

```powershell
python -m unittest discover -s tools
node --test tools\test_site_grid.js tools\test_property_data.js
```

Before publishing, run `build`, tests, and `check`, refresh the PDFs affected by the record changes, and commit both the JSON and generated browser data. GitHub Actions checks this on pushes and pull requests. The local database and temporary SQLite files are not committed.

## Plant identity is not location

- A metal tag can identify several otherwise identical trees. `i56-1` is one individual in inventory group 56, not all 12 M-111 rootstocks.
- `orchard-r6-c3` is the spot. Its location is x 83, y 485, giving **B10-E33-S35**.
- SiteRef, cell offsets, and latitude/longitude are calculated, not independently edited fields. Coordinates in `locations.json` are feet east/south from the northwest fence corner.
- To enter a SiteRef, decode it using `python tools\site_grid.py site-ref C17-E12-S18`, then store x 112, y 818. GPS input can be converted with the same grid helper; allow for roughly 10 ft map accuracy plus device error.
- An unlocated plant has no active assignment and displays **PENDING**. Do not use its former orchard slot as its current outside location.
- A `planned` assignment is not proof of planting. Only the M-111 at R6-C3 was explicitly confirmed planted in the current records. Its exact planting date is unknown.
- Keep a dead plant and its history; mark its assignment `dead`, keep its health `dead`, and leave its spot open. Do not delete it to make the count smaller.

### Adding an outside location

Add a location with a new ID, x/y feet, and `orchard_row`/`orchard_column` set to `null`. Keep reservation/replacement fields `null` unless they are known. Add an assignment with the plant's ID and that location's ID; use `planned` until planting is confirmed. Keep the earlier outside-orchard assignment as history.

### Water observations and catchments

Catchment areas are initially `null`: the map's building dimensions are not assumed to include roof eaves. Enter a measured `area_sqft` to calculate the budget. The browser calculator permits temporary what-if inputs; it does not save them back to JSON.

Add water observations to the `observations` array with `id`, optional `location_id`, `observed_on` (`YYYY-MM-DD`), `observation_type`, optional numeric `value` and `unit`, and `notes`. No rain-gauge or perc-test measurements have been invented.

## Validation and change rules

IDs must be unique. Inventory quantities must match their individual instances. Assignments/events must reference existing plants and locations. A living plant/spot can have only one active assignment; dead trees cannot occupy active spots. Orchard coordinates must match the shared row spacing. Terrain sample count must match the mesh, climate must cover all twelve months, and runoff factors must be between 0 and 1.

Record collections carry `schema_version: 1`. Extend the builder and SQL schema together when adding a new collection or relational field. Extra JSON properties remain available through the lossless `source_documents` SQL table; promote them to typed columns when needed for regular queries. Unknown quantities, coordinates, dates, or measurements must stay unknown, not become zero or a guessed value.
