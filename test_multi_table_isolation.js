const assert = require('assert');

console.log('=== TESTING MULTI-TABLE ISOLATION & INDEPENDENT TYPE CHANGES ===\n');

// Mock 2 distinct tables on the same page
const tableA_items = [
  { id: 'c1', page: 1, table_id: 'table-p1-1', table_type: 'A_MATRIX', table_order_id: 1, text: 'Başlık 1', rawCoords: [50, 50, 150, 80] },
  { id: 'c2', page: 1, table_id: 'table-p1-1', table_type: 'A_MATRIX', table_order_id: 2, text: 'Başlık 2', rawCoords: [160, 50, 260, 80] },
  { id: 'c3', page: 1, table_id: 'table-p1-1', table_type: 'A_MATRIX', table_order_id: 3, text: 'Veri 1', rawCoords: [50, 90, 150, 120] },
  { id: 'c4', page: 1, table_id: 'table-p1-1', table_type: 'A_MATRIX', table_order_id: 4, text: 'Veri 2', rawCoords: [160, 90, 260, 120] }
];

const tableB_items = [
  { id: 'c5', page: 1, table_id: 'table-p1-2', table_type: 'B_KEY_VALUE', table_order_id: 1, text: 'Adı Soyadı :', rawCoords: [50, 200, 150, 230] },
  { id: 'c6', page: 1, table_id: 'table-p1-2', table_type: 'B_KEY_VALUE', table_order_id: 2, text: 'Ahmet Yılmaz', rawCoords: [160, 200, 300, 230] },
  { id: 'c7', page: 1, table_id: 'table-p1-2', table_type: 'B_KEY_VALUE', table_order_id: 3, text: 'TCKN :', rawCoords: [50, 240, 150, 270] },
  { id: 'c8', page: 1, table_id: 'table-p1-2', table_type: 'B_KEY_VALUE', table_order_id: 4, text: '12345678901', rawCoords: [160, 240, 300, 270] }
];

const allBoxes = [...tableA_items, ...tableB_items];

// Function simulating user changing Table A's type to C_PARALLEL_TEXT
function changeTableType(selectedItem, newType) {
  const tableId = selectedItem.table_id;
  const tableSiblings = allBoxes.filter(it => it.page === selectedItem.page && it.table_id === tableId);
  
  tableSiblings.forEach(s => {
    s.table_type = newType;
  });
}

// User selects a cell from Table A and changes its type to C_PARALLEL_TEXT
console.log('Changing Table A (table-p1-1) type to C_PARALLEL_TEXT...');
changeTableType(tableA_items[0], 'C_PARALLEL_TEXT');

// Verify Table A cells updated
tableA_items.forEach(c => {
  assert.strictEqual(c.table_type, 'C_PARALLEL_TEXT', 'All Table A cells must be C_PARALLEL_TEXT');
});

// Verify Table B cells were COMPLETELY UNTOUCHED and stay B_KEY_VALUE
tableB_items.forEach(c => {
  assert.strictEqual(c.table_type, 'B_KEY_VALUE', 'Table B cells must stay B_KEY_VALUE and NOT be affected by Table A');
});

console.log('✓ Table A is now C_PARALLEL_TEXT');
console.log('✓ Table B remained B_KEY_VALUE independently!');
console.log('\n=== MULTI-TABLE ISOLATION TEST PASSED 100%! ===\n');
