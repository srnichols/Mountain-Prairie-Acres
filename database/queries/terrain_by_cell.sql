SELECT cell, count(*) AS mesh_points,
       round(min(elevation_ft), 1) AS low_ft,
       round(max(elevation_ft), 1) AS high_ft,
       round(avg(elevation_ft), 1) AS mean_ft
FROM terrain_samples
WHERE in_lot = 1
GROUP BY cell
ORDER BY CAST(substr(cell, 2) AS INTEGER), substr(cell, 1, 1);
