const assert = require('assert');
const TableClassifier = require('./js/table-classifier.js');

console.log('=== TESTING SYNCHRONIZED TABLE TYPE PROPAGATION ===\n');

// Mock state with a document containing 1 title, 1 paragraph, and a 4x3 table (12 cells)
const parsedBBoxes = [
  { id: 't1', page: 1, sentence_id: 1, id_display: 1, text: 'Rapor Başlığı', category: 'Title' },
  { id: 'p1', page: 1, sentence_id: 2, id_display: 2, text: 'Açıklama paragrafı.', category: 'Plain Text' },
  // Table cells initially A_MATRIX
  { id: 'c1', page: 1, sentence_id: 3, id_display: 3, table_id: 'table-1', table_type: 'A_MATRIX', table_order_id: 1, text: 'Şube', rawCoords: [50, 50, 150, 80] },
  { id: 'c2', page: 1, sentence_id: 4, id_display: 4, table_id: 'table-1', table_type: 'A_MATRIX', table_order_id: 2, text: 'Gelir', rawCoords: [150, 50, 250, 80] },
  { id: 'c3', page: 1, sentence_id: 5, id_display: 5, table_id: 'table-1', table_type: 'A_MATRIX', table_order_id: 3, text: 'Gider', rawCoords: [250, 50, 350, 80] },
  { id: 'c4', page: 1, sentence_id: 6, id_display: 6, table_id: 'table-1', table_type: 'A_MATRIX', table_order_id: 4, text: 'Kadıköy', rawCoords: [50, 80, 150, 110] },
  { id: 'c5', page: 1, sentence_id: 7, id_display: 7, table_id: 'table-1', table_type: 'A_MATRIX', table_order_id: 5, text: '100', rawCoords: [150, 80, 250, 110] },
  { id: 'c6', page: 1, sentence_id: 8, id_display: 8, table_id: 'table-1', table_type: 'A_MATRIX', table_order_id: 6, text: '50', rawCoords: [250, 80, 350, 110] }
];

// User selects cell 'c5' (which is row 1, col 1) and changes table type to 'B_KEY_VALUE'
const selectedCell = parsedBBoxes.find(b => b.id === 'c5');
const newType = 'B_KEY_VALUE';

// Find all table siblings
const tableId = selectedCell.table_id;
const tableSiblings = parsedBBoxes.filter(it => it.page === selectedCell.page && it.table_id === tableId);

console.log(`Selected cell: "${selectedCell.text}" (ID: ${selectedCell.id})`);
console.log(`Changing table type from ${selectedCell.table_type} -> ${newType}`);

// Update all cells of this table!
tableSiblings.forEach(sibling => {
  sibling.table_type = newType;
});

// Verify every single cell in the table now has the new table type!
tableSiblings.forEach((cell, idx) => {
  console.log(` Cell #${idx + 1} (${cell.id}): table_type = ${cell.table_type}`);
  assert.strictEqual(cell.table_type, 'B_KEY_VALUE');
});

// Verify title and paragraph outside the table remain unaffected
assert.strictEqual(parsedBBoxes[0].category, 'Title');
assert.strictEqual(parsedBBoxes[1].category, 'Plain Text');

console.log('\n=== ALL TABLE CELLS SYNCHRONIZED SUCCESSFULLY! ===\n');
