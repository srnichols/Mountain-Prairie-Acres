// Fills a workshop page from the model: the numbers quoted in the text (<span data-m="name">), the drawings (<div data-fig="name">), the bill of materials
// (<div data-bom="summary|phases|budget">), and the site and county tables (<div data-site="table|county">). The view functions return HTML strings so
// tests can run them without a browser.
(function (root) {
'use strict';
const M = root.WorkshopModel, D = root.WorkshopDraw;
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = M.n, money = M.money;
const unitPrice = value => (value < 10 && value % 1 ? `$${value.toFixed(2)}` : money(value));
const SRC_CLASS = { HD: 'hd', LO: 'lo', SP: 'sp', Q: 'q' };
const srcTag = code => `<span class="src ${SRC_CLASS[code]}" title="${esc(M.SOURCES[code])}">${code}</span>`;
const NOTICE = { tip: 'notice ok', info: 'notice note', warn: 'notice' };

// ------------------------------------------------------------------ the bill of materials

function bomSummary(b) {
  const rows = b.phases.map(p => {
    const needsQuote = p.items.some(i => i.src === 'Q');
    return `<tr><td class="center">${p.num}</td><td>${esc(p.title)} ${needsQuote ? srcTag('Q') : ''}</td><td class="num">${money(p.low)}</td><td class="num"><strong>${money((p.low + p.high) / 2)}</strong></td><td class="num">${money(p.high)}</td></tr>`;
  }).join('');
  const t = b.totals;
  return `<table class="detail"><thead><tr><th class="center">#</th><th>Phase / category</th><th class="num">Low</th><th class="num">Midpoint</th><th class="num">High</th></tr></thead><tbody>${rows}</tbody>`
    + `<tfoot><tr><td colspan="2">MATERIALS TOTAL (excludes labor, permits, and utility hookups)</td><td class="num">${money(t.low)}</td><td class="num">${money(t.mid)}</td><td class="num">${money(t.high)}</td></tr></tfoot></table>`;
}

function bomPhases(b) {
  return b.phases.map(p => {
    const rows = p.items.map(i => `<tr><td>${esc(i.item)}</td><td class="num">${n(i.qty)}</td><td>${esc(i.unit)}</td><td class="num">${i.lump ? 'mixed' : unitPrice(i.low)}</td><td class="num">${i.lump ? 'mixed' : unitPrice(i.high)}</td><td class="num">${money(i.totalLow)}</td><td class="num">${money(i.totalHigh)}</td><td class="center">${srcTag(i.src)}</td><td>${esc(i.notes)}</td></tr>`).join('');
    const notes = (p.notes || []).map(([kind, html]) => `<div class="${NOTICE[kind]}">${html}</div>`).join('');
    return `<h2 id="phase-${p.num}">${p.num} · ${esc(p.title)}</h2>`
      + `<table class="detail bom"><colgroup><col style="width:26%"><col style="width:5%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:7%"><col style="width:7%"><col style="width:4%"><col style="width:33%"></colgroup>`
      + `<thead><tr><th>Item</th><th class="num">Qty</th><th>Unit</th><th class="num">Unit low</th><th class="num">Unit high</th><th class="num">Total low</th><th class="num">Total high</th><th class="center">Src</th><th>Notes</th></tr></thead><tbody>${rows}</tbody>`
      + `<tfoot><tr><td colspan="5">PHASE SUBTOTAL</td><td class="num">${money(p.low)}</td><td class="num">${money(p.high)}</td><td colspan="2"></td></tr></tfoot></table>${notes}`;
  }).join('');
}

function bomBudget(b) {
  const col = key => b.budget[key];
  const cell = (which, pick) => `<td class="num">${money(pick(col(which)))}</td>`;
  const row = (label, pick) => `<tr><td>${label}</td>${cell('low', pick)}${cell('likely', pick)}${cell('high', pick)}</tr>`;
  const extras = M.BUDGET_EXTRAS.map((e, i) => row(`+ ${esc(e[0])}<span class="where">${esc(e[4])}</span>`, c => c.extras[i])).join('');
  return `<table class="detail"><thead><tr><th>Line</th><th class="num">Low</th><th class="num">Midpoint</th><th class="num">High</th></tr></thead><tbody>`
    + row('Materials (summed from the line items above)', c => c.materials)
    + row(`+ Sales tax (Idaho ${Math.round(M.SALES_TAX * 100)}%)`, c => c.tax) + extras
    + row(`+ Contingency (${Math.round(M.CONTINGENCY * 100)}% of everything above)`, c => c.contingency)
    + `</tbody><tfoot><tr><td>OWNER-BUILD ALL-IN BUDGET RANGE</td>${cell('low', c => c.total)}${cell('likely', c => c.total)}${cell('high', c => c.total)}</tr></tfoot></table>`;
}

// ------------------------------------------------------------------ the site table

// The smallest distance from a point list (a line) to a rectangle, to within a quarter foot.
function lineToRect(pts, r) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
    for (let k = 0; k <= steps; k++) {
      const x = ax + (bx - ax) * k / steps, y = ay + (by - ay) * k / steps;
      best = Math.min(best, Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1)));
    }
  }
  return best;
}
const rectGap = (a, b) => Math.hypot(Math.max(b.x0 - a.x1, a.x0 - b.x1, 0), Math.max(b.y0 - a.y1, a.y0 - b.y1, 0));

