# Canonical property records

These JSON files are the source of truth. SQLite and the browser files in [`docs/data`](../docs/data/) are generated copies. The original [inventory](../docs/Inventory_PrairiePlants.xlsx) and [purchase workbook](../docs/Trees.xlsx) are retained for provenance; editing those workbooks does not update the canonical records automatically.

## Collections

| File | Information |
|---|---|
| [site.json](site.json) | Lot frame, 50 ft master cells, GPS tie, orchard coordinate system, buildings, water pipes, hydrants, and other mapped features |
| [terrain.json](terrain.json) | Complete USGS lidar mesh, contours, flow paths, drainage split, ridge, ditch, high/low points, and drainage areas; elevations are NAVD88 |
| [inventory.json](inventory.json) | 119 original inventory quantity groups, metal tags, disease flags, locations, relocation-date text, notes, and workbook zones |
| [catalog.json](catalog.json) | Cultivar source entries and structured Fruit, Berry, Herbs, and Trees workbook cells, including zero-quantity purchase-list entries |
| [cultivar_library.json](cultivar_library.json) | One plain-language profile per cultivar, species, genus, or rootstock in the inventory, the purchase list, the seed list, or the planting plan (fruit, nut, and berry plants, windbreak and shade trees, perennials, ungrafted apple rootstocks): appearance, flavor and use, ripening, how to recognize it, habit, bark, and leaves where a source describes them, sources, and links to inventory lines, purchase rows, and seed-list rows; a general habit/bark/leaf note for each fruit-tree type; inventory lines left without a profile, and why |
| [plants.json](plants.json) | One stable Plant ID per individual inventory item, inventory/instance link, planning group, and living/dead status |
| [locations.json](locations.json) | Orchard spots and any additional named planting locations; lot feet, optional orchard row/column, reservations, and replacements |
| [plantings.json](plantings.json) | Planned, confirmed-planted, vacated, dead, and outside-orchard assignments. `planted_on` is `YYYY-MM-DD`, `YYYY-MM` when only the month is known, or `null` when unknown |
| [plant_events.json](plant_events.json) | Owner reports and history; reporting date is separate from the event's actual date |
| [orchard.json](orchard.json) | Purchase reconciliation, pollination research/rules, the possibility lists for the unidentified apples and stone fruit, the 2027 planting plan, fruit-row blocks, windbreak, hedge, and guild design |
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
- A `planned` assignment is not proof of planting, so a tree is marked `planted` only when the owner reports it. The owner finished the last block on 2026-10-18, so all 106 living orchard fruit trees are `planted` with `planted_on` `2026-10` and a note saying so; only the month was given, so no day is invented (the date validator accepts a month-only `YYYY-MM`). The M-111 rootstock at R6-C3 was reported planted earlier with no date, so its `planted_on` stays `null`. Dead trees and the three Urban apples (outside the orchard, location pending) are not planted. Nothing is `planned` in the orchard now, so the pages summarize the planting date instead of listing each tree, and fall back to per-tree lines if a tree ever goes back to `planned`.
- Keep a dead plant and its history; mark its assignment `dead`, keep its health `dead`, and leave its spot open. Do not delete it to make the count smaller.
- A dead or relocated tree keeps one slot in the orchard plan, and the open spot waiting for a replacement is that slot. If a living tree is found in the dead tree's slot, move the living tree's assignment there (`planted` if it is in the ground), give the dead plant's assignment the spot that is now empty, move the `replacement_year` and `replacement_type` to that spot, and record the owner's report as a plant event. That is how the PR-Asian pear moved from R8-C1 to R8-C3 and the open 2027 pear spot became R8-C1.
- A tree moved to a spot its fruit-type block does not use (two of the three Italian plums moved west, R11-C7 to R11-C6 and R12-C7 to R12-C5) is recorded the same way, by changing its assignment, and the layout must then allow the new spot. The layout places each fruit type in a block, so in the shared rows R11 and R12 the block lists its exact `columns` beside its `align` and `perRow` in `SHARED_ROWS` (see the Plum block in [orchard.json](orchard.json)); the browser model throws, and the JavaScript tests fail, if the assignments and the block disagree. The spots the trees left (R11-C7, R12-C7) are open spots with a replacement of the same fruit type.

### Adding an outside location

Add a location with a new ID, x/y feet, and `orchard_row`/`orchard_column` set to `null`. Keep reservation/replacement fields `null` unless they are known. Add an assignment with the plant's ID and that location's ID; use `planned` until planting is confirmed. Keep the earlier outside-orchard assignment as history.

### Water observations and catchments

