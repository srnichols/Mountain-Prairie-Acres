# Canonical property records

These JSON files are the source of truth. SQLite and the browser files in [`docs/data`](../docs/data/) are generated copies. The original [inventory](../docs/Inventory_PrairiePlants.xlsx) and [purchase workbook](../docs/Trees.xlsx) are retained for provenance; editing those workbooks does not update the canonical records automatically.

## Collections

| File | Information |
|---|---|
| [site.json](site.json) | Lot frame, 50 ft master cells, GPS tie, orchard coordinate system, buildings, water pipes, hydrants, and other mapped features |
| [terrain.json](terrain.json) | Complete USGS lidar mesh, contours, flow paths, drainage split, ridge, ditch, high/low points, and drainage areas; elevations are NAVD88 |
| [inventory.json](inventory.json) | 119 original inventory quantity groups, metal tags, disease flags, locations, relocation-date text, notes, and workbook zones |
| [catalog.json](catalog.json) | Cultivar source entries and structured Fruit, Berry, Herbs, and Trees workbook cells, including zero-quantity purchase-list entries |
| [cultivar_library.json](cultivar_library.json) | One plain-language profile per cultivar, species, genus, or rootstock in the inventory (fruit, nut, and berry plants, windbreak and shade trees, perennials, ungrafted apple rootstocks): appearance, flavor and use, ripening, how to recognize it, habit, bark, and leaves where a source describes them, sources, and links to inventory lines and purchase rows; a general habit/bark/leaf note for each fruit-tree type; inventory lines left without a profile, and why |
| [plants.json](plants.json) | One stable Plant ID per individual inventory item, inventory/instance link, planning group, and living/dead status |
| [locations.json](locations.json) | Orchard spots and any additional named planting locations; lot feet, optional orchard row/column, reservations, and replacements |
| [plantings.json](plantings.json) | Planned, confirmed-planted, vacated, dead, and outside-orchard assignments; unknown planting dates remain `null` |
| [plant_events.json](plant_events.json) | Owner reports and history; reporting date is separate from the event's actual date |
| [orchard.json](orchard.json) | Purchase reconciliation, pollination research/rules, the possibility list for the unidentified apples, fruit-row blocks, windbreak, hedge, and guild design |
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
- A `planned` assignment is not proof of planting. Only the M-111 at R6-C3 and the PR-Asian pear at R8-C3 are confirmed planted in the current records. Their exact planting dates are unknown.
- Keep a dead plant and its history; mark its assignment `dead`, keep its health `dead`, and leave its spot open. Do not delete it to make the count smaller.
- A dead or relocated tree keeps one slot in the orchard plan, and the open spot waiting for a replacement is that slot. If a living tree is found in the dead tree's slot, move the living tree's assignment there (`planted` if it is in the ground), give the dead plant's assignment the spot that is now empty, move the `replacement_year` and `replacement_type` to that spot, and record the owner's report as a plant event. That is how the PR-Asian pear moved from R8-C1 to R8-C3 and the open 2027 pear spot became R8-C1.

### Adding an outside location

Add a location with a new ID, x/y feet, and `orchard_row`/`orchard_column` set to `null`. Keep reservation/replacement fields `null` unless they are known. Add an assignment with the plant's ID and that location's ID; use `planned` until planting is confirmed. Keep the earlier outside-orchard assignment as history.

### Water observations and catchments

Catchment areas are initially `null`: the map's building dimensions are not assumed to include roof eaves. Enter a measured `area_sqft` to calculate the budget. The browser calculator permits temporary what-if inputs; it does not save them back to JSON.

Add water observations to the `observations` array with `id`, optional `location_id`, `observed_on` (`YYYY-MM-DD`), `observation_type`, optional numeric `value` and `unit`, and `notes`. No rain-gauge or perc-test measurements have been invented.

## Cultivar library

