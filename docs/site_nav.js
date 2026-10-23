// The site menu: one slim bar with grouped dropdowns, loaded first on every page by <script src="site_nav.js"></script>.
// Edit the list below when a page is added, renamed, or removed; tools/test_site_nav.py checks it against the files in docs/.
window.SITE_NAV = /* BEGIN SITE_NAV JSON */
{
  "home": {"href": "index.html", "label": "Mountain Prairie Acres"},
  "groups": [
    {"id": "orchard", "label": "Orchard", "items": [
      {"href": "orchard_pollination_grid.html", "label": "Planting map and west windbreak"},
      {"href": "metal_tag_planting_checklist.html", "label": "Metal-tag planting checklist"},
      {"href": "fy27_planting_plan.html", "label": "2027 planting plan and buy list"},
      {"href": "cultivar_guide.html", "label": "Cultivar guide"},
      {"href": "unidentified_apple_id_sheet.html", "label": "Unidentified apples"},
      {"href": "unidentified_stone_fruit_id_sheet.html", "label": "Unidentified cherries, peaches, apricot"}
    ]},
    {"id": "greenhouses", "label": "Greenhouses", "items": [
      {"href": "greenhouse_site_plan.html", "label": "Greenhouse site plan"},
      {"href": "gothic_greenhouse_plan.html", "label": "Gothic tunnel, 27 \u00d7 76 ft"},
      {"href": "pit_greenhouse_plan.html", "label": "Pit greenhouse, 20 \u00d7 36 ft"}
    ]},
    {"id": "workshop", "label": "Workshop", "items": [
      {"href": "workshop_pole_barn.html", "label": "Workshop pole barn, 32 \u00d7 48 ft"},
      {"href": "workshop_specs.html", "label": "Workshop specs"},
      {"href": "workshop_plans.html", "label": "Workshop plans and elevations"},
      {"href": "workshop_sections.html", "label": "Workshop sections and details"},
      {"href": "workshop_materials.html", "label": "Workshop materials and cost"}
    ]},
    {"id": "land", "label": "Land & water", "items": [
      {"href": "site_terrain_water_map.html", "label": "Terrain and water maps"},
      {"href": "homestead_plot_map.html", "label": "Homestead plot map"},
      {"href": "site_master_grid.html", "label": "Site master grid"},
      {"href": "orchard_water_harvesting_plan.html", "label": "Rain and snowmelt harvesting"}
    ]},
    {"id": "climate", "label": "Climate & weather", "items": [
      {"href": "site_climate.html", "label": "Site climate"},
      {"href": "site_baselines.html", "label": "Site baselines"},
      {"href": "weather_station_plan.html", "label": "Weather station plan"}
    ]},
    {"id": "project", "label": "Project & data", "items": [
      {"href": "index.html#tracker", "label": "Project tracker"},
      {"href": "index.html#log", "label": "Project log"},
      {"href": "index.html#downloads", "label": "PDF downloads"},
      {"href": "property_data.html", "label": "Data guide: JSON and SQLite"},
      {"href": "soil/WebSoilSurvey_PrairieID.pdf", "label": "Soil survey (PDF)"}
    ]}
  ]
}
/* END SITE_NAV JSON */;
(function (root) {
const NAV = root.SITE_NAV;
if (!NAV) throw new Error('The SITE_NAV list is missing');
// Below this width the bar becomes a Menu button; the style block uses the same number.
const NARROW = '(max-width: 760px)';

// The page file a URL path points at: "/site/site_climate.html" is "site_climate.html", and a folder is the home page.
function fileOf(pathname) {
  const last = String(pathname).split('/').pop();
  return last === '' ? NAV.home.href : last;
}
// The id of the group that lists a page, or null for the home page and for pages the menu does not list.
function groupOf(file) {
  const found = NAV.groups.find(group => group.items.some(item => item.href === file));
  return found ? found.id : null;
}
// The link to focus after an arrow key inside a dropdown of `count` links, starting from `current` (-1 when none has focus). It wraps around.
function stepIndex(current, key, count) {
  if (count < 1) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowUp') return current <= 0 ? count - 1 : current - 1;
  return current;
}
root.SiteNav = { data: NAV, fileOf, groupOf, stepIndex };
if (typeof document === 'undefined' || !document.body) return; // loaded by a test or a tool, not by a page

// The pages' own "back to home" lines are hidden once the menu is drawn; they stay visible if this script never loads.
const STYLE = `
.home-link { display: none !important; }
.sn-nav, .sn-nav * { box-sizing: border-box; }
.sn-nav { position: relative; z-index: 1000; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; margin: 0 0 14px; padding: 3px 6px;
  background: #f5f4f0; border: 1px solid #d3d1c7; border-radius: 8px; color: #2C2C2A; font: 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.sn-nav li { margin: 0; padding: 0; list-style: none; }
.sn-nav a, .sn-nav button { color: inherit; font: inherit; }
.sn-nav a { text-decoration: none; }
.sn-home { padding: 6px 10px; border-radius: 6px; font-weight: 600; }
.sn-home:hover, .sn-sub a:hover { background: #eae8e1; }
.sn-menu { display: flex; flex-wrap: wrap; gap: 2px; margin: 0; padding: 0; list-style: none; }
.sn-group { position: relative; }
.sn-group-button, .sn-toggle { display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 6px 10px; background: transparent; border: 0; border-radius: 6px; cursor: pointer; }
.sn-group-button:hover, .sn-toggle:hover, .sn-group-button[aria-expanded="true"] { background: #eae8e1; }
.sn-group-button::after { content: ""; width: 5px; height: 5px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: translateY(-2px) rotate(45deg); }
.sn-group-button[aria-expanded="true"]::after { transform: translateY(1px) rotate(225deg); }
.sn-current > .sn-group-button { box-shadow: inset 0 -2px 0 #3B6D11; }
.sn-sub { position: absolute; top: calc(100% + 4px); left: 0; min-width: 17rem; max-width: min(26rem, calc(100vw - 16px)); margin: 0; padding: 6px; list-style: none;
  background: #fff; border: 1px solid #d3d1c7; border-radius: 8px; box-shadow: 0 8px 22px rgba(44, 44, 42, 0.16); }
.sn-nav .sn-sub.sn-right { left: auto; right: 0; }
.sn-nav .sn-sub[hidden] { display: none; }
.sn-sub a { display: block; padding: 7px 10px; border-radius: 6px; }
.sn-sub a[aria-current="page"], .sn-home[aria-current="page"] { background: #EAF3DE; color: #3B6D11; }
.sn-sub a[aria-current="page"] { font-weight: 600; }
.sn-nav a:focus-visible, .sn-nav button:focus-visible { outline: 2px solid #185FA5; outline-offset: 1px; }
.sn-toggle { display: none; margin-left: auto; }
@media (max-width: 760px) {
  .sn-toggle { display: inline-flex; }
  .sn-menu { display: none; flex: 0 0 100%; flex-direction: column; flex-wrap: nowrap; padding: 4px 0 2px; border-top: 1px solid #d3d1c7; }
  .sn-nav.sn-open .sn-menu { display: flex; }
  .sn-group-button { width: 100%; justify-content: space-between; min-height: 40px; }
  .sn-sub { position: static; min-width: 0; max-width: none; margin: 0 0 6px 10px; padding: 2px 0 2px 8px; background: transparent; border: 0; border-left: 2px solid #d3d1c7; border-radius: 0; box-shadow: none; }
  .sn-sub a { display: flex; align-items: center; min-height: 40px; }
}
@media print { .sn-nav { display: none !important; } }
`;

function render() {
  const file = fileOf(root.location ? root.location.pathname : '');
  const here = groupOf(file);
  const narrow = () => Boolean(root.matchMedia && root.matchMedia(NARROW).matches);
  const make = (tag, props, ...children) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  };

  const style = make('style', { textContent: STYLE });
  document.head.appendChild(style);

  const home = make('a', { className: 'sn-home', href: NAV.home.href, textContent: NAV.home.label, title: 'Home page: Mountain Prairie Acres \u2014 Orchard and Ranch Projects' });
  if (file === NAV.home.href) home.setAttribute('aria-current', 'page');
  const toggle = make('button', { className: 'sn-toggle', type: 'button', textContent: 'Menu' });
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'sn-menu');
  const menu = make('ul', { className: 'sn-menu', id: 'sn-menu' });
  const parts = NAV.groups.map(group => {
    const panel = make('ul', { className: 'sn-sub', id: `sn-sub-${group.id}`, hidden: true });
    const links = group.items.map(item => {
      const link = make('a', { href: item.href, textContent: item.label });
      if (item.href === file) link.setAttribute('aria-current', 'page');
      panel.append(make('li', {}, link));
      return link;
    });
    const button = make('button', { className: 'sn-group-button', type: 'button', textContent: group.label });
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', panel.id);
    menu.append(make('li', { className: group.id === here ? 'sn-group sn-current' : 'sn-group' }, button, panel));
    return { group, button, panel, links };
  });
  const nav = make('nav', { className: 'sn-nav' }, home, toggle, menu);
  nav.setAttribute('aria-label', 'Site');
  document.body.prepend(nav);

  function setOpen(part, open) {
    part.button.setAttribute('aria-expanded', String(open));
    part.panel.hidden = !open;
    if (open && !narrow()) {
      // A dropdown that would run off the right edge opens toward the left instead.
      part.panel.classList.remove('sn-right');
      if (part.panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) part.panel.classList.add('sn-right');
    }
  }
  function closeAll(except) {
    parts.forEach(part => { if (part !== except) setOpen(part, false); });
  }
  function setMenuOpen(open) {
    nav.classList.toggle('sn-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (!open) closeAll();
    else if (narrow()) {
      const current = parts.find(part => part.group.id === here);
      if (current) setOpen(current, true);
    }
  }

  parts.forEach(part => {
    part.button.addEventListener('click', () => {
      const open = part.panel.hidden;
      closeAll(part);
      setOpen(part, open);
    });
    part.button.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      closeAll(part);
      setOpen(part, true);
      part.links[0].focus();
    });
    part.panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(part, false);
        part.button.focus();
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        part.links[stepIndex(part.links.indexOf(document.activeElement), event.key, part.links.length)].focus();
      }
    });
    part.links.forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
  });
  toggle.addEventListener('click', () => setMenuOpen(!nav.classList.contains('sn-open')));
  document.addEventListener('click', event => {
    if (!nav.contains(event.target)) setMenuOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menuWasOpen = nav.classList.contains('sn-open');
    if (!menuWasOpen && parts.every(part => part.panel.hidden)) return;
    setMenuOpen(false);
    if (menuWasOpen && nav.contains(document.activeElement)) toggle.focus();
  });
  nav.addEventListener('focusout', event => {
    if (event.relatedTarget && !nav.contains(event.relatedTarget)) closeAll();
  });
  // Closing everything when the layout flips between the bar and the Menu button keeps one layout's open state from leaking into the other.
  let wasNarrow = narrow();
  if (root.matchMedia) {
    root.matchMedia(NARROW).addEventListener('change', () => {
      if (narrow() === wasNarrow) return;
      wasNarrow = narrow();
      setMenuOpen(false);
    });
  }
}
render();
})(typeof window !== 'undefined' ? window : globalThis);
