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
| `plantings`, `locations`, `plant_events` | Assignment and history, with foreign keys and unique active plant/spot indexes |
| `workbook_rows`, `purchases` | Lossless structured workbook cells and purchase-list projections; headers are not purchases, dates not supplied stay null |
| `grid_cells` | All master cells, clipped to the actual fence, with their northwest-corner latitude/longitude |
| `site_features`, `feature_points` | Full mapped geometry and queryable vertices, including water pipes and hydrants |
| `terrain_samples`, `terrain_lines`, `terrain_points`, `drainage_areas` | All 18,009 lidar mesh points, contours/flows/split/ridge/ditch, and eight drainage-area values |
| `climate_months`, `soil_layers` | Twelve PRISM/ERA5 monthly records and three NRCS soil horizons |
| `water_techniques`, `water_calendar`, `water_catchments`, `water_observations` | Water-harvesting plans, sizing inputs, and future field measurements |
| `source_documents`, `build_metadata` | Exact JSON documents, schema version, and input fingerprint |

Core relationships:

```text
inventory_batches -> plants -> plantings -> locations
                       |          |
                       |          +-> location_refs (calculated SiteRef)
                       +-> plant_events
                       +-> cultivars
site_features -> feature_points
terrain_lines -> terrain_points
water_observations -> locations (when supplied)
```

## Views

- **`current_plantings`**: individual plants and current active planned/planted locations. Unassigned/dead plants show `PENDING`; an outside-orchard plan does not pretend to occupy its old orchard slot.
- **`orchard_spots`**: every orchard spot, its reservation, replacement plan, and occupancy (`planned`, `planted`, `reserved`, `open`).
- **`location_refs`**: SiteRef and offsets calculated from lot coordinates and the master cells.
- **`water_budget`**: per-inch, annual, and March–June harvest estimates; unknown areas return SQL `NULL`, not zero.

For example, the current orchard has **110 planned fruit-tree assignments, one confirmed planted rootstock, 71 open spots, and 13 reserved spots**. SQL and the website use the same records. Most remaining inventory items have no measured individual planting locations.

## Terrain and units

Distances are feet from the northwest fence corner. Lidar elevations are meters and feet above sea level (NAVD88); the mesh retains points just outside the fence because interpolation needs them. Filter `in_lot = 1` for on-property statistics. `grid_cells.latitude`/`longitude` identify each cell's northwest corner, not its center. Drainage areas overlap by definition; do not add all eight values together.

Soil depths/available water are inches; Ksat is inches/hour. Climate values are inches/month and are normals/reanalysis, not observed rain-gauge records. Roof areas are square feet; water estimates are US gallons. The original metadata and provenance remain queryable:

```sql
SELECT json_extract(data_json, '$.source') AS terrain_source
FROM source_documents WHERE name = 'terrain';
```

The database is recreated from scratch in a temporary file, foreign keys and integrity are checked, and only a successful build replaces the existing database. Schema changes do not require migrating user edits inside a binary database because it is never the authoritative copy.
