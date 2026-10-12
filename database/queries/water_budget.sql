SELECT name, area_sqft, runoff_factor,
       round(gallons_per_inch, 1) AS gallons_per_inch,
       round(annual_gallons, 1) AS annual_gallons,
       round(march_june_gallons, 1) AS march_june_gallons
FROM water_budget
ORDER BY id;
