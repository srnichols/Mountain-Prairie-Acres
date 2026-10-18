PRAGMA foreign_keys = ON;

CREATE TABLE build_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE source_documents (
    name TEXT PRIMARY KEY,
    data_json TEXT NOT NULL CHECK (json_valid(data_json))
) STRICT;
CREATE TABLE grid_cells (
    cell TEXT PRIMARY KEY, x0_ft REAL NOT NULL, y0_ft REAL NOT NULL,
    x1_ft REAL NOT NULL, y1_ft REAL NOT NULL,
    latitude REAL NOT NULL, longitude REAL NOT NULL
) STRICT;
CREATE TABLE inventory_batches (
    source_row INTEGER PRIMARY KEY, quantity INTEGER NOT NULL CHECK (quantity > 0),
    category TEXT NOT NULL, subcategory TEXT NOT NULL, type TEXT NOT NULL,
    variety TEXT NOT NULL, metal_tag TEXT NOT NULL, place TEXT NOT NULL,
    pseudomonas TEXT NOT NULL, pseudomonas_quantity INTEGER NOT NULL CHECK (pseudomonas_quantity >= 0),
    relocation_date TEXT NOT NULL, notes TEXT NOT NULL, zone TEXT
) STRICT;
CREATE TABLE cultivars (
    id TEXT PRIMARY KEY, source_row INTEGER NOT NULL UNIQUE, quantity INTEGER NOT NULL CHECK (quantity >= 0),
    type TEXT NOT NULL, variety TEXT NOT NULL, code TEXT NOT NULL, rootstock TEXT NOT NULL,
    fertility TEXT NOT NULL, pollen_quality TEXT NOT NULL, ploidy TEXT NOT NULL,
    flowering_group INTEGER, pollenizers TEXT NOT NULL
) STRICT;
CREATE TABLE workbook_rows (
    id TEXT PRIMARY KEY, workbook TEXT NOT NULL, sheet TEXT NOT NULL,
    source_row INTEGER NOT NULL,
    values_json TEXT NOT NULL CHECK (json_valid(values_json)),
    UNIQUE (workbook, sheet, source_row)
) STRICT;
CREATE TABLE purchases (
    id TEXT PRIMARY KEY REFERENCES workbook_rows(id), workbook TEXT NOT NULL, sheet TEXT NOT NULL,
    source_row INTEGER NOT NULL, vendor TEXT, quantity_text TEXT, quantity_numeric REAL,
    item_type TEXT, variety TEXT, purchased_on TEXT
) STRICT;
CREATE TABLE plants (
    id TEXT PRIMARY KEY, inventory_row INTEGER NOT NULL REFERENCES inventory_batches(source_row),
    instance INTEGER NOT NULL CHECK (instance > 0), cultivar_id TEXT REFERENCES cultivars(id),
    plant_group TEXT NOT NULL,
    health_status TEXT NOT NULL CHECK (health_status IN ('living', 'dead')),
    UNIQUE (inventory_row, instance)
) STRICT;
CREATE TABLE locations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, x_ft REAL NOT NULL, y_ft REAL NOT NULL,
    orchard_row INTEGER, orchard_column INTEGER, reserved_for TEXT,
    replacement_year INTEGER, replacement_type TEXT,
    UNIQUE (orchard_row, orchard_column),
    CHECK ((orchard_row IS NULL) = (orchard_column IS NULL)),
    CHECK ((replacement_year IS NULL) = (replacement_type IS NULL))
) STRICT;
CREATE TABLE plantings (
    id TEXT PRIMARY KEY, plant_id TEXT NOT NULL REFERENCES plants(id),
    location_id TEXT NOT NULL REFERENCES locations(id),
    status TEXT NOT NULL CHECK (status IN ('planned', 'planted', 'dead', 'outside-orchard', 'vacated')),
    planted_on TEXT, recorded_on TEXT, notes TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX one_active_plant_per_spot ON plantings(location_id) WHERE status IN ('planned', 'planted');
CREATE UNIQUE INDEX one_active_spot_per_plant ON plantings(plant_id) WHERE status IN ('planned', 'planted');
CREATE TABLE plant_events (
    id TEXT PRIMARY KEY, plant_id TEXT NOT NULL REFERENCES plants(id),
    event_type TEXT NOT NULL, recorded_on TEXT, occurred_on TEXT, notes TEXT NOT NULL
) STRICT;
CREATE TABLE cultivar_profiles (
    id TEXT PRIMARY KEY, plant_group TEXT NOT NULL, type TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('cultivar', 'species', 'genus', 'rootstock')), name TEXT NOT NULL,
    tagline TEXT NOT NULL, summary TEXT NOT NULL, appearance TEXT NOT NULL, flavor_use TEXT NOT NULL,
    ripening TEXT CHECK (ripening IN ('Early', 'Mid', 'Late', 'Very late')), ripening_note TEXT NOT NULL,
    id_cues TEXT NOT NULL, habit TEXT, bark TEXT, leaf TEXT, hardiness TEXT NOT NULL,
    basis TEXT NOT NULL CHECK (basis IN ('sourced', 'general')), note TEXT, reviewed_on TEXT NOT NULL
) STRICT;
CREATE TABLE cultivar_profile_links (
    profile_id TEXT NOT NULL REFERENCES cultivar_profiles(id),
    link_type TEXT NOT NULL CHECK (link_type IN ('inventory', 'purchase', 'seed')),
    source_row INTEGER NOT NULL, PRIMARY KEY (link_type, source_row)
) STRICT;
CREATE TABLE cultivar_profile_aliases (
    profile_id TEXT NOT NULL REFERENCES cultivar_profiles(id), alias TEXT NOT NULL,
    PRIMARY KEY (profile_id, alias)
) STRICT;
CREATE TABLE cultivar_profile_uses (
    profile_id TEXT NOT NULL REFERENCES cultivar_profiles(id), use TEXT NOT NULL,
    PRIMARY KEY (profile_id, use)
) STRICT;
CREATE TABLE cultivar_profile_sources (
    profile_id TEXT NOT NULL REFERENCES cultivar_profiles(id), position INTEGER NOT NULL,
    label TEXT NOT NULL, url TEXT NOT NULL, PRIMARY KEY (profile_id, position)
) STRICT;
CREATE TABLE cultivar_group_notes (
    plant_group TEXT PRIMARY KEY, habit TEXT NOT NULL, bark TEXT NOT NULL, leaf TEXT NOT NULL, reviewed_on TEXT NOT NULL
) STRICT;
CREATE TABLE cultivar_group_note_sources (
    plant_group TEXT NOT NULL REFERENCES cultivar_group_notes(plant_group), position INTEGER NOT NULL,
    label TEXT NOT NULL, url TEXT NOT NULL, PRIMARY KEY (plant_group, position)
) STRICT;
CREATE TABLE planting_plan_items (
    id TEXT PRIMARY KEY, plan_year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Apple', 'Pear', 'Cherry', 'Peach')), cultivar TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE, profile_id TEXT NOT NULL REFERENCES cultivar_profiles(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0), rootstock TEXT NOT NULL,
    flowering_group INTEGER, ploidy TEXT, self_fertile INTEGER CHECK (self_fertile IN (0, 1)),
    role TEXT NOT NULL, caution TEXT NOT NULL
) STRICT;
CREATE TABLE planting_plan_spots (
    item_id TEXT NOT NULL REFERENCES planting_plan_items(id),
    location_id TEXT NOT NULL UNIQUE REFERENCES locations(id), PRIMARY KEY (item_id, location_id)
) STRICT;
CREATE TABLE site_features (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, feature_group TEXT NOT NULL, status TEXT NOT NULL,
    shape TEXT NOT NULL CHECK (shape IN ('rect', 'circle', 'line', 'point', 'polygon')),
    kind TEXT, center_x_ft REAL NOT NULL, center_y_ft REAL NOT NULL,
    geometry_json TEXT NOT NULL CHECK (json_valid(geometry_json)), notes TEXT NOT NULL
) STRICT;
CREATE TABLE feature_points (
    feature_id TEXT NOT NULL REFERENCES site_features(id), point_index INTEGER NOT NULL,
    x_ft REAL NOT NULL, y_ft REAL NOT NULL, PRIMARY KEY (feature_id, point_index)
) STRICT;
CREATE TABLE terrain_samples (
    row_index INTEGER NOT NULL, column_index INTEGER NOT NULL,
    x_ft REAL NOT NULL, y_ft REAL NOT NULL, cell TEXT,
    elevation_m REAL NOT NULL, elevation_ft REAL NOT NULL, in_lot INTEGER NOT NULL CHECK (in_lot IN (0, 1)),
    PRIMARY KEY (row_index, column_index)
) STRICT;
CREATE INDEX terrain_sample_cell ON terrain_samples(cell);
CREATE TABLE terrain_lines (
    id TEXT PRIMARY KEY, layer TEXT NOT NULL, elevation_m REAL
) STRICT;
CREATE TABLE terrain_points (
    line_id TEXT NOT NULL REFERENCES terrain_lines(id), point_index INTEGER NOT NULL,
    x_ft REAL NOT NULL, y_ft REAL NOT NULL, PRIMARY KEY (line_id, point_index)
) STRICT;
CREATE TABLE drainage_areas (name TEXT PRIMARY KEY, acres REAL NOT NULL CHECK (acres >= 0)) STRICT;
CREATE TABLE climate_months (
    month INTEGER PRIMARY KEY CHECK (month BETWEEN 1 AND 12),
    precipitation_in REAL NOT NULL CHECK (precipitation_in >= 0),
    et0_in REAL NOT NULL CHECK (et0_in >= 0)
) STRICT;
CREATE TABLE soil_layers (
    horizon TEXT PRIMARY KEY, top_in REAL NOT NULL, bottom_in REAL NOT NULL, texture TEXT NOT NULL,
    clay_percent REAL NOT NULL, ksat_low_in_hr REAL NOT NULL, ksat_typical_in_hr REAL NOT NULL,
    ksat_high_in_hr REAL NOT NULL, available_water_in_per_in REAL NOT NULL,
    notes TEXT NOT NULL, CHECK (bottom_in > top_in)
) STRICT;
CREATE TABLE water_techniques (
    id TEXT PRIMARY KEY, zone TEXT NOT NULL, work TEXT NOT NULL, specifications TEXT NOT NULL,
    reference TEXT NOT NULL, timing TEXT NOT NULL
) STRICT;
CREATE TABLE water_calendar (
    season TEXT PRIMARY KEY, conditions TEXT NOT NULL, work TEXT NOT NULL
) STRICT;
CREATE TABLE water_catchments (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, area_sqft REAL CHECK (area_sqft >= 0),
    runoff_factor REAL NOT NULL CHECK (runoff_factor BETWEEN 0 AND 1), notes TEXT NOT NULL
) STRICT;
CREATE TABLE water_observations (
    id TEXT PRIMARY KEY, location_id TEXT REFERENCES locations(id),
    observed_on TEXT NOT NULL, observation_type TEXT NOT NULL,
    value REAL, unit TEXT, notes TEXT NOT NULL
) STRICT;

