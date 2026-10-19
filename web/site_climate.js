// Helpers for the site climate records (data/climate.json) that the pages share when they quote frost dates, temperatures, and daylight.
(function (root) {
const CLIMATE = root.SITE_CLIMATE;
if (!CLIMATE) throw new Error('Load data/site_climate.js before using SiteClimate');
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const THRESHOLDS = CLIMATE.frost.thresholds_f;
const PRIMARY = CLIMATE.sources.find(source => source.role === 'primary');

function parseMonthDay(text) {
  const match = /^(\d\d)-(\d\d)$/.exec(text);
  const month = match ? Number(match[1]) : 0;
  const day = match ? Number(match[2]) : 0;
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) throw new Error(`${text} must be a calendar day as MM-DD`);
  return { month, day };
}
// "06-17" as "Jun 17".
function monthDay(text) {
  const { month, day } = parseMonthDay(text);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}
// The day number in a non-leap year (Mar 1 is day 60), the same numbering the frost statistics use.
function dayNumber(text) {
  const { month, day } = parseMonthDay(text);
  return DAYS_IN_MONTH.slice(0, month - 1).reduce((total, length) => total + length, 0) + day;
}
// 15.42 hours as "15 h 25 m".
function hoursText(hours) {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)} h ${total % 60} m`;
}
// "21:27" as "9:27 pm".
function clock12(text) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (!match) throw new Error(`${text} must be HH:MM`);
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'am' : 'pm'}`;
}
function source(id) {
  const found = CLIMATE.sources.find(item => item.id === id);
  if (!found) throw new Error(`No climate source ${id}`);
  return found;
}
// The day number of an ISO date in a non-leap year, so leap years line up with the MM-DD statistics.
function isoDayNumber(iso) {
  const match = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso);
  if (!match) throw new Error(`${iso} must be YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const days = Math.round((Date.UTC(year, month - 1, Number(match[3])) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap && month > 2 ? days - 1 : days;
}
// The yearly records inside a source's summary period.
function summaryYears(from = PRIMARY) {
  const [start, end] = from.period;
  return (from.frost.years || []).filter(record => record.year >= start && record.year <= end);
}
function datedYears(threshold, season, from) {
  const found = summaryYears(from).filter(record => record[season][String(threshold)]);
  if (!found.length) throw new Error(`No ${season} dates at ${threshold} F`);
  return found;
}
// The share of years (0 to 1) whose last spring freeze at or below the threshold came after the MM-DD date.
function springRiskAfter(threshold, text, from = PRIMARY) {
  const day = dayNumber(text);
  const years = datedYears(threshold, 'last_spring', from);
  return years.filter(record => isoDayNumber(record.last_spring[String(threshold)]) > day).length / years.length;
}
// The share of years (0 to 1) whose first fall freeze at or below the threshold came before the MM-DD date.
function fallRiskBefore(threshold, text, from = PRIMARY) {
  const day = dayNumber(text);
  const years = datedYears(threshold, 'first_fall', from);
  return years.filter(record => isoDayNumber(record.first_fall[String(threshold)]) < day).length / years.length;
}
// The earliest or latest last-spring or first-fall date in the summary years, with its year: { year, date: 'MM-DD' }.
function extremeYear(threshold, season, which, from = PRIMARY) {
  let best = null;
  for (const record of datedYears(threshold, season, from)) {
    const iso = record[season][String(threshold)];
    const day = isoDayNumber(iso);
    if (!best || (which === 'latest' ? day > best.day : day < best.day)) best = { year: record.year, date: iso.slice(5), day };
  }
  return { year: best.year, date: best.date };
}
function summary(threshold, from = PRIMARY) {
  const item = from.frost.summary[String(threshold)];
  if (!item) throw new Error(`No frost summary for ${threshold} F`);
  return item;
}
// The dates to plan around at one threshold. "Risk 10" dates leave one year in ten still exposed: a freeze after springRisk10,
// or a first freeze before fallRisk10. The medians are the typical year.
function planningDates(threshold, from = PRIMARY) {
  const item = summary(threshold, from);
  return {
    springEarliest: item.last_spring.earliest, springRisk10: item.last_spring.p90, springMedian: item.last_spring.p50,
    springLatest: item.last_spring.latest, fallEarliest: item.first_fall.earliest, fallRisk10: item.first_fall.p10,
    fallMedian: item.first_fall.p50, fallLatest: item.first_fall.latest, freeDays: { ...item.frost_free_days },
    years: { spring: item.years_spring, fall: item.years_fall, both: item.years_both }
  };
}
// One row per month from the primary source: temperatures, frost days by threshold, and the day length.
function months() {
  const frost = PRIMARY.frost.monthly_days;
  return Array.from({ length: 12 }, (_, index) => ({
    month: index + 1, name: MONTH_NAMES[index], high: PRIMARY.temperature.high_f[index], low: PRIMARY.temperature.low_f[index],
    mean: Math.round((PRIMARY.temperature.high_f[index] + PRIMARY.temperature.low_f[index]) * 5) / 10,
    daylight: { ...CLIMATE.daylight.months[index] },
    frostDays: Object.fromEntries(THRESHOLDS.map(threshold => [threshold, {
      days: frost[threshold].avg_days[index], yearsPct: frost[threshold].years_with_pct[index]
    }]))
  }));
}
root.SiteClimate = { data: CLIMATE, primary: PRIMARY, thresholds: THRESHOLDS, MONTH_NAMES, monthDay, dayNumber, isoDayNumber, hoursText, clock12,
  source, summary, summaryYears, planningDates, springRiskAfter, fallRiskBefore, extremeYear, months };
})(typeof window !== 'undefined' ? window : globalThis);