Catchment areas are initially `null`: the map's building dimensions are not assumed to include roof eaves. Enter a measured `area_sqft` to calculate the budget. The browser calculator permits temporary what-if inputs; it does not save them back to JSON.

Add water observations to the `observations` array with `id`, optional `location_id`, `observed_on` (`YYYY-MM-DD`), `observation_type`, optional numeric `value` and `unit`, and `notes`. No rain-gauge or perc-test measurements have been invented.

## Cultivar library

[cultivar_library.json](cultivar_library.json) holds one profile per cultivar, species, genus, or rootstock in the inventory, the purchase list, the seed list, or the planting plan: fruit, nut, and berry plants, windbreak and shade trees, perennials, and the ungrafted apple rootstocks. The [cultivar guide](../docs/cultivar_guide.html), the pollination grid's tooltips and tree rows, the planting checklist, and the unidentified-tree sheets ([apples](../docs/unidentified_apple_id_sheet.html), [stone fruit](../docs/unidentified_stone_fruit_id_sheet.html)) all read it. The guide counts a plant as on hand unless its health is `dead`, and says how many are reported dead. Each profile has a short tagline and summary, appearance, flavor and use (uses and care for non-food plants), ripening band and timing, how to recognize it, habit, bark, and leaves, hardiness, sources, and a `basis`: `sourced` (every claim backed by its listed sources) or `general` (partly general knowledge). `kind` is `cultivar`, `species`, `genus` (the species is not recorded, such as the oaks), or `rootstock`. Bloom group, ploidy, and fertility stay on the purchase-sheet rows in [catalog.json](catalog.json), not here.

- **Links are by row, never by tag text.** `inventory_rows` lists the inventory lines a profile covers, `purchase_rows` the purchase-sheet rows, and the optional `seed_rows` the rows of the owner's seed list (the `Trees` sheet in the workbook). Tags are free text and not unique (`AL-Fuji` is on two cultivars). A row belongs to at most one profile, and a profile's purchase rows must include the purchase match of each of its inventory lines. A profile needs at least one row of some kind, or a place in the planting plan (below), which is how a cultivar you plan to buy gets a profile before it has an inventory row.
- **Every inventory line needs a profile or an entry in `unprofiled` with a reason** (unidentified plants, a rootstock of unknown type), and every named species on the seed list needs a profile. Adding either without one fails `check`, which lists the missing rows. The guide shows a profile's seed-list row (zones, size, growth, sowing, and your note) beside it, and `SELECT * FROM seed_list` joins each seed-list species to its profile.
- **Habit, bark, and leaf are specific to the plant, or `null`.** For a cultivar, write them only when a source describes that cultivar. Where sources only describe the fruit type in general, leave the field `null`; `group_notes` holds one short habit, bark, and leaf note for each fruit-tree type (Apple, Pear, Cherry, Peach, Apricot, Plum) that covers what is true of the whole type. For species and genus profiles the profile is the plant, so the fields should be filled.
- Text fields have length limits so tooltips and printouts stay readable. `ripening` is `Early`, `Mid`, `Late`, `Very late`, or `null`, relative to that fruit type's own season. Write profiles in your own words and cite only pages you opened; do not paste nursery prose.
- It is queryable: the `plant_profiles` view and `cultivar_profile*` and `cultivar_group_note*` tables, for example `SELECT plant_id, profile_name FROM plant_profiles WHERE ripening = 'Very late'` or `SELECT id, bark FROM cultivar_profiles WHERE bark LIKE '%peeling%'`.
- Record what you see on your own trees as plant events with a free-text `event_type` such as `bark_observed`, `leaf_observed`, or `habit_observed`, and compare it with the profile and the tagged trees of the same cultivar.

## Planting plan (2027)

`PLANTING_PLAN` in [orchard.json](orchard.json) recommends a cultivar for every open spot in the rows it covers (`covers_rows`, currently R1 to R12). Each item names the cultivar, its library profile, how many trees, the spots (`R6-C7`), a `method` (`buy`, or `graft` for an apple grafted onto one of your reserved rootstocks in R1), a rootstock note, why it was picked (`role`), and a `caution`. Apples carry the `flowering_group` and `ploidy` the pollination rules use; pears carry `pear_bloom` (the same label and bloom periods as `PEAR_BLOOM`), cherries may carry `cherry_chart` (the same group and bloom values as `CHERRY_CHART`; tart cherries have none), and every non-apple says whether it is `self_fertile`. Peaches, plums, and apricots must be self-fertile because the pollination rules pair only apples, pears, and cherries. An apple, pear, or cherry can list `not_pollinated_by` cultivar names (for example Bartlett for Seckel) that the model must not count as partners; each name must start the name of a living orchard tree or another planned cultivar of the same fruit type (any letter case, no padding), or `check` rejects it as an exclusion that would do nothing. The plan-level `rootstock_advice`, `graft_advice`, and `shipping_note` print on the buy list.

