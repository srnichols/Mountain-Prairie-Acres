// Helpers for the site baselines (data/site_baselines.json) that the pages share when they quote storms, snow, degree days, and wind.
(function (root) {
const BASELINES = root.SITE_BASELINES;
if (!BASELINES) throw new Error('Load data/site_baselines.js before using SiteBaselines');
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Pounds per square foot that one inch of water weighs.
const POUNDS_PER_INCH_OF_WATER = 5.2;
const SEASONS = ['winter', 'spring', 'summer', 'fall'];

// "02-20" as "Feb 20".
function monthDay(text) {
  const match = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(text);
  if (!match) throw new Error(`${text} must be MM-DD`);
  return `${MONTH_NAMES[Number(match[1]) - 1]} ${Number(match[2])}`;
}
// The row and column of a storm in the depth tables, from its duration name ("24-hr") and return period in years.
function stormIndex(duration, years) {
  const row = BASELINES.storms.durations.indexOf(duration);
  const column = BASELINES.storms.return_periods_years.indexOf(years);
  if (row < 0) throw new Error(`No storm duration ${duration}`);
  if (column < 0) throw new Error(`No storm return period of ${years} years`);
  return [row, column];
}
// Inches of rain in a storm of this duration and return period. table is depth_in, lower_in, or upper_in (the 90 percent interval).
function stormDepth(duration, years, table = 'depth_in') {
  if (!['depth_in', 'lower_in', 'upper_in'].includes(table)) throw new Error(`No storm table ${table}`);
  const [row, column] = stormIndex(duration, years);
  return BASELINES.storms[table][row][column];
}
// Average inches of rain per hour over the storm.
function stormRate(duration, years) {
  const [row] = stormIndex(duration, years);
  return stormDepth(duration, years) / BASELINES.storms.duration_hours[row];
}
// The record's heaviest (max) or lightest (min) value of a yearly snow measure, with its water year: { year, value }.
function snowExtreme(measure, which) {
  if (!['max', 'min'].includes(which)) throw new Error('which must be max or min');
  let best = null;
  for (const row of BASELINES.snow.years) {
    if (typeof row[measure] !== 'number') throw new Error(`No yearly snow measure ${measure}`);
    if (!best || (which === 'max' ? row[measure] > best.value : row[measure] < best.value)) best = { year: row.water_year, value: row[measure] };
  }
  return best;
}
// Pounds per square foot that this many inches of snow water weigh.
function snowPounds(inchesOfWater) {
  return inchesOfWater * POUNDS_PER_INCH_OF_WATER;
}
// 1 is "first" and 10 is "tenth"; larger numbers read 11th, 21st, 22nd, 23rd, and so on.
const ORDINAL_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'];
function ordinal(number) {
  if (!Number.isInteger(number) || number < 1) throw new Error(`${number} must be a whole number from 1`);
  return ORDINAL_WORDS[number - 1]
    || `${number}${ORDINAL_SUFFIXES[(number % 100 - 20) % 10] || ORDINAL_SUFFIXES[number % 100] || ORDINAL_SUFFIXES[0]}`;
}
// "lowest" for the first rank, then "second lowest", "third lowest", and so on.
function rankWord(rank, extreme) {
  return rank === 1 ? extreme : `${ordinal(rank)} ${extreme}`;
}
// How one water year's peak snow water compares with the record: how many years peaked lower, how many higher, whether another year
// peaked at the same value, and how many years are on record.
function snowStanding(year) {
  const years = BASELINES.snow.years;
  const row = years.find(item => item.water_year === year);
  if (!row) throw new Error(`No snow record for water year ${year}`);
  return {
    lower: years.filter(item => item.peak_swe_in < row.peak_swe_in).length,
    higher: years.filter(item => item.peak_swe_in > row.peak_swe_in).length,
    tied: years.some(item => item !== row && item.peak_swe_in === row.peak_swe_in),
    count: years.length
  };
}
function windSource(id) {
  const found = BASELINES.wind.sources.find(item => item.id === id);
  if (!found) throw new Error(`No wind source ${id}`);
  return found;
}
// The share of non-calm hours in each compass direction for one season: [{ sector, pct }] from north clockwise.
function windRose(id, season) {
  if (!SEASONS.includes(season)) throw new Error(`No season ${season}`);
  return windSource(id).rose_pct[season].map((pct, index) => ({ sector: BASELINES.wind.sector_names[index], pct }));
}
// The most common directions in a season, most common first.
function windTop(id, season, count = 3) {
  return windRose(id, season).map((item, index) => ({ ...item, index })).sort((a, b) => b.pct - a.pct || a.index - b.index).slice(0, count);
}
// Running total of the monthly mean degree days at a base temperature: 12 values, the last being the year's total.
function cumulativeDegreeDays(base) {
  const monthly = BASELINES.growth.gdd.monthly_mean[String(base)];
  if (!monthly) throw new Error(`No degree days at base ${base} F`);
  let total = 0;
  return monthly.map(value => (total += value));
}
// How many winters had fewer chill hours than the limit, of one measure (hours_32_45 or hours_45): { winters, of }.
function chillWintersBelow(limit, measure = 'hours_32_45') {
  const rows = BASELINES.growth.chill.winters;
  if (!rows.every(row => typeof row[measure] === 'number')) throw new Error(`No chill measure ${measure}`);
  return { winters: rows.filter(row => row[measure] < limit).length, of: rows.length };
}
function buildingValue(id) {
  const found = BASELINES.building.values.find(item => item.id === id);
  if (!found) throw new Error(`No building value ${id}`);
  return found;
}
// Hail reports within a distance of the lot.
function hailWithin(miles) {
  return BASELINES.hail.events.filter(event => event.distance_mi <= miles);
}
root.SiteBaselines = { data: BASELINES, MONTH_NAMES, SEASONS, monthDay, stormDepth, stormRate, snowExtreme, snowPounds, ordinal, rankWord, snowStanding,
  windSource, windRose, windTop, cumulativeDegreeDays, chillWintersBelow, buildingValue, hailWithin };
})(typeof window !== 'undefined' ? window : globalThis);
