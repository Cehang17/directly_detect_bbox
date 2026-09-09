const TableClassifier = require('./js/table-classifier.js');
const assert = require('assert');

console.log("=== TESTING MULTI-TABLE INDEPENDENT ISOLATION ===");

// Simulate a document page with 2 separate tables:
// Table 1: Matrix Table at top of page (y: 50..150)
// Table 2: Key-Value Table at bottom of page (y: 350..500)

const parsedBBoxes = [
  // Table 1 cells (top)
  { id: "t1_c1", page: 1, text: "Yıl", rawCoords: [50, 50, 150, 90], table_id: "table-p1-1", table_type: "A_MATRIX", sentence_id: 1, id_display: 1, category: "Table Cell" },
  { id: "t1_c2", page: 1, text: "Satış", rawCoords: [160, 50, 260, 90], table_id: "table-p1-1", table_type: "A_MATRIX", sentence_id: 2, id_display: 2, category: "Table Cell" },
  { id: "t1_c3", page: 1, text: "2023", rawCoords: [50, 100, 150, 140], table_id: "table-p1-1", table_type: "A_MATRIX", sentence_id: 3, id_display: 3, category: "Table Cell" },
  { id: "t1_c4", page: 1, text: "500.000", rawCoords: [160, 100, 260, 140], table_id: "table-p1-1", table_type: "A_MATRIX", sentence_id: 4, id_display: 4, category: "Table Cell" },

  // Table 2 cells (bottom)
  { id: "t2_c1", page: 1, text: "Adı Soyadı :", rawCoords: [50, 350, 180, 390], table_id: "table-p1-2", table_type: "B_KEY_VALUE", sentence_id: 5, id_display: 5, category: "Table Cell" },
  { id: "t2_c2", page: 1, text: "Mehmet Demir", rawCoords: [190, 350, 350, 390], table_id: "table-p1-2", table_type: "B_KEY_VALUE", sentence_id: 6, id_display: 6, category: "Table Cell" },
  { id: "t2_c3", page: 1, text: "Departman :", rawCoords: [50, 400, 180, 440], table_id: "table-p1-2", table_type: "B_KEY_VALUE", sentence_id: 7, id_display: 7, category: "Table Cell" },
  { id: "t2_c4", page: 1, text: "Yazılım", rawCoords: [190, 400, 350, 440], table_id: "table-p1-2", table_type: "B_KEY_VALUE", sentence_id: 8, id_display: 8, category: "Table Cell" }
];

// Flood fill helper mimicking findConnectedTableCells in app.js
function findConnectedTableCells(startItem, allItems) {
  const pool = allItems.filter(it => it.page === startItem.page);
  const tableId = startItem.table_id || startItem.layout_id;
  if (tableId) {
    const byId = pool.filter(it => it.table_id === tableId || it.layout_id === tableId);
    if (byId.length > 0) {
      const startBox = startItem.rawCoords || [0, 0, 0, 0];
      const startCy = (startBox[1] + startBox[3]) / 2;
      const startCx = (startBox[0] + startBox[2]) / 2;
      const closeById = byId.filter(it => {
        const b = it.rawCoords || [0, 0, 0, 0];
        const cy = (b[1] + b[3]) / 2;
        const cx = (b[0] + b[2]) / 2;
        return Math.abs(cy - startCy) < 450 && Math.abs(cx - startCx) < 600;
      });
      if (closeById.length > 0) return closeById;
    }
  }

  const cluster = [startItem];
  const visited = new Set([String(startItem.id)]);
  const candidates = pool.filter(it => it.category === 'Table Cell' || it.table_type || it.table_id);
  let added = true;

  while (added) {
    added = false;
    for (const it of candidates) {
      if (visited.has(String(it.id))) continue;
      const b = it.rawCoords || [0, 0, 0, 0];

      const isConnected = cluster.some(c => {
        const cb = c.rawCoords || [0, 0, 0, 0];
        const overlapX = Math.max(0, Math.min(b[2], cb[2]) - Math.max(b[0], cb[0]));
        const overlapY = Math.max(0, Math.min(b[3], cb[3]) - Math.max(b[1], cb[1]));
        const gapX = Math.max(0, Math.max(b[0], cb[0]) - Math.min(b[2], cb[2]));
        const gapY = Math.max(0, Math.max(b[1], cb[1]) - Math.min(b[3], cb[3]));

        if (overlapY > 5 && gapX < 160) return true;
        if (overlapX > 5 && gapY < 50) return true;
        if (gapX < 80 && gapY < 45) return true;

        return false;
      });

      if (isConnected) {
        cluster.push(it);
        visited.add(String(it.id));
        added = true;
      }
    }
  }

  return cluster;
}

// Action: User selects cell "t1_c2" in Table 1 and changes type to C_PARALLEL_TEXT
const selectedItem = parsedBBoxes.find(it => it.id === "t1_c2");
const tableSiblings = findConnectedTableCells(selectedItem, parsedBBoxes);

console.log(`Selected cell: "${selectedItem.text}"`);
console.log(`Connected cluster size: ${tableSiblings.length} cells`);
assert(tableSiblings.length === 4, `Expected 4 cells in Table 1 cluster, got ${tableSiblings.length}`);
assert(tableSiblings.every(c => c.id.startsWith('t1_')), `Only Table 1 cells must be in cluster!`);

// Update type of Table 1 only
tableSiblings.forEach(s => {
  s.table_type = "C_PARALLEL_TEXT";
});

// Check state of Table 1
assert(parsedBBoxes.filter(it => it.id.startsWith('t1_')).every(it => it.table_type === 'C_PARALLEL_TEXT'), "All Table 1 cells should be C_PARALLEL_TEXT");

// Check state of Table 2: MUST REMAIN B_KEY_VALUE!
assert(parsedBBoxes.filter(it => it.id.startsWith('t2_')).every(it => it.table_type === 'B_KEY_VALUE'), "All Table 2 cells MUST remain B_KEY_VALUE!");

console.log("✓ Table 1 successfully changed to C_PARALLEL_TEXT");
console.log("✓ Table 2 remained B_KEY_VALUE without any modification!");
console.log("\n=== MULTI-TABLE ISOLATION TEST PASSED 100%! ===");
