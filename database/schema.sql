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
CREATE TABLE event_types (
    id TEXT PRIMARY KEY, event_group TEXT NOT NULL CHECK (event_group IN ('history', 'stage', 'condition')),
    stage_order INTEGER CHECK (stage_order >= 1), label TEXT NOT NULL, description TEXT NOT NULL,
    CHECK ((event_group = 'stage') = (stage_order IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX one_event_type_per_stage_order ON event_types(stage_order) WHERE stage_order IS NOT NULL;
CREATE TABLE plant_events (
    id TEXT PRIMARY KEY, plant_id TEXT NOT NULL REFERENCES plants(id),
    event_type TEXT NOT NULL REFERENCES event_types(id), recorded_on TEXT, occurred_on TEXT, notes TEXT NOT NULL
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
    type TEXT NOT NULL CHECK (type IN ('Apple', 'Pear', 'Cherry', 'Peach', 'Plum', 'Apricot')), cultivar TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('buy', 'graft')),
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
CREATE TABLE climate_site (
    name TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL, elevation_ft REAL NOT NULL,
    elevation_note TEXT NOT NULL, time_zone TEXT NOT NULL, normals_start INTEGER NOT NULL, normals_end INTEGER NOT NULL,
    retrieved_on TEXT NOT NULL, CHECK (normals_end >= normals_start)
) STRICT;
CREATE TABLE frost_thresholds (threshold_f INTEGER PRIMARY KEY, label TEXT NOT NULL) STRICT;
CREATE TABLE climate_sources (
    id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('primary', 'check')),
    kind TEXT NOT NULL CHECK (kind IN ('station', 'model')), label TEXT NOT NULL,
    latitude REAL NOT NULL, longitude REAL NOT NULL, elevation_ft REAL NOT NULL, distance_from_site_mi REAL NOT NULL,
    period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, url TEXT NOT NULL, retrieved_from TEXT NOT NULL, note TEXT NOT NULL,
    coldest_night_years INTEGER NOT NULL, mean_annual_extreme_min_f REAL NOT NULL, hardiness_zone TEXT NOT NULL,
    coldest_f REAL NOT NULL, coldest_on TEXT NOT NULL, mildest_f REAL NOT NULL, record_low_f REAL, record_low_on TEXT,
    CHECK (period_end >= period_start)
) STRICT;
CREATE UNIQUE INDEX one_primary_climate_source ON climate_sources (role) WHERE role = 'primary';
CREATE TABLE temperature_months (
    source_id TEXT NOT NULL REFERENCES climate_sources(id), month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    high_f REAL NOT NULL, low_f REAL NOT NULL, PRIMARY KEY (source_id, month), CHECK (low_f < high_f)
) STRICT;
CREATE TABLE frost_summary (
    source_id TEXT NOT NULL REFERENCES climate_sources(id), threshold_f INTEGER NOT NULL REFERENCES frost_thresholds(threshold_f),
    spring_earliest TEXT NOT NULL, spring_p10 TEXT NOT NULL, spring_p50 TEXT NOT NULL, spring_p90 TEXT NOT NULL, spring_latest TEXT NOT NULL,
    fall_earliest TEXT NOT NULL, fall_p10 TEXT NOT NULL, fall_p50 TEXT NOT NULL, fall_p90 TEXT NOT NULL, fall_latest TEXT NOT NULL,
    free_days_shortest INTEGER NOT NULL, free_days_p10 INTEGER NOT NULL, free_days_p50 INTEGER NOT NULL,
    free_days_p90 INTEGER NOT NULL, free_days_longest INTEGER NOT NULL,
    years_spring INTEGER NOT NULL, years_fall INTEGER NOT NULL, years_both INTEGER NOT NULL,
    PRIMARY KEY (source_id, threshold_f)
) STRICT;
CREATE TABLE frost_days (
    source_id TEXT NOT NULL REFERENCES climate_sources(id), threshold_f INTEGER NOT NULL REFERENCES frost_thresholds(threshold_f),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12), avg_days REAL NOT NULL CHECK (avg_days BETWEEN 0 AND 31),
    years_with_pct INTEGER NOT NULL CHECK (years_with_pct BETWEEN 0 AND 100), PRIMARY KEY (source_id, threshold_f, month)
) STRICT;
CREATE TABLE frost_years (
    source_id TEXT NOT NULL REFERENCES climate_sources(id), year INTEGER NOT NULL,
    threshold_f INTEGER NOT NULL REFERENCES frost_thresholds(threshold_f), last_spring TEXT, first_fall TEXT,
    last_spring_day INTEGER, first_fall_day INTEGER, frost_free_days INTEGER CHECK (frost_free_days >= 0),
    PRIMARY KEY (source_id, year, threshold_f)
) STRICT;
CREATE TABLE daylight_months (
    month INTEGER PRIMARY KEY CHECK (month BETWEEN 1 AND 12), mean_hours REAL NOT NULL,
    shortest_hours REAL NOT NULL, longest_hours REAL NOT NULL, CHECK (shortest_hours <= mean_hours AND mean_hours <= longest_hours)
) STRICT;
CREATE TABLE daylight_crossings (hours INTEGER PRIMARY KEY, first_date TEXT NOT NULL, last_date TEXT NOT NULL) STRICT;
CREATE TABLE sun_key_dates (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, date TEXT NOT NULL, clock TEXT NOT NULL, utc_offset_hours INTEGER NOT NULL,
    sunrise TEXT NOT NULL, solar_noon TEXT NOT NULL, sunset TEXT NOT NULL, day_length_hours REAL NOT NULL,
    noon_altitude_deg REAL NOT NULL, sunrise_azimuth_deg REAL NOT NULL, sunset_azimuth_deg REAL NOT NULL
) STRICT;
CREATE TABLE climate_checks (
    id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('open', 'done')),
    what TEXT NOT NULL, why TEXT NOT NULL, how TEXT NOT NULL, timing TEXT NOT NULL, resolved_on TEXT, result TEXT,
    CHECK ((status = 'done') = (resolved_on IS NOT NULL AND result IS NOT NULL)),
    CHECK ((resolved_on IS NULL) = (result IS NULL))
) STRICT;

