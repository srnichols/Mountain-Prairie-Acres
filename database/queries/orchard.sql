SELECT name AS orchard_spot, site_ref, state, plant_id,
       replacement_year, replacement_type
FROM orchard_spots
ORDER BY orchard_row, orchard_column;
