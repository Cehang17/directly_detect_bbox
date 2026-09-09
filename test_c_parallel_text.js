const assert = require('assert');
const TableClassifier = require('./js/table-classifier.js');
const SentenceSplitter = require('./js/sentence-splitter.js');

console.log('=== TESTING C_PARALLEL_TEXT COLUMN-BY-COLUMN SENTENCE SPLITTING ===\n');

// Mock table with 2 columns of multi-line text (like the user's screenshot)
const parallelTable = {
  id: 'table-c-parallel-doc',
  bbox: [50, 50, 600, 400],
  forced_type: 'C_PARALLEL_TEXT',
  cells: [
    // Column 0 Header
    { row: 0, col: 0, text: 'Kolon 1 (Aslında Sol Sütun Metni)', rawCoords: [50, 50, 290, 75] },
    // Column 0 Lines (Paragraph 1)
    { row: 1, col: 0, text: 'Yapay zeka teknolojileri son yıllarda büyük', rawCoords: [50, 80, 290, 105] },
    { row: 2, col: 0, text: 'bir ivme kazanmıştır. Özellikle doğal dil', rawCoords: [50, 110, 290, 135] },
    { row: 3, col: 0, text: 'işleme alanındaki gelişmeler, makinelerin', rawCoords: [50, 140, 290, 165] },
    { row: 4, col: 0, text: 'insan dilini anlama ve üretme kapasitesini', rawCoords: [50, 170, 290, 195] },
    { row: 5, col: 0, text: 'olağanüstü boyutlara ulaştırmıştır.', rawCoords: [50, 200, 290, 225] },

    // Column 1 Header
    { row: 0, col: 1, text: 'Kolon 2 (Aslında Sağ Sütun Metni)', rawCoords: [310, 50, 550, 75] },
    // Column 1 Lines (Paragraph 1)
    { row: 1, col: 1, text: 'Bu gelişmeler sadece teknoloji dünyasını', rawCoords: [310, 80, 550, 105] },
    { row: 2, col: 1, text: 'değil, aynı zamanda finans, sağlık ve eğitim', rawCoords: [310, 110, 550, 135] },
    { row: 3, col: 1, text: 'gibi birçok farklı sektörü de derinden', rawCoords: [310, 140, 550, 165] },
    { row: 4, col: 1, text: 'etkilemekte ve dönüştürmektedir.', rawCoords: [310, 170, 550, 195] }
  ]
};

const res = TableClassifier.processTable(parallelTable, 1, 1, 1);

console.log('Result Table Type:', res.tableType);
assert.strictEqual(res.tableType, 'C_PARALLEL_TEXT', 'Table type must strictly remain C_PARALLEL_TEXT');

console.log('\nExtracted Items:');
res.items.forEach((it, idx) => {
  console.log(`  [Item ${idx + 1}] ID #${it.sentence_id} (Col ${it.col}): "${it.text}" | Full: "${it.fullSentenceText}"`);
});

const col0Items = res.items.filter(it => it.col === 0);
const otherColItems = res.items.filter(it => it.col !== 0);

assert.ok(col0Items.length > 0, 'Left column must have items');
assert.ok(otherColItems.length > 0, 'Right column must have items');

const maxCol0SentenceId = Math.max(...col0Items.map(it => it.sentence_id));
const minOtherColSentenceId = Math.min(...otherColItems.map(it => it.sentence_id));

assert.ok(maxCol0SentenceId < minOtherColSentenceId, 'Left column sentences must strictly finish BEFORE right column starts');

// Verify all items have table_type: 'C_PARALLEL_TEXT' and table_id: 'table-c-parallel-doc'
res.items.forEach(it => {
  assert.strictEqual(it.table_type, 'C_PARALLEL_TEXT');
  assert.strictEqual(it.table_id, 'table-c-parallel-doc');
});

console.log('\n=== C_PARALLEL_TEXT TEST PASSED 100%! ===\n');
