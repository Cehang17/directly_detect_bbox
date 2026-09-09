const TableClassifier = require('./js/table-classifier.js');
const SentenceSplitter = require('./js/sentence-splitter.js');
const assert = require('assert');

console.log("=== TESTING TABLE CELL TEXT UNIFICATION & SENTENCE-LEVEL SPLITTING ===");

// Scenario 1: Multi-line cell with a SINGLE sentence spanning 3 lines in an A_MATRIX table
const matrixTableWithMultiLineCell = {
  id: "table-1",
  cells: [
    { row: 0, col: 0, text: "Ürün", rawCoords: [50, 50, 150, 80] },
    { row: 0, col: 1, text: "Açıklama", rawCoords: [160, 50, 400, 80] },
    { row: 1, col: 0, text: "Model X", rawCoords: [50, 90, 150, 150] },
    {
      row: 1, col: 1,
      // A cell composed of 3 lines forming 1 complete sentence
      rawCoords: [160, 90, 400, 150],
      words: [
        { word: "Bu", bbox: [160, 90, 180, 105] },
        { word: "cihaz", bbox: [185, 90, 220, 105] },
        { word: "yüksek", bbox: [225, 90, 270, 105] },
        { word: "performans", bbox: [275, 90, 350, 105] },
        { word: "ve", bbox: [160, 110, 175, 125] },
        { word: "enerji", bbox: [180, 110, 220, 125] },
        { word: "tasarrufu", bbox: [225, 110, 290, 125] },
        { word: "sağlamak", bbox: [295, 110, 355, 125] },
        { word: "amacıyla", bbox: [160, 130, 215, 145] },
        { word: "özel", bbox: [220, 130, 250, 145] },
        { word: "olarak", bbox: [255, 130, 295, 145] },
        { word: "tasarlanmıştır.", bbox: [300, 130, 395, 145] }
      ]
    }
  ]
};

const res1 = TableClassifier.processTable(matrixTableWithMultiLineCell, 1, 1, 1);
console.log(`\nScenario 1 (Single multi-line sentence in cell):`);
console.log(`Table items count: ${res1.items.length}`);
res1.items.forEach((it, idx) => {
  console.log(`  [Item ${idx + 1}] ID #${it.sentence_id} (${it.table_order_label}): "${it.text}" | Full: "${it.fullSentenceText}"`);
});

// Cell (R1, C1) should have lines that share the SAME sentence_id (e.g. ID 4)
const r1c1Items = res1.items.filter(it => it.id.includes('-s4') || it.text.includes('cihaz') || it.text.includes('tasarrufu') || it.text.includes('tasarlanmıştır'));
assert(r1c1Items.length === 3, `Expected 3 line boxes for cell R1,C1, got ${r1c1Items.length}`);
const uniqueIds = new Set(r1c1Items.map(it => it.sentence_id));
assert(uniqueIds.size === 1, `Expected all 3 lines to share exactly 1 sentence_id, got ${uniqueIds.size}`);
console.log(`✓ Scenario 1 passed: All 3 lines of cell R1,C1 share sentence_id: ${r1c1Items[0].sentence_id}`);

// Scenario 2: Multi-line cell with TWO DISTINCT sentences spanning 4 lines in B_KEY_VALUE form
const keyValueWithTwoSentences = {
  id: "table-2",
  cells: [
    { row: 0, col: 0, text: "Başvuru Şartları :", rawCoords: [50, 50, 180, 120] },
    {
      row: 0, col: 1,
      rawCoords: [190, 50, 450, 120],
      words: [
        // Sentence 1 (2 lines)
        { word: "Adayların", bbox: [190, 50, 250, 65] },
        { word: "en", bbox: [255, 50, 275, 65] },
        { word: "az", bbox: [280, 50, 295, 65] },
        { word: "lisans", bbox: [300, 50, 340, 65] },
        { word: "mezunu", bbox: [190, 70, 240, 85] },
        { word: "olması", bbox: [245, 70, 290, 85] },
        { word: "gerekmektedir.", bbox: [295, 70, 385, 85] },
        // Sentence 2 (2 lines)
        { word: "Ayrıca", bbox: [190, 90, 235, 105] },
        { word: "iyi", bbox: [240, 90, 260, 105] },
        { word: "derecede", bbox: [265, 90, 320, 105] },
        { word: "İngilizce", bbox: [325, 90, 385, 105] },
        { word: "bilgisi", bbox: [190, 110, 235, 125] },
        { word: "şarttır.", bbox: [240, 110, 290, 125] }
      ]
    }
  ]
};

const res2 = TableClassifier.processTable(keyValueWithTwoSentences, 1, 10, 2);
console.log(`\nScenario 2 (Two sentences inside single cell):`);
console.log(`Table items count: ${res2.items.length}`);
res2.items.forEach((it, idx) => {
  console.log(`  [Item ${idx + 1}] ID #${it.sentence_id} (${it.table_order_label}): "${it.text}" | Full: "${it.fullSentenceText}"`);
});

const sentence1Items = res2.items.filter(it => it.text.includes('Adayların') || it.text.includes('mezunu'));
const sentence2Items = res2.items.filter(it => it.text.includes('Ayrıca') || it.text.includes('bilgisi'));
assert(sentence1Items.length === 2, `Sentence 1 should have 2 line bboxes, got ${sentence1Items.length}`);
assert(sentence2Items.length === 2, `Sentence 2 should have 2 line bboxes, got ${sentence2Items.length}`);
assert(sentence1Items[0].sentence_id !== sentence2Items[0].sentence_id, `Sentence 1 and Sentence 2 should have distinct sentence_ids`);
assert(sentence1Items[0].sentence_id === sentence1Items[1].sentence_id, `Lines of Sentence 1 must share sentence_id`);
assert(sentence2Items[0].sentence_id === sentence2Items[1].sentence_id, `Lines of Sentence 2 must share sentence_id`);

console.log(`✓ Scenario 2 passed: Sentence 1 has ID ${sentence1Items[0].sentence_id} across 2 lines, Sentence 2 has ID ${sentence2Items[0].sentence_id} across 2 lines.`);

console.log("\n=== ALL CELL TEXT UNIFICATION & SENTENCE SPLITTING TESTS PASSED! ===");
