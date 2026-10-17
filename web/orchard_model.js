(function (root) {
  'use strict';
const { C1_GUILDS } = root.ORCHARD_DATA;
const { PLAN_DATE, STATUS_DATE, FRUIT_SHEET, INVENTORY, INVENTORY_MATCH, TYPE_ORDER, BLOCK_ROWS, SHARED_ROWS, RESERVED_ROWS, ORCHARD_ROWS, ROW_PLAN, GRID_COLUMNS, PLOT_WIDTH, EAST_SIDE, PLOT_DEPTH, TREE_SPACING, ROW_SPACING, LOCAL_RADIUS, ORCHARD_WEST_SETBACK, JUNIPER_DISTANCE, WINDBREAK, EAST_HEDGE, OWNER_NOTES, ORCHARD_UPDATES, PLANTED_ROOTSTOCKS, ROOTSTOCK_LABELS, GENERATED_CODES, FAMILY_OVERRIDES, APPLE_ALIASES, HARRISON_BLOOM_RESEARCH, APPLE_BLOOM_RESEARCH, URBAN_APPLE_ROWS, PEAR_BLOOM, CHERRY_CHART, PLANT_LOCATIONS, UNIDENTIFIED_APPLES, UNIDENTIFIED_STONE_FRUIT } = root.ORCHARD_DATA;
const FRUIT_BY_ROW = new Map(FRUIT_SHEET.map(([sourceRow, quantity, fruit, name, code, rootstock, fertility, pollenQuality, ploidy, fg, pollenizers]) =>
  [sourceRow, { sourceRow, quantity, fruit, name, code, rootstock, fertility, pollenQuality, ploidy, fg, pollenizers }]));
const INVENTORY_BY_ROW = new Map(INVENTORY.map(line => [line[0], line]));
const ORCHARD_X0 = WINDBREAK.width + ORCHARD_WEST_SETBACK;
// Marks a reserved position in ROW_PLAN.
const RESERVED = 'R';

function fruitRecord(row) {
  const record = FRUIT_BY_ROW.get(row);
  if (!record) throw new Error(`Fruit sheet row ${row} is missing from the snapshot`);
  return record;
}

function inventoryLine(row) {
  const line = INVENTORY_BY_ROW.get(row);
  if (!line) throw new Error(`Inventory row ${row} is missing from the snapshot`);
  return line;
}

function rootstockRemaining(invRow) {
  return inventoryLine(invRow)[1] -
    Object.values(PLANT_LOCATIONS).filter(planting => planting.inventory_row === invRow && planting.status === 'planted').length;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function placementOf(line) {
  const [invRow, , category, subcategory, , variety, , , , location] = line;
  if (WINDBREAK.rows.some(row => row.invRows.includes(invRow))) return 'windbreak';
  if (EAST_HEDGE.invRows.includes(invRow)) return 'east-hedge';
  if (C1_GUILDS.groups.some(group => group.invRows.includes(invRow))) return 'guild';
  if (location !== 'Prairie') return 'elsewhere';
  if (category === 'Tree' && subcategory === 'Fruit') return /rootstock/i.test(variety) ? 'rootstock' : 'orchard';
  if (category === 'Tree' && subcategory === 'Nut') return 'nut';
  return 'other';
}

function buildOrchardTrees() {
  const trees = [];
  const rootstockIds = new Set();
  PLANTED_ROOTSTOCKS.forEach(({ invRow, instance }) => {
    const line = inventoryLine(invRow);
    const id = `i${invRow}-${instance}`;
    if (placementOf(line) !== 'rootstock' || !Number.isInteger(instance) || instance < 1 || instance > line[1] || rootstockIds.has(id)) {
      throw new Error(`Invalid planted rootstock instance: ${id}`);
    }
    rootstockIds.add(id);
  });
  INVENTORY.forEach(line => {
    const placement = placementOf(line);
    const rootstockOnly = placement === 'rootstock';
    const rootstockPlantings = PLANTED_ROOTSTOCKS.filter(tree => tree.invRow === line[0]);
    if (placement !== 'orchard' && (!rootstockOnly || !rootstockPlantings.length)) return;
    const [invRow, qty, , , type, variety, tag, psm, psmQty] = line;
    const match = INVENTORY_MATCH[invRow];
    if (!match) throw new Error(`Inventory row ${invRow} (${variety}) has no purchase-list match`);
    const source = match.rows.length ? fruitRecord(match.rows[0]) : null;
    if (source && source.fruit !== type) throw new Error(`Inventory row ${invRow} is matched to a ${source.fruit} record`);
    if (!source && !match.name && !rootstockOnly) throw new Error(`Unidentified inventory row ${invRow} needs a display name`);
    const recorded = [...new Set(match.rows.map(row => fruitRecord(row).rootstock).filter(Boolean))];
    const rootstock = rootstockOnly ? ROOTSTOCK_LABELS[invRow] : match.rootstock || recorded.join(' or ');
    if (rootstockOnly && !rootstock) throw new Error(`Missing rootstock type for inventory row ${invRow}`);
    const code = rootstockOnly ? 'RS' : (source && source.code) || GENERATED_CODES[invRow];
    if (!code) throw new Error(`Missing display code for inventory row ${invRow}`);
    const appleBloom = source ? APPLE_BLOOM_RESEARCH[source.sourceRow] : undefined;
    if (appleBloom && appleBloom.fg !== source.fg) {
      throw new Error(`Flowering-group research differs from the workbook at Fruit row ${source.sourceRow}`);
    }
    const instances = rootstockOnly ? rootstockPlantings.map(tree => tree.instance) :
      Array.from({ length:qty }, (_, index) => index + 1);
    for (const instance of instances) {
      const id = `i${invRow}-${instance}`;
      const name = rootstockOnly ? `${rootstock} apple rootstock` : source ? source.name : match.name;
      const orchardUpdate = ORCHARD_UPDATES[id];
      if (orchardUpdate && (!['dead', 'outside-orchard'].includes(orchardUpdate.status) || rootstockOnly)) {
        throw new Error(`Invalid orchard status for ${id}`);
      }
      trees.push({
        id, invRow, instance, lineQty:qty, tag, invVariety:variety, type, fruit:type, unknown:!source && !rootstockOnly,
        orchardUpdate, rootstockOnly, rootstockPlanting:rootstockPlantings.find(tree => tree.instance === instance),
        sourceRow:source ? source.sourceRow : null, fruitRows:match.rows, name, code, rootstock,
        fertility:source ? source.fertility : '', pollenQuality:source ? source.pollenQuality : '',
        ploidy:source ? source.ploidy : '', fg:source ? source.fg : null, pollenizers:source ? source.pollenizers : '',
        family:source ? FAMILY_OVERRIDES[source.sourceRow] || normalizeName(name) : `unidentified-${id}`,
        appleBloom, planningFg:source ? source.fg : null,
        planningPloidy:!source ? '' : source.sourceRow === 35 ? 'Disputed' : source.ploidy,
        pearAsian:type === 'Pear' && /Asian/.test(name),
        selfFertile:!!source && source.sourceRow !== 83 &&
          (/^self-fertile$/i.test(source.fertility) || [59,60,109].includes(source.sourceRow)),
        listedPartners:new Set((source ? source.pollenizers : '').split(',').map(entry => {
          const key = normalizeName(entry);
          return APPLE_ALIASES[key] || key;
        }).filter(Boolean)),
        psm, psmQty, matchNote:match.note || ''
      });
    }
  });
  Object.keys(ORCHARD_UPDATES).forEach(id => {
    if (!trees.some(tree => tree.id === id)) throw new Error(`Orchard update has no matching inventory tree: ${id}`);
  });
  return trees;
}

function balancedRows(count, rowCount) {
  const base = Math.floor(count / rowCount);
  const extra = count % rowCount;
  return Array.from({ length:rowCount }, (_, index) => base + (index < extra ? 1 : 0));
}

// Row lengths for one fruit type, west-justified and listed south to north.
function blockShape(count, type) {
  const requested = BLOCK_ROWS[type];
  const squareRows = Math.max(1, Math.round(Math.sqrt(count)));
  let shape;
  if (requested) {
    shape = balancedRows(count, requested === 'square' ? squareRows : requested);
  } else if (count >= GRID_COLUMNS) {
    const full = Math.floor(count / GRID_COLUMNS);
    const rest = count % GRID_COLUMNS;
    shape = [...Array(full).fill(GRID_COLUMNS), ...(rest ? [rest] : [])];
  } else {
    shape = balancedRows(count, squareRows);
  }
  if (shape[0] > GRID_COLUMNS) throw new Error(`${type} needs more than ${GRID_COLUMNS} positions in a row`);
  return shape;
}

function sharedGroupOf(type) {
  return SHARED_ROWS.find(group => group.blocks.some(block => block.type === type)) || null;
}

// Positions (C numbers) for a block of n trees: 'west' from C1, 'east' ending at C13, 'center' nearest the row's middle.
function blockColumns(align, n, off) {
  const columns = Array.from({ length:GRID_COLUMNS }, (_, index) => index + 1);
  if (align === 'west') return columns.slice(0, n);
  if (align === 'east') return columns.slice(GRID_COLUMNS - n);
  if (align !== 'center') throw new Error(`Unknown block alignment: ${align}`);
  const middle = ((GRID_COLUMNS - 1) * TREE_SPACING + TREE_SPACING / 2) / 2;
  const distance = c => Math.abs((c - 1) * TREE_SPACING + (off ? TREE_SPACING / 2 : 0) - middle);
  return columns.sort((a, b) => distance(a) - distance(b) || a - b).slice(0, n).sort((a, b) => a - b);
}

// The planned use of every position, row by row from R1 (south): a fruit type, RESERVED, or null for an open position.
function rowTemplate(trees) {
  const countOf = type => trees.filter(tree => tree.type === type).length;
  const present = TYPE_ORDER.filter(countOf);
  const template = [];
  const filled = (length, value) => Array.from({ length:GRID_COLUMNS }, (_, index) => index < length ? value : null);
  for (let index = 0; index < present.length; index++) {
    const type = present[index];
    const group = sharedGroupOf(type);
    if (!group) {
      const reserve = RESERVED_ROWS[type];
      if (reserve) template.push({ types:[type], cells:filled(reserve.count, RESERVED), reserved:reserve.count, shared:false, future:false });
      blockShape(countOf(type), type).forEach(length => template.push({ types:[type], cells:filled(length, type), reserved:0, shared:false, future:false }));
      continue;
    }
    const groupTypes = group.blocks.map(block => block.type);
    if (present.slice(index, index + groupTypes.length).sort().join() !== [...groupTypes].sort().join()) {
      throw new Error(`${groupTypes.join(', ')} share rows, so they must be next to each other in TYPE_ORDER`);
    }
    const rowCount = group.blocks[0].perRow.length;
    const cells = Array.from({ length:rowCount }, () => Array(GRID_COLUMNS).fill(null));
    group.blocks.forEach(block => {
      if (BLOCK_ROWS[block.type] || RESERVED_ROWS[block.type]) throw new Error(`${block.type} has both its own row settings and shared rows`);
      if (block.perRow.length !== rowCount) throw new Error('Every block in a shared group needs the same number of rows');
      const total = block.perRow.reduce((sum, n) => sum + n, 0);
      if (total !== countOf(block.type)) throw new Error(`${block.type}: the shared rows hold ${total} trees, but ${countOf(block.type)} are at Prairie`);
      block.perRow.forEach((n, k) => {
        const r = template.length + k + 1;
        blockColumns(block.align, n, r % 2 === 0).forEach(c => {
          if (cells[k][c - 1]) throw new Error(`R${r}-C${c}: the ${block.type} block overlaps the ${cells[k][c - 1]} block`);
          cells[k][c - 1] = block.type;
        });
      });
    });
    cells.forEach(row => template.push({ types:[...new Set(row.filter(Boolean))], cells:row, reserved:0, shared:true, future:false }));
    index += groupTypes.length - 1;
  }
  if (template.length > ORCHARD_ROWS) throw new Error(`The trees need ${template.length} rows, more than the ${ORCHARD_ROWS} in the orchard`);
  while (template.length < ORCHARD_ROWS) template.push({ types:[], cells:Array(GRID_COLUMNS).fill(null), reserved:0, shared:false, future:true });
  return template;
}

// A position counts as planted only when a planting record at that very orchard spot says so. Trees under one tag are
// interchangeable, so the record's plant number may differ from the one the layout puts there, and a tree planted
// outside the orchard never marks its old orchard spot.
function plantedAt(spot, invRow) {
  return Object.values(PLANT_LOCATIONS).some(planting =>
    planting.status === 'planted' && planting.location_id === spot && planting.inventory_row === invRow);
}

// Places the trees listed in a row plan (see ROW_PLAN) after checking every position against the row template.
function layoutRows(plan, trees) {
  const template = rowTemplate(trees);
  if (plan.length !== template.length) throw new Error(`The row plan has ${plan.length} rows, but the layout needs ${template.length}`);
  const byLine = new Map();
  trees.forEach(tree => {
    if (!byLine.has(tree.invRow)) byLine.set(tree.invRow, []);
    byLine.get(tree.invRow).push(tree);
  });
  const used = new Map();
  const rows = template.map(({ types, cells, reserved, shared, future }, index) => {
    const r = index + 1;
    const off = r % 2 === 0;
    const planned = plan[index];
    const held = [];
    if (planned.length > GRID_COLUMNS) throw new Error(`R${r} lists more than ${GRID_COLUMNS} positions`);
    const placed = cells.map((expected, column) => {
      const id = planned[column] ?? null;
      if (expected === null || expected === RESERVED) {
        if (id !== expected) throw new Error(`R${r}-C${column + 1} should be ${expected === null ? 'open' : 'reserved'} in the row plan`);
        return null;
      }
      const list = byLine.get(id) || [];
      const next = used.get(id) || 0;
      const tree = list[next];
      if (!tree || tree.type !== expected) throw new Error(`R${r}-C${column + 1}: inventory row ${id} is not an available ${expected}`);
      const fixedPosition = tree.orchardUpdate || tree.rootstockPlanting;
      if (fixedPosition && (fixedPosition.r !== r || fixedPosition.c !== column + 1)) {
        throw new Error(`Inventory row ${id}: the recorded planting position must stay at R${fixedPosition.r}-C${fixedPosition.c}`);
      }
      used.set(id, next + 1);
      Object.assign(tree, {
        r, c:column + 1, x:column * TREE_SPACING + (off ? TREE_SPACING / 2 : 0), y:index * ROW_SPACING,
        planted:plantedAt(`orchard-r${r}-c${column + 1}`, tree.invRow)
      });
      if (tree.orchardUpdate) held.push(tree);
      return tree.orchardUpdate ? null : tree;
    });
    return { r, off, types, type:types.length === 1 ? types[0] : null, shared, reserved, future, trees:placed, held };
  });
  byLine.forEach((list, invRow) => {
    const placed = used.get(invRow) || 0;
    if (placed !== list.length) throw new Error(`Inventory row ${invRow}: ${list.length} trees in the inventory snapshot, but ${placed} placed`);
  });
  return rows;
}

function lineCount(invRows) {
  return invRows.reduce((sum, row) => sum + inventoryLine(row)[1], 0);
}

// Lays out one plant row along the orchard (north–south). Rows with a fixed spacing start at the south end and mark the
// remaining positions for plants to add later; other rows spread their plants over the full length, centered on the orchard.
function layoutPlantRow(row, x, span) {
  const target = span + 2 * WINDBREAK.endMargin;
  const count = lineCount(row.invRows);
  let spacing, start, positions;
  if (row.spacing) {
    spacing = row.spacing;
    start = -WINDBREAK.endMargin;
    positions = Math.max(count, Math.ceil(target / spacing - 1e-9) + 1);
  } else {
    spacing = Math.ceil(target / (count - 1) * 2 - 1e-9) / 2;
    start = span / 2 - spacing * (count - 1) / 2;
    positions = count;
  }
  const all = Array.from({ length:positions }, (_, index) => ({ x, y:start + index * spacing, planted:index < count }));
  const plants = all.filter(position => position.planted);
  return {
    ...row, x, count, spacing, start, end:all[all.length - 1].y, plantedEnd:plants[plants.length - 1].y,
    plants, future:all.filter(position => !position.planted)
  };
}

function windbreakLayout(rowCount) {
  WINDBREAK.rows.forEach((row, index) => {
    if (index && row.offset <= WINDBREAK.rows[index - 1].offset) throw new Error('Windbreak rows must run west to east');
  });
  return WINDBREAK.rows.map(row => layoutPlantRow(row, row.offset, (rowCount - 1) * ROW_SPACING));
}

function eastHedgeLayout(rowCount, eastFenceX) {
  return layoutPlantRow(EAST_HEDGE, eastFenceX - EAST_HEDGE.fromFence, (rowCount - 1) * ROW_SPACING);
}

function alleyGeometry() {
  const lastRow = WINDBREAK.rows[WINDBREAK.rows.length - 1];
  const hedgeEdge = lastRow.offset + lastRow.managedWidth / 2;
  const limbEdge = ORCHARD_X0 - WINDBREAK.orchardLimbAllowance;
  const clear = limbEdge - hedgeEdge;
  if (hedgeEdge > WINDBREAK.width) throw new Error('The windbreak rows do not fit inside the strip');
  if (clear < WINDBREAK.minAlley) throw new Error(`The tractor alley is ${clear} ft, less than the ${WINDBREAK.minAlley} ft minimum`);
  return { hedgeEdge, limbEdge, clear, ground:ORCHARD_X0 - hedgeEdge };
}

// Walking and picking lane from the tall row's trunks to the next row's west edge. The tall row is pruned so it does not
// overhang the next row, and the rows keep USDA's 15 ft shade gap.
function laneGeometry() {
  const [tall, next] = WINDBREAK.rows;
  const east = next.offset - next.managedWidth / 2;
  if (next.offset - tall.offset < WINDBREAK.shadeGap) throw new Error(`The ${next.name.toLowerCase()} row is closer than ${WINDBREAK.shadeGap} ft to the ${tall.name.toLowerCase()} row`);
  if (tall.offset + tall.managedWidth / 2 > east) throw new Error(`The ${tall.name.toLowerCase()} crowns would overhang the ${next.name.toLowerCase()} row`);
  return { west:tall.offset, east, width:east - tall.offset };
}

// Guild positions around each C1 trunk (x from the west fence, y north of the R1 line). Bushes go around planted C1 trees and
// around C1 spots held open for a replacement (a dead or relocated tree), so one open spot does not move the berry plan;
// positions around C1 spots with no tree and no replacement become future positions, and bushes beyond the room are
// returned as spares.
function guildLayout(rows) {
  const queue = C1_GUILDS.groups.flatMap(group => Array(lineCount(group.invRows)).fill(group));
  const bushes = [], future = [];
  const alleyEdge = ORCHARD_X0 - WINDBREAK.orchardLimbAllowance;
  rows.forEach(row => {
    const spec = row.off ? C1_GUILDS.even : C1_GUILDS.odd;
    const trunkX = ORCHARD_X0 + (row.off ? TREE_SPACING / 2 : 0), trunkY = (row.r - 1) * ROW_SPACING;
    const holdsC1 = !!row.trees[0] || row.held.some(tree => tree.c === 1);
    spec.bearings.forEach(bearing => {
      const angle = bearing * Math.PI / 180;
      const spot = { r:row.r, x:trunkX + spec.radius * Math.sin(angle), y:trunkY + spec.radius * Math.cos(angle) };
      if (spot.x - C1_GUILDS.bushWidth / 2 < alleyEdge) throw new Error(`R${row.r}: a guild bush would reach into the tractor alley`);
      if (holdsC1 && queue.length) bushes.push({ ...spot, group:queue.shift() });
      else future.push(spot);
    });
  });
  return { bushes, future, spare:queue };
}

function treeDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function needsTwoDonors(tree) {
  return tree.planningPloidy === 'Triploid' || tree.planningPloidy === 'Disputed';
}

function compatiblePair(recipient, donor) {
  if (recipient.orchardUpdate || donor.orchardUpdate || recipient.rootstockOnly || donor.rootstockOnly) return null;
  if (recipient.id === donor.id || recipient.type !== donor.type || recipient.family === donor.family) return null;
  if (recipient.type === 'Apple') {
    if (donor.planningPloidy !== 'Diploid' || donor.pollenQuality === 'Poor') return null;
    const listed = recipient.listedPartners.has(donor.family);
    if (recipient.planningFg !== null && donor.planningFg !== null) {
      if (Math.abs(recipient.planningFg - donor.planningFg) > 1) return null;
      const basis = listed ? 'Workbook-listed + bloom group' : 'Bloom-group candidate';
      const provisional = (recipient.appleBloom && recipient.appleBloom.provisional) || (donor.appleBloom && donor.appleBloom.provisional);
      return { basis:basis + (provisional ? '; provisional flowering group' : '') };
    }
    if (URBAN_APPLE_ROWS.includes(recipient.sourceRow) && URBAN_APPLE_ROWS.includes(donor.sourceRow)) {
      return { basis:'Raintree Urban Apple recommendation; confirm local bloom' };
    }
    return listed ? { basis:'Workbook-listed; confirm bloom' } : null;
  }
  if (recipient.type === 'Pear') {
    if (recipient.pearAsian !== donor.pearAsian) return null;
    if (recipient.sourceRow === 106 && donor.sourceRow === 100) {
      return { basis:'Nursery-recommended Parker for Summercrisp; confirm local bloom' };
    }
    const a = PEAR_BLOOM[recipient.sourceRow];
    const b = PEAR_BLOOM[donor.sourceRow];
    if (!a || !b || !a.slice(1).some(period => b.slice(1).includes(period))) return null;
    return { basis:'Pear bloom-chart candidate; confirm compatibility' };
  }
  if (recipient.type === 'Cherry') {
    const a = CHERRY_CHART[recipient.sourceRow];
    const b = CHERRY_CHART[donor.sourceRow];
    if (!a || !b || (a.group && a.group === b.group) || Math.abs(a.bloom - b.bloom) > 1) return null;
    if ([53,54].includes(recipient.sourceRow) && donor.sourceRow === 65) return null;
    return { basis:'Cherry compatibility + bloom chart; confirm local overlap' };
  }
  if (recipient.type === 'Peach' && recipient.sourceRow === 83) {
    if (donor.sourceRow === 88) return { basis:'UC Davis names Veteran for J.H. Hale' };
    if (donor.unknown || donor.sourceRow === 80) return null;
    return { basis:'UC Davis: almost any non-Elberta peach; match chill and bloom' };
  }
  return null;
}

function nearestPartners(tree, donorPool) {
  const candidates = donorPool.map(donor => {
    const pair = compatiblePair(tree, donor);
    return pair ? { donor, distance:treeDistance(tree, donor), basis:pair.basis } : null;
  }).filter(Boolean).sort((a, b) => a.distance - b.distance || a.donor.id.localeCompare(b.donor.id));
  const families = new Set();
  const distinct = candidates.filter(candidate => {
    if (families.has(candidate.donor.family)) return false;
    families.add(candidate.donor.family);
    return true;
  });
  if (!needsTwoDonors(tree)) return distinct;
  let bestPair = null;
  let shortest = Infinity;
  distinct.forEach((a, index) => distinct.slice(index + 1).forEach(b => {
    if (compatiblePair(a.donor, b.donor) && compatiblePair(b.donor, a.donor) && a.distance + b.distance < shortest) {
      bestPair = [a, b];
      shortest = a.distance + b.distance;
    }
  }));
  return bestPair ? [...bestPair, ...distinct.filter(candidate => !bestPair.includes(candidate))] : [];
}
function plan() {
  const records = buildOrchardTrees();
  const rows = layoutRows(ROW_PLAN, records);
  records.sort((a, b) => a.r - b.r || a.c - b.c);
  return { records, rows };
}
// The untagged trees of one inventory line and the purchases they could still be, with the tagged trees to compare each against.
function unidentifiedLine(info) {
  const library = root.CultivarLibrary;
  if (!library) throw new Error('Load data/cultivar_library.js before listing unidentified trees');
  const unknownLine = inventoryLine(info.inventory_row);
  const prefix = info.label || 'UnKn';
  const trees = Array.from({ length:unknownLine[1] }, (_, index) => {
    const id = `i${unknownLine[0]}-${index + 1}`;
    const location = PLANT_LOCATIONS[id];
    const spot = location && /^orchard-r(\d+)-c(\d+)$/.exec(location.location_id);
    return {
      id, number:index + 1, label:`${prefix}-${index + 1}`, tag:unknownLine[6], status:location ? location.status : null,
      spot:spot ? `R${spot[1]}-C${spot[2]}` : location ? location.location_id : null,
      siteRef:location ? location.site_ref : null
    };
  });
  const taggedLine = line => ({ invRow:line[0], tag:line[6], qty:line[1] });
  const candidates = info.candidates.map(candidate => {
    const records = candidate.rows.map(fruitRecord);
    const profile = library.forPurchaseRow(candidate.rows[0]);
    const tagged = INVENTORY.filter(line => line[0] !== unknownLine[0] &&
      ((INVENTORY_MATCH[line[0]] || {}).rows || []).some(row => candidate.rows.includes(row))).map(taggedLine);
    return {
      ...candidate,
      name:profile.name, profile,
      fg:records[0].fg, ploidy:records[0].ploidy, fertility:records[0].fertility,
      rootstock:[...new Set(records.map(record => record.rootstock).filter(Boolean))].join(' / '),
      tagged, taggedQty:tagged.reduce((total, line) => total + line.qty, 0), longShot:Boolean(candidate.long_shot),
      compareWith:(candidate.compare_with || []).map(row => taggedLine(inventoryLine(row)))
    };
  });
  const slots = list => list.reduce((total, candidate) => total + candidate.slots, 0);
  const main = slots(candidates.filter(candidate => !candidate.longShot));
  const longShot = slots(candidates.filter(candidate => candidate.longShot));
  return {
    info, type:unknownLine[4], tag:unknownLine[6], trees, candidates,
    pool:{ main, longShot, trees:trees.length, lostMin:Math.max(0, main - trees.length), lostMax:Math.max(0, main + longShot - trees.length) }
  };
}
function unidentifiedApples() {
  return unidentifiedLine(UNIDENTIFIED_APPLES);
}
// The cherries, peaches, and apricot that lost their labels; one entry per inventory line.
function unidentifiedStoneFruit() {
  return { info:UNIDENTIFIED_STONE_FRUIT, lines:UNIDENTIFIED_STONE_FRUIT.lines.map(unidentifiedLine) };
}
root.OrchardModel = { PLAN_DATE, STATUS_DATE, FRUIT_SHEET, INVENTORY, INVENTORY_MATCH, TYPE_ORDER, BLOCK_ROWS, SHARED_ROWS, RESERVED_ROWS, ORCHARD_ROWS, ROW_PLAN, GRID_COLUMNS, PLOT_WIDTH, EAST_SIDE, PLOT_DEPTH, TREE_SPACING, ROW_SPACING, LOCAL_RADIUS, ORCHARD_WEST_SETBACK, JUNIPER_DISTANCE, WINDBREAK, C1_GUILDS, EAST_HEDGE, OWNER_NOTES, ORCHARD_UPDATES, PLANTED_ROOTSTOCKS, ROOTSTOCK_LABELS, GENERATED_CODES, FAMILY_OVERRIDES, APPLE_ALIASES, HARRISON_BLOOM_RESEARCH, APPLE_BLOOM_RESEARCH, URBAN_APPLE_ROWS, PEAR_BLOOM, CHERRY_CHART, FRUIT_BY_ROW, INVENTORY_BY_ROW, ORCHARD_X0, RESERVED, fruitRecord, inventoryLine, rootstockRemaining, normalizeName, placementOf, buildOrchardTrees, balancedRows, blockShape, sharedGroupOf, blockColumns, rowTemplate, layoutRows, lineCount, layoutPlantRow, windbreakLayout, eastHedgeLayout, alleyGeometry, laneGeometry, guildLayout, treeDistance, needsTwoDonors, compatiblePair, nearestPartners, PLANT_LOCATIONS, plan, UNIDENTIFIED_APPLES, unidentifiedApples, UNIDENTIFIED_STONE_FRUIT, unidentifiedStoneFruit };
})(typeof window !== 'undefined' ? window : globalThis);
