const assert = require('assert');
const TableClassifier = require('./js/table-classifier.js');
const SentenceSplitter = require('./js/sentence-splitter.js');

console.log('=== TEST: EXACT USER SCREENSHOT C_PARALLEL_TEXT TABLE ===\n');

// Build the exact items as shown in the screenshot:
// 2 Columns, Header row + 2 Data rows
const rawItemsFromScreenshot = [
  // Kolon 1 Header
  { id: 'box-hdr-1', page: 1, text: 'Kolon 1 (Aslında Sol Sütun Metni)', rawCoords: [50, 50, 290, 75] },
  // Kolon 2 Header
  { id: 'box-hdr-2', page: 1, text: 'Kolon 2 (Aslında Sağ Sütun Metni)', rawCoords: [310, 50, 550, 75] },

  // Row 1 - Kolon 1 (Left)
  { id: 'box-r1c0-1', page: 1, text: 'Yapay zeka teknolojileri son yıllarda büyük', rawCoords: [50, 80, 290, 105] },
  { id: 'box-r1c0-2', page: 1, text: 'bir ivme kazanmıştır. Özellikle doğal dil', rawCoords: [50, 110, 290, 135] },
  { id: 'box-r1c0-3', page: 1, text: 'işleme alanındaki gelişmeler, makinelerin', rawCoords: [50, 140, 290, 165] },
  { id: 'box-r1c0-4', page: 1, text: 'insan dilini anlama ve üretme kapasitesini', rawCoords: [50, 170, 290, 195] },
  { id: 'box-r1c0-5', page: 1, text: 'olağanüstü boyutlara ulaştırmıştır.', rawCoords: [50, 200, 290, 225] },

  // Row 1 - Kolon 2 (Right)
  { id: 'box-r1c1-1', page: 1, text: 'Bu gelişmeler sadece teknoloji dünyasını', rawCoords: [310, 80, 550, 105] },
  { id: 'box-r1c1-2', page: 1, text: 'değil, aynı zamanda finans, sağlık ve eğitim', rawCoords: [310, 110, 550, 135] },
  { id: 'box-r1c1-3', page: 1, text: 'gibi birçok farklı sektörü de derinden', rawCoords: [310, 140, 550, 165] },
  { id: 'box-r1c1-4', page: 1, text: 'etkilemekte ve dönüştürmektedir.', rawCoords: [310, 170, 550, 195] },

  // Row 2 - Kolon 1 (Left)
  { id: 'box-r2c0-1', page: 1, text: 'Şirketler artık müşteri hizmetleri', rawCoords: [50, 245, 290, 270] },
  { id: 'box-r2c0-2', page: 1, text: 'operasyonlarını otomatize etmek için bu', rawCoords: [50, 275, 290, 300] },
  { id: 'box-r2c0-3', page: 1, text: 'gelişmiş dil modellerinden', rawCoords: [50, 305, 290, 330] },
  { id: 'box-r2c0-4', page: 1, text: 'faydalanmaktadır. Bu sayede hem', rawCoords: [50, 335, 290, 360] },
  { id: 'box-r2c0-5', page: 1, text: 'maliyetler düşmekte hem de 7/24 hizmet', rawCoords: [50, 365, 290, 390] },
  { id: 'box-r2c0-6', page: 1, text: 'sağlanmaktadır.', rawCoords: [50, 395, 290, 420] },

  // Row 2 - Kolon 2 (Right)
  { id: 'box-r2c1-1', page: 1, text: 'Gelecekte bu sistemlerin çok daha entegre', rawCoords: [310, 245, 550, 270] },
  { id: 'box-r2c1-2', page: 1, text: 've çoklu modal (görsel, ses ve metin bir', rawCoords: [310, 275, 550, 300] },
  { id: 'box-r2c1-3', page: 1, text: 'arada) çalışması beklenmektedir.', rawCoords: [310, 305, 550, 330] },
  { id: 'box-r2c1-4', page: 1, text: 'Yatırımlar bu yönde hızla artmaya devam', rawCoords: [310, 335, 550, 360] },
  { id: 'box-r2c1-5', page: 1, text: 'ediyor.', rawCoords: [310, 365, 550, 390] }
];

console.log('Total input boxes:', rawItemsFromScreenshot.length);

const res = TableClassifier.processTable({
  id: 'table-p1-1',
  page: 1,
  cells: rawItemsFromScreenshot,
  forced_type: 'C_PARALLEL_TEXT'
}, 1, 46, 1);

console.log('\n--- PROCESSED RESULT ITEMS ---');
res.items.forEach((it, idx) => {
  console.log(`[Item ${idx + 1}] ID: #${it.sentence_id} (Col ${it.col}, Row ${it.row}) | Text: "${it.text}" | Full: "${it.fullSentenceText}"`);
});

// Assertions:
// 1. All Kolon 1 (col 0) items must have sentence_id STRICTLY LESS THAN all Kolon 2 (col 1) items!
const col0Items = res.items.filter(it => it.col === 0);
const col1Items = res.items.filter(it => it.col === 1);

console.log(`\nCol 0 Items Count: ${col0Items.length}, Col 1 Items Count: ${col1Items.length}`);
assert.ok(col0Items.length > 0, 'Must have col 0 items');
assert.ok(col1Items.length > 0, 'Must have col 1 items');

const col0MaxId = Math.max(...col0Items.map(it => it.sentence_id));
const col1MinId = Math.min(...col1Items.map(it => it.sentence_id));

console.log(`Col 0 Max Sentence ID: ${col0MaxId}`);
console.log(`Col 1 Min Sentence ID: ${col1MinId}`);

assert.ok(col0MaxId < col1MinId, `Col 0 max ID (${col0MaxId}) MUST be less than Col 1 min ID (${col1MinId})!`);

console.log('\n=== ALL USER SCREENSHOT TABLE CHECKS PASSED! ===\n');