`check` fails if a spot is not an orchard position, already holds an active planting, is used twice, or disagrees with the replacement type and year recorded for that spot; if a graft is not in a reserved spot or a bought tree is (only apples are grafted, and the grafts cannot outnumber the unplanted rootstocks); if an item's quantity differs from its number of spots, its profile is missing or a different fruit type, or it has fields its fruit type does not use; if a plum, peach, or apricot is not self-fertile; or if any orchard spot in rows 1 to `covers_rows` has neither a planted tree nor a planned cultivar. A planned cultivar has no inventory or purchase row yet, so the plan item is its profile's link.

The plan is a recommendation, not a record of trees. The [pollination grid](../docs/orchard_pollination_grid.html) shows planned spots as green cells and the [2027 planting plan](../docs/fy27_planting_plan.html) lists the buy list, a map of every spot, the pollination check, and the ripening watch, but planned trees are never counted as pollen partners for living trees. The `planned_spots` view lists them in SQL. When you buy trees or graft, add their inventory lines, plants, and `planned` assignments as for any tree, link each profile's `inventory_rows`, and take those spots out of the plan (the check rejects a planned spot that already holds a tree). A tree bought for the slot of a dead or relocated tree cannot be assigned there yet: the layout gives every inventory tree one slot, so extend the model when the first such replacement is bought.

## Unidentified apples (AL-UnKn)

Six apples share the tag `AL-UnKn` (inventory row 62). `UNIDENTIFIED_APPLES` in [orchard.json](orchard.json) records which purchased apples they could be. Every purchase group with more apples bought than tagged is a candidate, and its `slots` equal bought minus tagged, so `check` fails if the list drifts from the purchase sheet or inventory. The owner's dated statement is stored with it: every purchased apple arrived, so unmatched purchases are presumed to have died in Boise, unrecorded. A candidate's descriptions come from its library profile. The printable [possibility list and ID log](../docs/unidentified_apple_id_sheet.html) is generated from these records.

Record what you observe as plant events for `i62-1` to `i62-6`. `event_type` is free text (for example `bloom_observed`, `fruit_observed`, `identified`) and the observation goes in `notes`:

```json
{"id": "unkn-i62-3-bloom-2027", "plant_id": "i62-3", "event_type": "bloom_observed", "recorded_on": "2027-05-10", "occurred_on": "2027-05-04", "notes": "First bloom the same week as the tagged Cortlands."}
```

## Unidentified stone fruit (CR-Sweet, PC-Unk, AT-Unk)

Three sweet cherries share the tag `CR-Sweet` (inventory row 81), two peaches `PC-Unk` (row 91), and one apricot `AT-Unk` (row 71). `UNIDENTIFIED_STONE_FRUIT` in [orchard.json](orchard.json) has one line for each, with the same candidate rules as the apples: a candidate is a purchase group with more trees bought than tagged, its `slots` equal bought minus tagged, and `check` fails if the list drifts from the purchase sheet or inventory. Each line has a short `label` for the number tags (`Sweet`, `PcUnk`, `AtUnk`). A candidate may also list `compare_with` inventory lines whose tags may be wrong: two trees are tagged Moorpark although one was bought, so the apricot list asks you to compare them with the unidentified tree too. The owner confirmed only that every purchased apple arrived, so the stone-fruit lists carry an `assumption` that the same holds for them, and the sheet says it is not yet confirmed. The printable [possibility lists and ID logs](../docs/unidentified_stone_fruit_id_sheet.html) are generated from these records; record what you observe as plant events for `i81-1` to `i81-3`, `i91-1` and `i91-2`, and `i71-1`, as for the apples.

Confirming a tree's identity moves it out of the `AL-UnKn` line: lower row 62's quantity and drop that plant record, add the tree to the matching inventory line, and lower that candidate's `slots`. `check` fails until the records agree.

## Validation and change rules

IDs must be unique. Inventory quantities must match their individual instances. Assignments/events must reference existing plants and locations. A living plant/spot can have only one active assignment; dead trees cannot occupy active spots. Orchard coordinates must match the shared row spacing. Terrain sample count must match the mesh, climate must cover all twelve months, and runoff factors must be between 0 and 1.

Record collections carry `schema_version: 1`. Extend the builder and SQL schema together when adding a new collection or relational field. Extra JSON properties remain available through the lossless `source_documents` SQL table; promote them to typed columns when needed for regular queries. Unknown quantities, coordinates, dates, or measurements must stay unknown, not become zero or a guessed value.
