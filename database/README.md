# Generated SQLite database

[schema.sql](schema.sql) defines the relational projection of the canonical [JSON records](../data/README.md). The generated file is [`build/property.sqlite`](../build/property.sqlite), outside the published website and ignored by Git. Open it with a SQLite viewer in VS Code, Python's `sqlite3`, or another local SQLite client.

Rebuild it before using an external viewer:

```powershell
python tools\property_data.py build
```

The command-line query tool checks freshness automatically:

```powershell
python tools\property_data.py query --file database\queries\orchard.sql
python tools\property_data.py query --file database\queries\terrain_by_cell.sql
python tools\property_data.py query --file database\queries\water_budget.sql
python tools\property_data.py query "SELECT * FROM current_plantings WHERE plant_id = ?" --params '["i56-1"]' --format json
```

Queries are read-only: writes, attachment of another database, and extension loading are denied. Edit JSON, not SQLite. `query` rebuilds when JSON, schema, compiler, or browser-model inputs change; a failed validation leaves the last database intact but refuses to query it as if it were current.

## Tables and relationships

| Tables | Purpose |
|---|---|
| `inventory_batches`, `plants`, `cultivars` | Source quantity groups, individual IDs, and cultivar source entries; multiple workbook entries for the same named cultivar retain their source-row differences |
| `plantings`, `locations`, `plant_events` | Assignment and history, with foreign keys and unique active plant/spot indexes. `plant_events.event_type` must be one of the rows of `event_types` |
| `event_types` | The event vocabulary: `history` types, yearly growth `stage` types (with their calendar `stage_order`), and `condition` notes. See "Tracking your trees" in the [data guide](../data/README.md) |
| `cultivar_profiles`, `cultivar_profile_links`, `cultivar_profile_aliases`, `cultivar_profile_uses`, `cultivar_profile_sources`, `cultivar_group_notes`, `cultivar_group_note_sources` | The cultivar library: one profile per cultivar, species, genus, or rootstock in the inventory, the purchase list, the seed list, or the planting plan (including habit, bark, and leaf notes, which are `NULL` unless a source describes that plant), linked to inventory lines (`link_type = 'inventory'`), purchase rows (`'purchase'`), and seed-list rows (`'seed'`), with aliases, uses, and sources; plus a general habit, bark, and leaf note for each fruit-tree type. A cultivar you plan to buy is linked through `planting_plan_items.profile_id` instead of a row. Not the same as `cultivars`, which holds purchase-sheet rows |
| `workbook_rows`, `purchases` | Lossless structured workbook cells and purchase-list projections; headers are not purchases, dates not supplied stay null |
| `planting_plan_items`, `planting_plan_spots` | The planting plan (`PLANTING_PLAN` in `orchard.json`): one row per recommended cultivar with its fruit type, whether it is bought or grafted (`method`), quantity, rootstock note, and library profile, and one row per planned orchard spot (reserved R1 spots for grafts). A recommendation, not a record of trees: nothing here is bought, grafted, or planted |
| `grid_cells` | All master cells, clipped to the actual fence, with their northwest-corner latitude/longitude |
| `site_features`, `feature_points` | Full mapped geometry and queryable vertices, including water pipes, hydrants, and valve boxes |
| `photos`, `feature_photos` | The drone photos (the files, the original's name, the local time taken, the camera's place in lot feet and grid `cell`, its height above the take-off point, heading, tilt, and field of view, a caption, and alt text), and which photos each mapped item shows. `cell` is `NULL` for a camera outside the fence |
| `terrain_samples`, `terrain_lines`, `terrain_points`, `drainage_areas` | All 18,009 lidar mesh points, contours/flows/split/ridge/ditch, and eight drainage-area values |
| `climate_months`, `soil_layers` | Twelve PRISM/ERA5 monthly records and three NRCS soil horizons |
| `climate_site`, `frost_thresholds`, `climate_sources` | The site climate record: the lot's coordinates and normals period, the four frost thresholds (36, 32, 28, and 24 °F), and the data sources, one `primary` (the Prairie SNOTEL station; a partial unique index allows only one) and the rest `check` sources, each with its average coldest night and USDA zone |
| `temperature_months`, `frost_summary`, `frost_days`, `frost_years` | Average monthly highs and lows for each source; the last spring and first fall freeze summary for each source and threshold (earliest, 1-in-10, median, and latest dates and the frost-free days); average freeze days and the share of years with one, by month; and each year's last spring and first fall date (primary source only), with numeric day-of-year columns for comparing across years |
| `daylight_months`, `daylight_crossings`, `sun_key_dates` | Average, shortest, and longest day length by month, the dates day length crosses 10, 12, 14, and 15 hours, and sunrise, noon, sunset, and sun direction on the equinoxes and solstices, all calculated for the lot |
| `climate_checks` | The things about the climate record that need checking (bloom dates, cold-air drainage, a minimum thermometer on the lot, which way the wind blows, the county's snow load and frost depth wording, and a year of weather station readings against the baselines, plus the official USDA zone, which is settled), each `open` until its `resolved_on` date and `result` are filled in |
| `baseline_sources`, `baseline_notes` | Every source behind the site baselines, once per topic (`snow`, `storms`, `growth`, `wind`, `sun`, `humidity`, `hail`) with its kind (`station`, `model`, or `report`), address, exact request, retrieval note, and period, and the definitions and cautions that go with each topic |
| `baseline_months`, `baseline_summary` | One row per topic, source, and calendar month (station precipitation, degree days at base 50 and 43 °F, solar radiation, humidity, and mean wind speed), and the 10%, median, and 90% summaries of the snow, degree-day, and chill-hour records |
| `snow_years`, `snow_date_summary` | Each water year's peak snow water, the dates of the peak, melt-out, and last snow, April 1 snow, and water-year precipitation (1987 to 2026, with `in_normals` marking the 30 years that the summaries use), and the summary of those dates; day numbers count from October 1 so they sort across the new year |
| `design_storms` | NOAA Atlas 14 rain depth for 19 durations and 10 return periods at the lot, with the lower and upper bounds of the 90% interval |
| `gdd_years`, `chill_winters` | Degree days for each year by method (`hourly` or `daily_average`) and base, and chill hours for each winter (32 to 45 °F and at or below 45 °F), each with the hours recorded |
| `wind_stats`, `wind_rose` | For the model at the lot and the two measured stations: distance and bearing from the lot, mean speed, calm share, and share of hours at 10, 15, and 25 mph; and the share of windy hours from each of 16 directions by season |
| `building_sources`, `building_values`, `building_value_sources` | Elmore County's frost depth, ground snow load, design wind speed, and seismic zone, the documents each came from with the words used, and the caution for each |
| `hail_events` | NOAA hail reports within 25 miles of the lot, 1996 to 2025, with size, distance, who reported it, and what was reported |
| `water_techniques`, `water_calendar`, `water_catchments`, `water_observations` | Water-harvesting plans, sizing inputs, and future field measurements |
| `source_documents`, `build_metadata` | Exact JSON documents, schema version, and input fingerprint |

Core relationships:

```text
inventory_batches -> plants -> plantings -> locations
                       |          |
                       |          +-> location_refs (calculated SiteRef)
                       +-> plant_events -> event_types
                       +-> cultivars
inventory_batches / cultivars / workbook_rows (seed list) -> cultivar_profile_links -> cultivar_profiles -> aliases, uses, sources
planting_plan_items -> cultivar_profiles; planting_plan_spots -> planting_plan_items, locations
site_features -> feature_points
site_features -> feature_photos -> photos
terrain_lines -> terrain_points
climate_sources -> temperature_months, frost_summary, frost_days, frost_years (thresholds from frost_thresholds)
water_observations -> locations (when supplied)
```

## Views

- **`current_plantings`**: individual plants and current active planned/planted locations. Unassigned/dead plants show `PENDING`; an outside-orchard plan does not pretend to occupy its old orchard slot.
- **`orchard_spots`**: every orchard spot, its reservation, replacement plan, and occupancy (`planned`, `planted`, `reserved`, `open`).
- **`planned_spots`**: each spot in the planting plan with its occupancy (`open`, or `reserved` for the R1 graft spots), recorded replacement type, and the planned cultivar, `method` (`buy` or `graft`), library profile, rootstock note, and role. Example: `SELECT spot, method, cultivar, rootstock FROM planned_spots ORDER BY orchard_row, orchard_column`.
- **`location_refs`**: SiteRef and offsets calculated from lot coordinates and the master cells.
- **`plant_profiles`**: each individual plant with its cultivar profile (name, tagline, ripening band, habit, bark, leaf, basis); plants on unidentified or unprofiled lines show `NULL`.
- **`seed_list`**: each named species on the owner's seed list (the `Trees` sheet) with its zones, size, growth, and sowing notes and the cultivar profile it links to.
- **`water_budget`**: per-inch, annual, and March–June harvest estimates; unknown areas return SQL `NULL`, not zero.
- **`site_climate_months`**: one row per month for the primary climate source with its average high and low, mean, days at or below 32 °F and 28 °F, the share of years with a 32 °F night, average day length, precipitation, and ET0. Example: `SELECT month, high_f, low_f, frost_days_32f, daylight_hours FROM site_climate_months`. Frost dates by year and the percentile summary are in `frost_years` and `frost_summary`; filter on `source_id` (the primary is `snotel-prairie`), since the cross-check sources have a summary but no yearly dates.
- **`site_baseline_months`**: one row per calendar month of the baselines that a weather station's own monthly averages can be compared with: the station's measured precipitation beside the PRISM model's, ET0, degree days (hourly method, base 50 and 43 °F), solar radiation and humidity from the primary sources, and mean wind speed from the model at the lot and the two measured stations. Example: `SELECT month, snotel_precip_in, prism_precip_in, gdd_50, solar_mj, humidity_pct FROM site_baseline_months`.
- **`stage_observations`, `stage_by_cultivar`, `bloom_frost_risk`**: the growth stages you log as plant events. `stage_observations` has one row per tree and stage with its cultivar, spot, date, and a non-leap-year day number; `stage_by_cultivar` rolls them up by cultivar, year, and stage (trees seen, earliest, latest, and average date); `bloom_frost_risk` gives, for each first-bloom and full-bloom date and each frost threshold, the share of years in the climate normals period when a freeze at or below that temperature still came after the date at the Prairie station. All three are empty until the first stage is logged. Example: `SELECT cultivar, stage, average_day, trees FROM stage_by_cultivar WHERE year = 2027 ORDER BY stage_order`.

For example, the current orchard has **106 planted fruit trees (all planted in October 2026), one planted rootstock, 75 open spots, and 13 reserved spots**. SQL and the website use the same records. Most remaining inventory items have no measured individual planting locations.

## Terrain and units

Distances are feet from the northwest fence corner. Lidar elevations are meters and feet above sea level (NAVD88); the mesh retains points just outside the fence because interpolation needs them. Filter `in_lot = 1` for on-property statistics. `grid_cells.latitude`/`longitude` identify each cell's northwest corner, not its center. Drainage areas overlap by definition; do not add all eight values together.

Soil depths/available water are inches; Ksat is inches/hour. Climate values are inches/month and are normals/reanalysis, not observed rain-gauge records. Temperatures are °F, day length is hours, and frost dates are `MM-DD` in the summaries and `YYYY-MM-DD` by year; they come from the Prairie weather station, not a thermometer on the lot. A year's frost date is `NULL` when a missing reading could hide a later freeze, so use `IS NOT NULL` before sorting `frost_free_days` (SQLite sorts `NULL` first). Roof areas are square feet; water estimates are US gallons. The original metadata and provenance remain queryable:

```sql
SELECT json_extract(data_json, '$.source') AS terrain_source
FROM source_documents WHERE name = 'terrain';
```

The database is recreated from scratch in a temporary file, foreign keys and integrity are checked, and only a successful build replaces the existing database. Schema changes do not require migrating user edits inside a binary database because it is never the authoritative copy.
