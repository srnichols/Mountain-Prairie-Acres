(function (root) {
  'use strict';
  function element(tag, text = '', className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function addRow(tbody, tree) {
    const position = `R${tree.r}-C${tree.c}`;
    const siteRef = root.SiteGrid.siteRef(...root.SiteGrid.treeXY(tree.r, tree.c));
    const planted = tree.orchardUpdate ? element('strong', 'Open') : element('input');
    if (!tree.orchardUpdate) {
      planted.type = 'checkbox';
      planted.className = 'plant-check';
      planted.checked = planted.defaultChecked = !!tree.planted;
      planted.setAttribute('aria-label', `Planted ${position} ${tree.name}`);
    }
    const tag = element('span', tree.tag || 'NO METAL TAG', 'metal-tag');
    if (tree.lineQty > 1) {
      tag.append(element('span', `Tree ${tree.instance} of ${tree.lineQty} with this tag`, 'duplicate-tag'));
    }
    const treeName = element('div');
    const update = tree.orchardUpdate;
    const status = update ? (update.status === 'dead' ? ' - DEAD' : ' - NOT IN ORCHARD') : '';
    treeName.append(element('strong', tree.name + status));
    if (tree.name !== tree.invVariety) {
      treeName.append(element('div', `Inventory name: ${tree.invVariety}`, 'source-note'));
    }
    if (update) {
      const replacement = update.replacementType === 'Tree' ? 'tree' : `${update.replacementType.toLowerCase()} tree`;
      const outside = update.status === 'outside-orchard' ?
        `Planned outside the orchard; current SiteRef: ${root.ORCHARD_DATA.PLANT_LOCATIONS[tree.id]?.site_ref || 'PENDING'}. ` : '';
      treeName.append(element('div', `${outside}Leave this spot open; plant a new ${replacement} in ${update.replacementYear} (variety not yet chosen).`, 'source-note'));
    }
    if (tree.rootstockOnly) treeName.append(element('div', 'Already planted; scion cultivar not yet recorded.', 'source-note'));
    const profile = !update && root.CultivarLibrary ? root.CultivarLibrary.forInventoryRow(tree.invRow) : null;
    if (profile) treeName.append(element('div', profile.tagline, 'source-note'));
    const row = element('tr');
    row.dataset.plantId = tree.id;
    for (const value of [
      planted, element('strong', position), element('code', siteRef, 'site-ref'), tag,
      element('strong', tree.code), treeName, tree.invRow
    ]) {
      const cell = element('td');
      cell.append(value);
      row.append(cell);
    }
    if (tree.c === 1) row.classList.add('row-start');
    if (update) row.classList.add(update.status === 'dead' ? 'loss-row' : 'deferred-row');
    tbody.append(row);
    return row;
  }
  function render(tbody, records) {
    tbody.replaceChildren();
    records.forEach(tree => addRow(tbody, tree));
  }
  root.OrchardChecklist = { addRow, render };
})(typeof window !== 'undefined' ? window : globalThis);