CREATE VIEW location_refs AS
SELECT l.*, g.cell,
       rounded.x_ft - g.x0_ft AS east_offset_ft,
       rounded.y_ft - g.y0_ft AS south_offset_ft,
       g.cell || '-E' || rtrim(rtrim(printf('%.2f', rounded.x_ft - g.x0_ft), '0'), '.')
              || '-S' || rtrim(rtrim(printf('%.2f', rounded.y_ft - g.y0_ft), '0'), '.') AS site_ref
FROM locations l
JOIN (
    SELECT id, CAST(x_ft * 100 + 0.5 AS INTEGER) / 100.0 AS x_ft,
               CAST(y_ft * 100 + 0.5 AS INTEGER) / 100.0 AS y_ft
    FROM locations
) rounded ON rounded.id = l.id
JOIN grid_cells g
ON rounded.x_ft >= g.x0_ft AND rounded.y_ft >= g.y0_ft
AND (rounded.x_ft < g.x1_ft OR
     (g.x1_ft = json_extract((SELECT data_json FROM source_documents WHERE name = 'site'), '$.lot.fence.width') AND rounded.x_ft = g.x1_ft))
AND (rounded.y_ft < g.y1_ft OR
     (g.y1_ft = json_extract((SELECT data_json FROM source_documents WHERE name = 'site'), '$.lot.fence.depth') AND rounded.y_ft = g.y1_ft));