function siteFacts(m, grid) {
  const ws = grid.feature('workshop'), pad = grid.feature('workshop_pad');
  const rect = grid.bbox(ws);
  const gap = id => { const f = grid.feature(id); return f.shape === 'line' ? lineToRect(f.pts, rect) : rectGap(rect, grid.bbox(f)); };
  const corners = [['northwest', ws.x0, ws.y0], ['northeast', ws.x1, ws.y0], ['southwest', ws.x0, ws.y1], ['southeast', ws.x1, ws.y1]];
  const center = grid.center('workshop');
  return {
    footprint: [ws.x1 - ws.x0, ws.y1 - ws.y0], pad: [pad.x1 - pad.x0, pad.y1 - pad.y0],
    margins: { west: ws.x0 - pad.x0, east: pad.x1 - ws.x1, north: ws.y0 - pad.y0, south: pad.y1 - ws.y1 },
    center, centerRef: grid.siteRef(center[0], center[1]), cell: grid.cellOf(center[0], center[1]), cells: grid.cellsOf(ws),
    corners: corners.map(([name, x, y]) => ({ name, ref: grid.siteRef(x, y), ground: grid.elevationFt(x, y) })),
    centerGround: grid.elevationFt(center[0], center[1]),
    gaps: { pump_house: gap('pump_house'), container_solar: gap('container_solar'), water_tee_west: gap('water_tee_west'), water_line_west: gap('water_line_west'), rv_pad: gap('rv_pad'), house: gap('house'), irrigation_tank: gap('irrigation_tank') },
    mapsLink: grid.mapsLink(center[0], center[1]), latLon: grid.toLatLon(center[0], center[1])
  };
}

function siteTable(m, grid) {
  const f = siteFacts(m, grid), feet = v => `${v.toFixed(1)} ft`;
  const grounds = f.corners.map(c => c.ground), lo = Math.min(...grounds), hi = Math.max(...grounds);
  const row = (label, value) => `<tr><th scope="row">${label}</th><td>${value}</td></tr>`;
  const ft1 = v => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fill = M.DESIGN.fill, fillMid = (fill.north + fill.south) / 2;
  return `<table class="detail site"><tbody>`
    + row('Planned footprint', `${f.footprint[0]} × ${f.footprint[1]} ft in <code>data/site.json</code> (feature <code>workshop</code>), long side east–west, the same ${m.length} × ${m.width} ft this package is drawn at`)
    + row('Center', `<strong>${f.centerRef}</strong> (cell ${f.cell}), x ${f.center[0]}, y ${f.center[1]} · <a href="${f.mapsLink}">${f.latLon[0].toFixed(6)}, ${f.latLon[1].toFixed(6)}</a>`)
    + row('Corners', f.corners.map(c => `${c.name} ${c.ref}`).join(' · '))
    + row('Grid cells it touches', f.cells.join(', '))
    + row('Pad', `${f.pad[0]} × ${f.pad[1]} ft (<code>workshop_pad</code>, edges approximate), level. The building is centered on it, leaving ${f.margins.west} ft of pad on the west and east, and ${f.margins.north} ft on the north and south.`)
    + row('Fill on the pad', 'Imported fill, from the owner (October 2026): <strong>almost 2 ft over the original ground along the north edge, 6 in to 1 ft along the south edge.</strong>')
    + row('Original ground under the footprint', `The lidar, taken before the pad was filled, puts it between ${ft1(lo)} and ${ft1(hi)} ft: ${f.corners.map(c => `${c.name} ${ft1(c.ground)}`).join(', ')}. It rises toward the south and east, which fits the thicker fill on the north.`)
    + row('Pad surface (estimate)', `About ${ft1(f.centerGround + fillMid)} ft: the original ground at the center (${ft1(f.centerGround)}) plus about ${fillMid.toFixed(1)} ft of fill. Shoot it with a level before anything is poured.`)
    + row('Neighbors', `Pump house ${feet(f.gaps.pump_house)} south of the south wall · solar container ${feet(f.gaps.container_solar)} south · buried 1.5 in water line ${feet(f.gaps.water_tee_west)} south · water line along the west fence ${feet(f.gaps.water_line_west)} west · RV pad ${feet(f.gaps.rv_pad)} to the southeast · irrigation tank ${feet(f.gaps.irrigation_tank)} south · planned house ${feet(f.gaps.house)} to the southeast`)
    + '</tbody></table>';
}

