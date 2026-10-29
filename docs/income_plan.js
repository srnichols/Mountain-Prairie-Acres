// Planning allowances for homestead sales at Mountain Prairie Acres. Gross sales, not profit.
// Edit the defaults here. The page saves the visitor's changes in the browser; it does not write this file.
(function (root) {
  const STAGES = [
    { id: "now", label: "Now to year 2", years: "2026–2028", detail: "Eggs and outdoor rows can start. The tunnels are not built, and the orchard is not cropping." },
    { id: "covered", label: "Year 3–4", years: "2029–2030", detail: "Both gothic tunnels and the pit can be up. Berries start. The fruit trees are still small." },
    { id: "coming", label: "Year 5–7", years: "2031–2033", detail: "First real fruit years. A June freeze can still zero the stone fruit and cut the apples." },
    { id: "mature", label: "Mature", years: "2036 and after", detail: "Trees filling the 18 by 20 ft spacing. The gate in Prairie cannot sell all of this." }
  ];

  // units × yield[stage] × price × sold share. Yield is the amount one unit makes in that stage.
  // sold is the share you can actually move, not the share you pick.
  const LINES = [
    {
      id: "hens", group: "Eggs", name: "Chicken eggs", on: true, asked: true,
      units: 12, unitLabel: "hens", yieldLabel: "dozen per hen", priceLabel: "per dozen",
      yield: { now: 16, covered: 16, coming: 16, mature: 16 }, price: 6, sold: 0.7,
      note: "A cold coop at 4,750 ft will not lay like a valley flock. Sixteen dozen a hen is already a winter haircut. Feed is the cost that eats this: about $30 to $40 a bird a year, not subtracted here. Check Idaho egg rules before selling off the farm."
    },
    {
      id: "ducks", group: "Eggs", name: "Duck eggs", on: true, asked: true,
      units: 6, unitLabel: "ducks", yieldLabel: "dozen per duck", priceLabel: "per dozen",
      yield: { now: 10, covered: 10, coming: 10, mature: 10 }, price: 8, sold: 0.6,
      note: "Fewer eggs than hens, a higher price, and a wet pen. The same buyer limit applies. Not started on the lot."
    },
    {
      id: "quail", group: "Eggs", name: "Quail eggs", on: true, asked: true,
      units: 16, unitLabel: "hens", yieldLabel: "dozen per hen", priceLabel: "per dozen",
      yield: { now: 12, covered: 12, coming: 12, mature: 12 }, price: 5, sold: 0.4,
      note: "Coturnix lay a lot of tiny eggs. The dozen is a quail dozen. Prairie will not clear a big flock; this sold share stays low on purpose."
    },
    {
      id: "outdoor", group: "Outdoor rows", name: "Outdoor vegetable rows", on: true, asked: true,
      units: 2000, unitLabel: "sq ft of bed", yieldLabel: "pounds per sq ft", priceLabel: "per pound",
      yield: { now: 0.6, covered: 0.7, coming: 0.7, mature: 0.7 }, price: 2, sold: 0.5,
      note: "Not laid out yet. Two thousand square feet is about four 4-by-125 ft rows, which the south end of the lot can hold. Short season: potatoes, squash, brassicas, beans, and storage crops, not a summer-long salad farm. Garlic is its own line so it is not counted twice."
    },
    {
      id: "garlic", group: "Outdoor rows", name: "Garlic", on: true, asked: false,
      units: 300, unitLabel: "sq ft", yieldLabel: "pounds per sq ft", priceLabel: "per pound",
      yield: { now: 0.4, covered: 0.45, coming: 0.45, mature: 0.45 }, price: 8, sold: 0.7,
      note: "The crop that stores and can wait for a buyer. This bed is in addition to the 2,000 sq ft above. Plant in October, pull in July."
    },
    {
      id: "tunnel-fruit", group: "Greenhouses", name: "Tunnel tomatoes and cucumbers", on: true, asked: true,
      units: 800, unitLabel: "sq ft of bed", yieldLabel: "pounds per sq ft", priceLabel: "per pound",
      yield: { now: 0, covered: 1, coming: 1, mature: 1.1 }, price: 3.5, sold: 0.65,
      note: "Two unheated 27 × 76 ft gothic tunnels, planned for 2028 or 2029. Eight hundred square feet is the fruiting beds in both, not the whole floor. One pound a square foot is a short-season planning allowance, not a valley tunnel. Set plants about May 27. November through March is not a crop."
    },
    {
      id: "tunnel-greens", group: "Greenhouses", name: "Tunnel greens", on: true, asked: true,
      units: 600, unitLabel: "sq ft of bed", yieldLabel: "pounds per sq ft", priceLabel: "per pound",
      yield: { now: 0, covered: 1, coming: 1, mature: 1 }, price: 4, sold: 0.65,
      note: "Cold crops in the edge beds, about April 28 to October 24. Not the same square feet as the tomatoes."
    },
    {
      id: "pit-crops", group: "Greenhouses", name: "Pit greenhouse beds", on: true, asked: true,
      units: 360, unitLabel: "sq ft of bed", yieldLabel: "pounds per sq ft", priceLabel: "per pound",
      yield: { now: 0, covered: 0.6, coming: 0.7, mature: 0.7 }, price: 4, sold: 0.65,
      note: "The two 15 × 12 ft beds in the 20 × 36 ft pit. Starts use the same room in March and April, then these beds grow. The starts are the nursery line, not this one. December through February is still not a crop."
    },
    {
      id: "starts", group: "Nursery", name: "Vegetable and herb starts", on: true, asked: true,
      units: 400, unitLabel: "pots", yieldLabel: "pots sold per pot made", priceLabel: "per pot",
      yield: { now: 0, covered: 1, coming: 1, mature: 1 }, price: 4, sold: 0.75,
      note: "Raised in the pit, hardened in a tunnel. Spring only. A pot that does not sell is compost, which is why the sold share is not 100%."
    },
    {
      id: "trees", group: "Nursery", name: "Grafted fruit trees", on: true, asked: true,
      units: 1, unitLabel: "crop", yieldLabel: "trees sold", priceLabel: "per tree",
      yield: { now: 0, covered: 8, coming: 20, mature: 35 }, price: 40, sold: 0.7,
      note: "You already hold M-111 rootstocks. Eight trees in year 3–4 is the extras you can graft without robbing the orchard. Shipping is what makes this work from Prairie. The sold share is trees that leave, not trees you graft."
    },
    {
      id: "scion", group: "Nursery", name: "Scionwood", on: true, asked: false,
      units: 1, unitLabel: "crop", yieldLabel: "sticks", priceLabel: "per stick",
      yield: { now: 0, covered: 0, coming: 40, mature: 120 }, price: 8, sold: 0.85,
      note: "Cut from the orchard once the trees can spare wood. Ships in an envelope. This is the sale Prairie is actually built for: many named cultivars, few local buyers."
    },
    {
      id: "berries", group: "Hedges and guilds", name: "Berry guilds and rhubarb", on: true, asked: false,
      units: 1, unitLabel: "planting", yieldLabel: "pounds", priceLabel: "per pound",
      yield: { now: 20, covered: 100, coming: 250, mature: 500 }, price: 5, sold: 0.55,
      note: "Honeyberry, currant, gooseberry, josta, aronia, sea berry, blackberry, and rhubarb already in the inventory. Jam uses these same pounds. It is not a second crop, so it is not added on top."
    },
    {
      id: "elder", group: "Hedges and guilds", name: "Elderberry hedge", on: true, asked: true,
      units: 19, unitLabel: "bushes", yieldLabel: "pounds per bush", priceLabel: "per pound",
      yield: { now: 0, covered: 2, coming: 5, mature: 10 }, price: 6, sold: 0.5,
      note: "Nineteen plants, the east hedge 5 ft inside the fence. Flowers and fruit. A syrup jar is the same fruit at a higher price, not more fruit."
    },
    {
      id: "hazel", group: "Hedges and guilds", name: "Hazelnuts", on: true, asked: true,
      units: 34, unitLabel: "bushes", yieldLabel: "pounds per bush", priceLabel: "per pound",
      yield: { now: 0, covered: 0, coming: 1.5, mature: 4 }, price: 6, sold: 0.6,
      note: "Thirty-four Jefferson filberts. Jefferson does not pollinate itself. Without two or three bushes of a matching pollinizer, this line is zero. The pounds assume those pollinizers get added."
    },
    {
      id: "mulberry", group: "Hedges and guilds", name: "Mulberries", on: true, asked: true,
      units: 25, unitLabel: "trees", yieldLabel: "pounds per tree", priceLabel: "per pound",
      yield: { now: 0, covered: 0, coming: 4, mature: 12 }, price: 3, sold: 0.3,
      note: "Twenty-five red mulberries on the west fence. Birds take most of it. The unsold share is still poultry feed. Do not expect a market crop."
    },
    {
      id: "apples", group: "Orchard", name: "Fresh apples", on: true, asked: true,
      units: 40, unitLabel: "dessert trees", yieldLabel: "pounds per tree", priceLabel: "per pound",
      yield: { now: 0, covered: 0, coming: 25, mature: 70 }, price: 2, sold: 0.45,
      note: "About 40 dessert trees, not the cider and crab trees. Planted October 2026. Year 5–7 is a decent year, not a freeze year. The rest of the fruit is family use, culls, and what you cannot sell at the gate."
    },
    {
      id: "pears", group: "Orchard", name: "Fresh pears", on: true, asked: true,
      units: 24, unitLabel: "trees", yieldLabel: "pounds per tree", priceLabel: "per pound",
      yield: { now: 0, covered: 0, coming: 10, mature: 35 }, price: 2, sold: 0.4,
      note: "Twenty-four pear trees in the orchard count. Slower than the apples, and the same freeze risk at bloom."
    },
    {
      id: "stone", group: "Orchard", name: "Cherries, peaches, apricots, plums", on: true, asked: true,
      units: 31, unitLabel: "trees", yieldLabel: "pounds per tree", priceLabel: "per pound",
      yield: { now: 0, covered: 0, coming: 6, mature: 18 }, price: 4, sold: 0.35,
      note: "Fifteen cherries, eight peaches, five apricots, three plums. The median last 32°F freeze is June 17, and these bloom into it. A freeze year is near zero. Six pounds a tree is a decent year, not a promise."
    },
    {
      id: "cider", group: "Orchard", name: "Sweet cider and juice", on: true, asked: true,
      units: 1, unitLabel: "press", yieldLabel: "gallons", priceLabel: "per gallon",
      yield: { now: 0, covered: 0, coming: 80, mature: 180 }, price: 10, sold: 0.6,
      note: "Only the cider and crab trees: Kingston Black, Foxwhelp, Franklin, Frequin Rouge, Campfield, two Harrisons, Wickson, Dolgo, and three Kerrs. Dessert apples are not pressed here, so they are not counted twice. About 2.5 gallons a bushel. Hard cider is not in this line. That needs a license."
    },
    {
      id: "honey", group: "Not started", name: "Honey", on: false, asked: false,
      units: 2, unitLabel: "hives", yieldLabel: "pounds per hive", priceLabel: "per pound",
      yield: { now: 0, covered: 25, coming: 30, mature: 30 }, price: 10, sold: 0.8,
      note: "Not on the lot. Two hives would also help the orchard set. Turn this on only if you mean to keep bees. Left out of the starting total."
    },
    {
      id: "hay", group: "Not started", name: "Hay from the south end", on: false, asked: false,
      units: 2, unitLabel: "acres", yieldLabel: "tons per acre", priceLabel: "per ton",
      yield: { now: 0.8, covered: 1, coming: 1, mature: 1 }, price: 150, sold: 0.5,
      note: "The south end is long enough for a couple of acres. Mountain hay is light. This is a feed offset or a neighbor sale, not a crop business. Left out of the starting total."
    }
  ];

  function stageById(id) {
    const stage = STAGES.find(item => item.id === id);
    if (!stage) throw new Error("Unknown stage: " + id);
    return stage;
  }

  function clampSold(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function lineAt(line, stageId, overrides) {
    const over = overrides || {};
    const on = over.on && Object.prototype.hasOwnProperty.call(over.on, line.id) ? Boolean(over.on[line.id]) : line.on;
    const units = num(over.units && over.units[line.id], line.units);
    const price = num(over.price && over.price[line.id], line.price);
    const sold = clampSold(over.sold && Object.prototype.hasOwnProperty.call(over.sold, line.id) ? over.sold[line.id] : line.sold);
    const yieldKey = line.id + ":" + stageId;
    const amount = num(over.yield && over.yield[yieldKey], line.yield[stageId]);
    const gross = on ? Math.round(units * amount * price * sold * 100) / 100 : 0;
    return {
      id: line.id, group: line.group, name: line.name, asked: line.asked, on: on,
      units: units, unitLabel: line.unitLabel, amount: amount, yieldLabel: line.yieldLabel,
      price: price, priceLabel: line.priceLabel, sold: sold, gross: gross, note: line.note
    };
  }

  function project(stageId, overrides) {
    stageById(stageId);
    const lines = LINES.map(line => lineAt(line, stageId, overrides));
    const total = lines.reduce((sum, line) => sum + Math.round(line.gross * 100), 0) / 100;
    return {
      stage: stageById(stageId),
      lines: lines.map(line => Object.assign({}, line, { share: total > 0 ? line.gross / total : 0 })),
      total: total
    };
  }

  function totalsByStage(overrides) {
    return STAGES.map(stage => ({ id: stage.id, label: stage.label, years: stage.years, total: project(stage.id, overrides).total }));
  }

  root.IncomePlan = { STAGES: STAGES, LINES: LINES, project: project, totalsByStage: totalsByStage };
})(typeof window !== "undefined" ? window : globalThis);
