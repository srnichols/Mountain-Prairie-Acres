(function (root) {
  'use strict';
  const profiles = root.CULTIVAR_LIBRARY.records;
  const byId = new Map(profiles.map(profile => [profile.id, profile]));
  const byInventoryRow = new Map();
  const byPurchaseRow = new Map();
  const bySeedRow = new Map();
  profiles.forEach(profile => {
    profile.inventory_rows.forEach(row => byInventoryRow.set(row, profile));
    profile.purchase_rows.forEach(row => byPurchaseRow.set(row, profile));
    (profile.seed_rows || []).forEach(row => bySeedRow.set(row, profile));
  });
  const GROUPS = ['Apple', 'Pear', 'Cherry', 'Peach', 'Apricot', 'Plum', 'Berry', 'Nut', 'Evergreen', 'Shade tree', 'Perennial'];
  const RIPENING_BANDS = ['Early', 'Mid', 'Late', 'Very late'];
  const GUIDE_PAGE = 'cultivar_guide.html';
  const groupNotes = new Map((root.CULTIVAR_LIBRARY.group_notes || []).map(note => [note.group, note]));
  // Shrubs, canes, and herbs have no trunk bark, so the field is labelled by what the plant has.
  const BARK_LABELS = { Berry: 'Stems and bark', Perennial: 'Stems' };

  function forInventoryRow(row) { return byInventoryRow.get(row) || null; }
  function forPurchaseRow(row) { return byPurchaseRow.get(row) || null; }
  function forSeedRow(row) { return bySeedRow.get(row) || null; }
  function profileById(id) { return byId.get(id) || null; }
  function groupNote(group) { return groupNotes.get(group) || null; }
  function guideHref(profile) { return `${GUIDE_PAGE}#${profile.id}`; }
  function barkLabel(group) { return BARK_LABELS[group] || 'Bark and twigs'; }
  // Habit, bark, and leaf notes that a source describes for this plant; null fields are skipped.
  function traits(profile) {
    return [['Habit', profile.habit], [barkLabel(profile.group), profile.bark], ['Leaves', profile.leaf]].filter(([, text]) => text);
  }
  function ripeningText(profile) {
    if (!profile.ripening) return profile.ripening_note || '';
    return profile.ripening_note ? `${profile.ripening} (${profile.ripening_note})` : profile.ripening;
  }
  // Native tooltips do not appear on touch screens, so pages also link each tree to its guide entry.
  function tooltip(profile) {
    return [`${profile.name}: ${profile.tagline}`, ripeningText(profile) ? `Ripens: ${ripeningText(profile)}` : ''].filter(Boolean).join('\n');
  }
  root.CultivarLibrary = { GROUPS, RIPENING_BANDS, GUIDE_PAGE, profiles, byId:profileById, forInventoryRow, forPurchaseRow, forSeedRow, groupNote, guideHref, barkLabel, traits, ripeningText, tooltip };
})(typeof window !== 'undefined' ? window : globalThis);