CREATE VIEW current_plantings AS
SELECT p.id AS plant_id, b.metal_tag, coalesce(c.variety, b.variety) AS variety,
       b.type, b.category, p.plant_group, p.health_status,
       a.location_id, a.planted_on, a.recorded_on, l.name AS location_name,
       l.x_ft, l.y_ft, l.cell, l.east_offset_ft, l.south_offset_ft,
       coalesce(l.site_ref, 'PENDING') AS site_ref,
       CASE WHEN p.health_status = 'dead' THEN 'dead' ELSE coalesce(a.status, 'pending') END AS status,
       b.source_row AS inventory_row
FROM plants p JOIN inventory_batches b ON b.source_row = p.inventory_row
LEFT JOIN cultivars c ON c.id = p.cultivar_id
LEFT JOIN plantings a ON a.plant_id = p.id AND a.status IN ('planned', 'planted')
LEFT JOIN location_refs l ON l.id = a.location_id;

CREATE VIEW orchard_spots AS
SELECT l.*, a.plant_id,
       CASE WHEN l.reserved_for IS NOT NULL THEN 'reserved'
            WHEN a.status IS NOT NULL THEN a.status ELSE 'open' END AS state
FROM location_refs l LEFT JOIN plantings a ON a.location_id = l.id AND a.status IN ('planned', 'planted')
WHERE l.orchard_row IS NOT NULL;