-- Reference baselines for the site (data/site_baselines.json): snow and rain, design storms, heat and chill, wind, sun and humidity,
-- county building values, and hail. baseline_sources lists every source once per topic, measured or modeled.
CREATE TABLE baseline_sources (
    topic TEXT NOT NULL CHECK (topic IN ('snow', 'storms', 'growth', 'wind', 'sun', 'humidity', 'hail')),
    id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('station', 'model', 'report')), label TEXT NOT NULL, url TEXT NOT NULL,
    retrieved_from TEXT NOT NULL, note TEXT NOT NULL, period_start INTEGER, period_end INTEGER,
    is_primary INTEGER NOT NULL CHECK (is_primary IN (0, 1)), PRIMARY KEY (topic, id)
) STRICT;
-- One row per topic, source, and calendar month: precip_in, gdd_50, gdd_43, solar_mj, rh_pct, wind_mph.
CREATE TABLE baseline_months (
    topic TEXT NOT NULL, source_id TEXT NOT NULL, month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    value REAL NOT NULL CHECK (value >= 0), PRIMARY KEY (topic, source_id, month)
) STRICT;
CREATE TABLE baseline_summary (
    topic TEXT NOT NULL CHECK (topic IN ('snow', 'gdd', 'chill')), measure TEXT NOT NULL, unit TEXT NOT NULL,
    years INTEGER NOT NULL CHECK (years > 0), minimum REAL NOT NULL, p10 REAL NOT NULL, p50 REAL NOT NULL, p90 REAL NOT NULL,
    maximum REAL NOT NULL, mean REAL NOT NULL, PRIMARY KEY (topic, measure),
    CHECK (minimum <= p10 AND p10 <= p50 AND p50 <= p90 AND p90 <= maximum)
) STRICT;
CREATE TABLE baseline_notes (topic TEXT NOT NULL, key TEXT NOT NULL, text TEXT NOT NULL, PRIMARY KEY (topic, key)) STRICT;
-- Day numbers count from Oct 1 as in a non-leap year, so a leap year's Feb 29 and Mar 1 share a number; melt-out can therefore equal the
-- peak's day number. The JSON validator compares the dates themselves.
CREATE TABLE snow_years (
    water_year INTEGER PRIMARY KEY, in_normals INTEGER NOT NULL CHECK (in_normals IN (0, 1)),
    peak_swe_in REAL NOT NULL CHECK (peak_swe_in >= 0), peak_on TEXT NOT NULL, peak_day INTEGER NOT NULL,
    melt_out_on TEXT NOT NULL, melt_out_day INTEGER NOT NULL, last_snow_on TEXT NOT NULL, last_snow_day INTEGER NOT NULL,
    apr1_swe_in REAL NOT NULL CHECK (apr1_swe_in >= 0), precip_in REAL NOT NULL CHECK (precip_in >= 0),
    CHECK (melt_out_day >= peak_day AND apr1_swe_in <= peak_swe_in)
) STRICT;
CREATE TABLE snow_date_summary (
    measure TEXT PRIMARY KEY, years INTEGER NOT NULL, earliest TEXT NOT NULL, p10 TEXT NOT NULL, p50 TEXT NOT NULL, p90 TEXT NOT NULL,
    latest TEXT NOT NULL
) STRICT;
CREATE TABLE design_storms (
    duration TEXT NOT NULL, duration_hours REAL NOT NULL CHECK (duration_hours > 0), return_years INTEGER NOT NULL CHECK (return_years > 0),
    depth_in REAL NOT NULL CHECK (depth_in > 0), lower_in REAL NOT NULL, upper_in REAL NOT NULL,
    PRIMARY KEY (duration, return_years), CHECK (lower_in <= depth_in AND depth_in <= upper_in)
) STRICT;
CREATE TABLE gdd_years (
    year INTEGER NOT NULL, method TEXT NOT NULL CHECK (method IN ('hourly', 'daily_average')), base_f INTEGER NOT NULL,
    degree_days INTEGER NOT NULL CHECK (degree_days >= 0), hours_recorded INTEGER NOT NULL, PRIMARY KEY (year, method, base_f)
) STRICT;
CREATE TABLE chill_winters (
    winter INTEGER PRIMARY KEY, hours_32_45 INTEGER NOT NULL, hours_45 INTEGER NOT NULL, hours_recorded INTEGER NOT NULL,
    CHECK (hours_32_45 <= hours_45 AND hours_45 <= hours_recorded)
) STRICT;
CREATE TABLE wind_stats (
    source_id TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL, elevation_ft REAL NOT NULL,
    distance_mi REAL NOT NULL, bearing_deg INTEGER NOT NULL, hours INTEGER NOT NULL, mean_mph REAL NOT NULL, calm_pct REAL NOT NULL,
    pct_hours_10_mph REAL NOT NULL, pct_hours_15_mph REAL NOT NULL, pct_hours_25_mph REAL NOT NULL,
    CHECK (pct_hours_10_mph >= pct_hours_15_mph AND pct_hours_15_mph >= pct_hours_25_mph)
) STRICT;
-- Share of non-calm hours that the wind blew from each of 16 directions (sector_index 0 is north, counting clockwise).
CREATE TABLE wind_rose (
    source_id TEXT NOT NULL REFERENCES wind_stats(source_id),
    season TEXT NOT NULL CHECK (season IN ('winter', 'spring', 'summer', 'fall')),
    sector_index INTEGER NOT NULL CHECK (sector_index BETWEEN 0 AND 15), sector TEXT NOT NULL,
    pct REAL NOT NULL CHECK (pct BETWEEN 0 AND 100), season_hours INTEGER NOT NULL, PRIMARY KEY (source_id, season, sector_index)
) STRICT;
CREATE TABLE building_sources (id TEXT PRIMARY KEY, label TEXT NOT NULL, url TEXT NOT NULL, quote TEXT NOT NULL) STRICT;
CREATE TABLE building_values (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, value TEXT NOT NULL, numeric_value REAL, unit TEXT NOT NULL, note TEXT NOT NULL
) STRICT;
CREATE TABLE building_value_sources (
    value_id TEXT NOT NULL REFERENCES building_values(id), source_id TEXT NOT NULL REFERENCES building_sources(id),
    PRIMARY KEY (value_id, source_id)
) STRICT;
CREATE TABLE hail_events (
    event_id INTEGER PRIMARY KEY, date TEXT NOT NULL, county TEXT NOT NULL, place TEXT NOT NULL, size_in REAL NOT NULL CHECK (size_in >= 0),
    latitude REAL NOT NULL, longitude REAL NOT NULL, distance_mi REAL NOT NULL CHECK (distance_mi >= 0), reported_by TEXT, narrative TEXT
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
       i.plan_year, i.type, i.method, i.cultivar, i.profile_id, i.rootstock, i.role
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

CREATE VIEW site_climate_months AS
SELECT t.month, t.high_f, t.low_f, round((t.high_f + t.low_f) / 2.0, 1) AS mean_f,
       f32.avg_days AS frost_days_32f, f32.years_with_pct AS years_with_32f_pct, f28.avg_days AS frost_days_28f,
       d.mean_hours AS daylight_hours, c.precipitation_in, c.et0_in
FROM temperature_months t
JOIN climate_sources s ON s.id = t.source_id AND s.role = 'primary'
JOIN daylight_months d ON d.month = t.month
JOIN climate_months c ON c.month = t.month
LEFT JOIN frost_days f32 ON f32.source_id = t.source_id AND f32.month = t.month AND f32.threshold_f = 32
LEFT JOIN frost_days f28 ON f28.source_id = t.source_id AND f28.month = t.month AND f28.threshold_f = 28;

-- One row per calendar month of the baselines that a weather station's own monthly averages can be compared with: the station's measured
-- precipitation beside the PRISM model's, degree days from the hourly method, solar radiation and humidity from the primary sources,
-- and monthly mean wind speed from the model at the lot and the two measured stations.
CREATE VIEW site_baseline_months AS
SELECT c.month,
       (SELECT value FROM baseline_months WHERE topic = 'precip_in' AND month = c.month) AS snotel_precip_in,
       c.precipitation_in AS prism_precip_in, c.et0_in,
       (SELECT value FROM baseline_months WHERE topic = 'gdd_50' AND month = c.month) AS gdd_50,
       (SELECT value FROM baseline_months WHERE topic = 'gdd_43' AND month = c.month) AS gdd_43,
       (SELECT b.value FROM baseline_months b JOIN baseline_sources s ON s.topic = 'sun' AND s.id = b.source_id AND s.is_primary = 1
         WHERE b.topic = 'solar_mj' AND b.month = c.month) AS solar_mj,
       (SELECT b.value FROM baseline_months b JOIN baseline_sources s ON s.topic = 'humidity' AND s.id = b.source_id AND s.is_primary = 1
         WHERE b.topic = 'rh_pct' AND b.month = c.month) AS humidity_pct,
       (SELECT value FROM baseline_months WHERE topic = 'wind_mph' AND source_id = 'hrrr-lot' AND month = c.month) AS wind_mph_model_at_lot,
       (SELECT value FROM baseline_months WHERE topic = 'wind_mph' AND source_id = 'pine-turnoff-rwis' AND month = c.month) AS wind_mph_pine_turnoff,
       (SELECT value FROM baseline_months WHERE topic = 'wind_mph' AND source_id = 'muo-asos' AND month = c.month) AS wind_mph_mountain_home
FROM climate_months c;

-- Yearly stage dates the owner logs (bud swell, leaf out, bloom, harvest, and so on), one row per tree and stage, with the
-- day number counted as in a non-leap year so the years line up and match frost_years.
CREATE VIEW stage_observations AS
SELECT e.id AS event_id, e.plant_id, pp.metal_tag, pp.profile_id, coalesce(pp.profile_name, pp.inventory_name) AS cultivar, pp.type,
       l.name AS spot, l.orchard_row, l.orchard_column,
       t.id AS stage, t.label AS stage_label, t.stage_order,
       e.occurred_on, CAST(substr(e.occurred_on, 1, 4) AS INTEGER) AS year,
       CAST(strftime('%j', e.occurred_on) AS INTEGER)
         - CASE WHEN strftime('%j', substr(e.occurred_on, 1, 4) || '-12-31') = '366' AND substr(e.occurred_on, 6, 2) > '02' THEN 1 ELSE 0 END
         AS day_number,
       e.notes
FROM plant_events e
JOIN event_types t ON t.id = e.event_type AND t.event_group = 'stage'
JOIN plant_profiles pp ON pp.plant_id = e.plant_id
LEFT JOIN plantings a ON a.plant_id = e.plant_id AND a.status IN ('planned', 'planted')
LEFT JOIN locations l ON l.id = a.location_id;

-- How each cultivar's stages fall each year across its trees: the spread of dates tells how much the spot matters.
CREATE VIEW stage_by_cultivar AS
SELECT coalesce(profile_id, cultivar) AS cultivar_key, cultivar, type, year, stage, stage_label, stage_order,
       count(DISTINCT plant_id) AS trees, count(*) AS observations,
       min(occurred_on) AS earliest, max(occurred_on) AS latest,
       min(day_number) AS earliest_day, max(day_number) AS latest_day, round(avg(day_number), 1) AS average_day
FROM stage_observations
GROUP BY coalesce(profile_id, cultivar), cultivar, type, year, stage, stage_label, stage_order;

-- For each bloom date, the share of years (in the climate normals period) when a freeze at or below each threshold still came
-- after that date at the Prairie station: the chance this tree's blossoms met a freeze. Station numbers, not readings on the lot.
CREATE VIEW bloom_frost_risk AS
SELECT o.event_id, o.plant_id, o.cultivar, o.spot, o.year, o.stage, o.occurred_on, o.day_number, th.threshold_f,
       (SELECT CAST(round(100.0 * sum(f.last_spring_day > o.day_number) / count(*)) AS INTEGER)
        FROM frost_years f
        JOIN climate_sources s ON s.id = f.source_id AND s.role = 'primary'
        JOIN climate_site c ON f.year BETWEEN c.normals_start AND c.normals_end
        WHERE f.threshold_f = th.threshold_f AND f.last_spring_day IS NOT NULL) AS later_freeze_pct
FROM stage_observations o
JOIN frost_thresholds th
WHERE o.stage IN ('first_bloom', 'full_bloom');