// ------------------------------------------------------------------ the county's rules

// What Elmore County's published ordinance (Title 7 chapters 1 and 2, Title 9, and the agricultural-building form) says about a building like this,
// next to what this building measures. The numbers come from the model and the site data, so they follow a change of length or height.
function countyTable(m, grid) {
  const C = M.COUNTY, h = m.heights, fi = M.feetInches, sq = value => `${n(value)} sq ft`;
  const [houseLength, houseWidth] = grid.size('house'), houseSqFt = houseLength * houseWidth, half = houseSqFt / 2, cap = Math.min(C.frontYardSqFt, half);
  const houseName = `${Math.min(houseLength, houseWidth)} × ${Math.max(houseLength, houseWidth)} ft`;
  const inchesUnder = feet => Math.round((C.accessoryHeight - feet) * 12);
  const reading = inches => (inches >= 0 ? `under by ${inches}″` : `over by ${-inches}″`);
  const padReading = inchesUnder(h.gableMidAbovePad), oldReading = inchesUnder(h.gableMidAboveOldGround), avgReading = inchesUnder(h.gableAvgAbovePad);
  const heightClass = padReading >= 0 && oldReading >= 0 && avgReading >= 0 ? 'good' : padReading >= 0 ? 'look' : 'stop';
  const longestUnderFigure = Math.floor(C.frontYardSqFt / m.width), longestUnderHalf = Math.floor(cap / m.width);
  const sizeOk = m.slabSqFt <= cap;
  // The Pole Barn/Post and Beam Standards are for the 30 psf snow zone only, so at 120 psf they do not apply and the building is engineered.
  // Their wall and peak limits are shown as the county's usual ones, for reference.
  const B = C.poleBarn, ratio = m.length / m.width, snow = m.loads.groundSnow;
  const peakMarginIn = Math.round((B.peak - h.roofPeakAbovePad) * 12), peakGroundMarginIn = Math.round((B.peak - h.roofPeakAbovePad - h.avgFill) * 12);
  const against = inches => (inches >= 0 ? `${inches} in under` : `${-inches} in over`);
  const guideHeight = [
    peakMarginIn < 0 ? 'stop' : h.eaveAbovePad > B.wall + 1e-9 || m.eave > B.wall + 1e-9 || peakGroundMarginIn < 0 ? 'look' : 'good',
    `The wall limit only decides whether a barn needs an engineer, and this one has one. The peak limit is a stated maximum that a stamped design may pass only if the Building Official accepts it. The standards do not say where either is measured from. From the floor the wall is ${fi(m.eave)}, and from the pad surface ${fi(h.eaveAbovePad)}. The roof peak is ${against(peakMarginIn)} ${B.peak} ft from the pad surface${peakMarginIn >= 0 ? ', so extra fill or slab thickness would use that margin up' : ''}, and ${against(peakGroundMarginIn)} ${B.peak} ft from the original ground, which is ${h.avgFill.toFixed(1)} ft lower under the east wall. Ask the county where it takes grade. The ${m.eave} ft wall is what the ${m.mainDoor.height} ft camper door and its track need under the loft floor.`];
  const row = (rule, where, says, here, cls, result) => `<tr><th scope="row">${rule}<span class="where">${where}</span></th><td>${says}</td><td>${here}</td><td class="${cls}">${result}</td></tr>`;
  return `<table class="detail county"><colgroup><col style="width:15%"><col style="width:31%"><col style="width:20%"><col style="width:34%"></colgroup>`
    + `<thead><tr><th>Rule</th><th>What the ordinance says</th><th>This building</th><th>Where it stands</th></tr></thead><tbody>`
    + row('Height limit of the zone', 'Table 7-2-27 (A)',
      `${C.zoneHeight} ft in the Ag, Rec, and RR districts. An agricultural structure in the Ag district may go to ${C.agStructureHeight} ft.`,
      `Ridge ${fi(h.ridgeAbovePad)} above the pad; mid-gable ${fi(h.gableMidAbovePad)}.`,
      'good', 'Within the limit. Confirm which district the parcel is in.')
    + row('Height of an accessory building', '7-2-42 D, and “building height” in Title 7 chapter 1',
      `No taller than the house or ${C.accessoryHeight} ft, whichever is greater. In a residential district, a building in the front yard may not be taller than the house at all. Height runs from the average ground at the front wall to the average height (mid-point) of the highest gable.`,
      `Mid-gable ${fi(h.gableMidAbovePad)} above the pad surface, or ${fi(h.gableMidAboveOldGround)} above the original ground (the fill averages ${h.avgFill.toFixed(1)} ft under the east wall).`,
      heightClass, `${heightClass === 'good' ? 'Within the limit' : 'Close'}: ${reading(padReading)} measured from the pad, ${reading(oldReading)} from the original ground, if the house is no taller than ${C.accessoryHeight} ft. Averaging the gambrel’s whole gable, not just halving eave and ridge, gives about ${h.gableAvgAbovePad.toFixed(1)} ft from the pad. Ask how the county reads a gambrel and where it takes grade.`)
    + row('Size of an accessory building', '7-2-42 C',
      `In the front yard, no more than ${sq(C.frontYardSqFt)} or half the house’s footprint, whichever is less.`,
      `${sq(m.slabSqFt)}. The planned ${houseName} house is ${sq(houseSqFt)}, so half is ${sq(half)}.`,
      sizeOk ? 'good' : 'stop',
      sizeOk ? 'Within the cap.' : `Over the cap, if the building counts as in the front yard (between the road and the front of the house). Ask which road is the front. At ${m.width} ft wide, a length of ${longestUnderFigure} ft (${sq(m.width * longestUnderFigure)}) would clear the ${n(C.frontYardSqFt)} sq ft figure, and ${longestUnderHalf} ft (${sq(m.width * longestUnderHalf)}) would clear half the house too.`)
    + row('A house comes first', '7-2-42 A',
      'An accessory building needs a house on the same parcel with a certificate of occupancy or a valid building permit. It may not be a dwelling or be used for business.',
      'The house is still planned.', 'look', 'Permit the house first, or be ready to show it under a valid permit.')
    + row('Matching the house', '7-2-42 E',
      `Roofing and finish similar in color to the house, and a roof pitch similar to the house’s. In a residential district, a front-yard building of ${n(C.characterSqFt)} sq ft or more must also portray the house’s architectural character.`,
      `Barn-red walls, a beige roof, and a gambrel (${Math.round(m.lowerAngle)}° and ${Math.round(m.upperAngle)}°). At ${sq(m.slabSqFt)} it is ${m.slabSqFt >= C.characterSqFt ? 'over' : 'under'} the size where the character rule starts.`,
      'look', 'Likely to be questioned. Ask how strictly the county applies it, or choose colors and a pitch that suit the house.')
    + row('Agricultural building', 'Title 9, 9-1-7; 7-2-46; the definitions in Title 7 chapter 1; the county’s exemption form',
      `Exempt from the building code and its fees, but not from zoning: it needs zoning approval first and the county’s agricultural exemption, and the district’s setbacks and height still apply. It must stand on a farm (5 acres or more in agricultural use) and be used <strong>solely</strong> to store farm implements, hay, grain, poultry, livestock, or horticultural products; the definition excludes personal items and a shop not related to agriculture. The owner signs a notarized statement, recorded with the county, and the county may inspect within 12 months to confirm the use is still agricultural.`,
      'Drawn as an RV garage, a workshop, and a storage loft.',
      'stop', 'Does not fit as drawn: an RV and a general workshop are personal use. A barn for orchard equipment, a tractor, bins, and harvest storage would fit if the parcel counts as a farm, and then the plans and the signed statement must describe that use. A later change of use may be a violation.')
    + row('Snow load and the engineer', 'Pole Barn/Post and Beam Standards, pages 1 and 3; the county’s building permit page',
      `The county’s guide, which lets a simple pole barn skip an engineer, is for the ${B.snow} psf snow zone and ${B.wind} mph wind only, and a 120 psf area always needs engineering. The permit page says the 120 psf zone must be designed by an Idaho engineer. The guide also allows no habitation, wants a loft kept open (no rooms), and sends any deviation from its standard method to a registered design professional.`,
      `${snow} psf ground snow: the county’s map puts Prairie in that zone, and the county required a neighbor’s building to be designed for it (owner, October 2026). ${m.loads.wind} mph wind. A ${m.width} × ${m.length} ft gambrel (${ratio.toFixed(2)} to 1, where the guide asks for at least 5 to 3) with an open storage loft, a hoist, and a free-standing deck.`,
      'look', `The guide does not apply: at ${snow} psf this is an engineered building. An Idaho engineer stamps the plans and the trusses, which are specified and priced for ${snow} psf. The next row gives the guide’s usual wall and peak limits, for reference.`)
    + row('Wall and peak in the pole barn guide', 'Pole Barn/Post and Beam Standards (July 19, 2021), page 1 and sheet 1',
      `A side wall over ${B.wall} ft needs engineering, and the peak may not exceed ${B.peak} ft in total height. An alternate design stamped by an Idaho design professional may be considered by the Building Official.`,
      `Side wall (the eave): ${m.eave} ft above the floor, ${fi(h.eaveAbovePad)} above the pad surface. Roof peak: ${fi(h.roofPeakAbovePad)} above the pad surface, which is the top of the trusses (${m.peakZ} ft above the floor) plus about ${Math.round(m.roofBuild * 12)} in of purlins, deck, steel, and ridge cap.`,
      guideHeight[0], guideHeight[1])
    + '</tbody></table>';
}