CREATE VIEW planned_spots AS
SELECT s.name AS spot, s.orchard_row, s.orchard_column, s.site_ref, s.state, s.replacement_type,
       i.plan_year, i.type, i.cultivar, i.profile_id, i.rootstock, i.role
FROM planting_plan_spots p
JOIN planting_plan_items i ON i.id = p.item_id
JOIN orchard_spots s ON s.id = p.location_id;

CREATE VIEW plant_profiles AS
SELECT p.id AS plant_id, b.metal_tag, b.type, b.variety AS inventory_name, p.plant_group, p.health_status,
       c.id AS profile_id, c.name AS profile_name, c.tagline, c.ripening, c.habit, c.bark, c.leaf, c.basis
FROM plants p JOIN inventory_batches b ON b.source_row = p.inventory_row
LEFT JOIN cultivar_profile_links k ON k.link_type = 'inventory' AND k.source_row = p.inventory_row
LEFT JOIN cultivar_profiles c ON c.id = k.profile_id;

CREATE VIEW seed_list AS
SELECT w.source_row, trim(json_extract(w.values_json, '$.B')) AS species, json_extract(w.values_json, '$.C') AS code,
       json_extract(w.values_json, '$.D') AS zones, json_extract(w.values_json, '$.E') AS growth_per_year,
       json_extract(w.values_json, '$.F') AS size_ft, json_extract(w.values_json, '$.I') AS sowing,
       c.id AS profile_id, c.name AS profile_name, c.plant_group, c.tagline
FROM workbook_rows w
LEFT JOIN cultivar_profile_links k ON k.link_type = 'seed' AND k.source_row = w.source_row
LEFT JOIN cultivar_profiles c ON c.id = k.profile_id
WHERE w.sheet = 'Trees' AND w.source_row > 1 AND trim(coalesce(json_extract(w.values_json, '$.B'), '')) <> '';

CREATE VIEW water_budget AS
SELECT c.*, c.area_sqft * c.runoff_factor *
       json_extract((SELECT data_json FROM source_documents WHERE name = 'water_harvesting'), '$.assumptions.gallons_per_sqft_in') AS gallons_per_inch,
       c.area_sqft * c.runoff_factor *
       json_extract((SELECT data_json FROM source_documents WHERE name = 'water_harvesting'), '$.assumptions.gallons_per_sqft_in') *
       (SELECT sum(precipitation_in) FROM climate_months) AS annual_gallons,
       c.area_sqft * c.runoff_factor *
       json_extract((SELECT data_json FROM source_documents WHERE name = 'water_harvesting'), '$.assumptions.gallons_per_sqft_in') *
       (SELECT sum(precipitation_in) FROM climate_months WHERE month BETWEEN 3 AND 6) AS march_june_gallons
FROM water_catchments c;