[cultivar_library.json](cultivar_library.json) holds one profile per cultivar, species, genus, or rootstock in the inventory: fruit, nut, and berry plants, windbreak and shade trees, perennials, and the ungrafted apple rootstocks. The [cultivar guide](../docs/cultivar_guide.html), the pollination grid's tooltips and tree rows, the planting checklist, and the [unidentified-apple sheet](../docs/unidentified_apple_id_sheet.html) all read it. The guide counts a plant as on hand unless its health is `dead`, and says how many are reported dead. Each profile has a short tagline and summary, appearance, flavor and use (uses and care for non-food plants), ripening band and timing, how to recognize it, habit, bark, and leaves, hardiness, sources, and a `basis`: `sourced` (every claim backed by its listed sources) or `general` (partly general knowledge). `kind` is `cultivar`, `species`, `genus` (the species is not recorded, such as the oaks), or `rootstock`. Bloom group, ploidy, and fertility stay on the purchase-sheet rows in [catalog.json](catalog.json), not here.

- **Links are by row, never by tag text.** `inventory_rows` lists the inventory lines a profile covers and `purchase_rows` the purchase-sheet rows. Tags are free text and not unique (`AL-Fuji` is on two cultivars). A row belongs to at most one profile, and a profile's purchase rows must include the purchase match of each of its inventory lines.
- **Every inventory line needs a profile or an entry in `unprofiled` with a reason** (unidentified plants, a rootstock of unknown type). Adding an inventory line without one fails `check`, which lists the missing rows.
- **Habit, bark, and leaf are specific to the plant, or `null`.** For a cultivar, write them only when a source describes that cultivar. Where sources only describe the fruit type in general, leave the field `null`; `group_notes` holds one short habit, bark, and leaf note for each fruit-tree type (Apple, Pear, Cherry, Peach, Apricot, Plum) that covers what is true of the whole type. For species and genus profiles the profile is the plant, so the fields should be filled.
- Text fields have length limits so tooltips and printouts stay readable. `ripening` is `Early`, `Mid`, `Late`, `Very late`, or `null`, relative to that fruit type's own season. Write profiles in your own words and cite only pages you opened; do not paste nursery prose.
- It is queryable: the `plant_profiles` view and `cultivar_profile*` and `cultivar_group_note*` tables, for example `SELECT plant_id, profile_name FROM plant_profiles WHERE ripening = 'Very late'` or `SELECT id, bark FROM cultivar_profiles WHERE bark LIKE '%peeling%'`.
- Record what you see on your own trees as plant events with a free-text `event_type` such as `bark_observed`, `leaf_observed`, or `habit_observed`, and compare it with the profile and the tagged trees of the same cultivar.

## Unidentified apples (AL-UnKn)

Six apples share the tag `AL-UnKn` (inventory row 62). `UNIDENTIFIED_APPLES` in [orchard.json](orchard.json) records which purchased apples they could be. Every purchase group with more apples bought than tagged is a candidate, and its `slots` equal bought minus tagged, so `check` fails if the list drifts from the purchase sheet or inventory. The owner's dated statement is stored with it: every purchased apple arrived, so unmatched purchases are presumed to have died in Boise, unrecorded. A candidate's descriptions come from its library profile. The printable [possibility list and ID log](../docs/unidentified_apple_id_sheet.html) is generated from these records.

Record what you observe as plant events for `i62-1` to `i62-6`. `event_type` is free text (for example `bloom_observed`, `fruit_observed`, `identified`) and the observation goes in `notes`:

```json
{"id": "unkn-i62-3-bloom-2027", "plant_id": "i62-3", "event_type": "bloom_observed", "recorded_on": "2027-05-10", "occurred_on": "2027-05-04", "notes": "First bloom the same week as the tagged Cortlands."}
```

Confirming a tree's identity moves it out of the `AL-UnKn` line: lower row 62's quantity and drop that plant record, add the tree to the matching inventory line, and lower that candidate's `slots`. `check` fails until the records agree.

## Validation and change rules

IDs must be unique. Inventory quantities must match their individual instances. Assignments/events must reference existing plants and locations. A living plant/spot can have only one active assignment; dead trees cannot occupy active spots. Orchard coordinates must match the shared row spacing. Terrain sample count must match the mesh, climate must cover all twelve months, and runoff factors must be between 0 and 1.

Record collections carry `schema_version: 1`. Extend the builder and SQL schema together when adding a new collection or relational field. Extra JSON properties remain available through the lossless `source_documents` SQL table; promote them to typed columns when needed for regular queries. Unknown quantities, coordinates, dates, or measurements must stay unknown, not become zero or a guessed value.