// ------------------------------------------------------------------ the page

function render(doc) {
  const problems = [];
  try {
    const m = M.create(), facts = M.facts(m);
    doc.querySelectorAll('[data-m]').forEach(el => {
      if (!(el.dataset.m in facts)) throw new Error(`The page asks for the unknown number "${el.dataset.m}"`);
      el.textContent = facts[el.dataset.m];
    });
    doc.querySelectorAll('[data-fig]').forEach(el => {
      const draw = D[el.dataset.fig];
      if (typeof draw !== 'function') throw new Error(`The page asks for the unknown drawing "${el.dataset.fig}"`);
      el.innerHTML = draw(m);
    });
    const views = { summary: bomSummary, phases: bomPhases, budget: bomBudget };
    doc.querySelectorAll('[data-bom]').forEach(el => {
      if (!(el.dataset.bom in views)) throw new Error(`The page asks for the unknown table "${el.dataset.bom}"`);
      el.innerHTML = views[el.dataset.bom](M.bom(m));
    });
    doc.querySelectorAll('[data-site]').forEach(el => { el.innerHTML = el.dataset.site === 'county' ? countyTable(m, root.SiteGrid) : siteTable(m, root.SiteGrid); });
  } catch (error) {
    problems.push(error);
    const box = doc.getElementById('render-error');
    if (box) { box.hidden = false; box.textContent = `This page could not draw itself: ${error.message}`; }
    else throw error;
  }
  return problems;
}

root.WorkshopPage = { render, bomSummary, bomPhases, bomBudget, siteFacts, siteTable, countyTable, lineToRect, rectGap };
if (typeof document !== 'undefined' && document.readyState !== 'loading') render(document);
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => render(document));
})(typeof window !== 'undefined' ? window : globalThis);
