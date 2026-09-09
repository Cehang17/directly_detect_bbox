const assert = require('assert');
const OverlayManager = require('./js/overlay.js');

console.log('=== TESTING SPLIT MIDDLE BBOX ID RENUMBERING ===\n');

// Set up 3 BBoxes sharing ID 1 (exactly like in the screenshot):
// Box 1: "Tablo Sınıflandırma Örnekleri" -> ID 1
// Box 2: "Bu belge, belirttiğiniz 6 farklı tablo sınıflandırmasına..." -> ID 1
// Box 3: "içermektedir." -> ID 1
// Followed by Sentence 2: "Sonraki cümle..." -> ID 2
const initialData = [
  { id: 'b1', page: 1, sentence_id: 0, id_display: 0, text: 'Tablo Sınıflandırma Örnekleri', rawCoords: [50, 20, 400, 50] },
  { id: 'b2', page: 1, sentence_id: 0, id_display: 0, text: 'Bu belge, belirttiğiniz 6 farklı tablo sınıflandırmasına...', rawCoords: [50, 60, 450, 80] },
  { id: 'b3', page: 1, sentence_id: 0, id_display: 0, text: 'içermektedir.', rawCoords: [50, 85, 120, 105] },
  { id: 'b4', page: 1, sentence_id: 1, id_display: 1, text: 'Sonraki cümle...', rawCoords: [50, 120, 400, 140] }
];

const overlay = new OverlayManager();
overlay.setData(initialData);

console.log('Initial state:');
overlay.getAllItems().forEach(it => {
  console.log(`  [${it.id}] ID #${it.id_display} - "${it.text.substring(0, 30)}..."`);
});

// User selects middle box 'b2' and changes target ID to 1 (to split it into sentence #1):
console.log('\n--> User changes ID of middle box "b2" to 1 (splitting from b1)...');
overlay.reorderBBoxId('b2', '1');

const resultItems = overlay.getAllItems();
console.log('\nState after change:');
resultItems.forEach(it => {
  console.log(`  [${it.id}] ID #${it.id_display} - "${it.text.substring(0, 30)}..."`);
});

// Assertions:
// 1. Box 1 ("Tablo Sınıflandırma Örnekleri") should remain with ID 0
const box1 = resultItems.find(it => it.id === 'b1');
assert.strictEqual(box1.id_display, 0, 'Box 1 should keep its previous ID 0');

// 2. Box 2 ("Bu belge...") and Box 3 ("içermektedir.") should both become ID 1
const box2 = resultItems.find(it => it.id === 'b2');
const box3 = resultItems.find(it => it.id === 'b3');
assert.strictEqual(box2.id_display, 1, 'Box 2 should take new ID 1');
assert.strictEqual(box3.id_display, 1, 'Box 3 should take new ID 1 alongside Box 2');

// 3. Subsequent sentence Box 4 should shift to ID 2
const box4 = resultItems.find(it => it.id === 'b4');
assert.strictEqual(box4.id_display, 2, 'Box 4 should shift to ID 2');

console.log('\n=== ALL ASSERTIONS PASSED! MIDDLE BOX SPLIT WORKS FLAWLESSLY! ===\n');
