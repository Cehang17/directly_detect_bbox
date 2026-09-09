const TableClassifier = require('./js/table-classifier.js');

const cells = [
  { id: 'c1', text: 'Alan', rawCoords: [10, 10, 80, 30] },
  { id: 'c2', text: 'Değer', rawCoords: [120, 10, 180, 30] },
  { id: 'c3', text: 'Adı Soyadı', rawCoords: [10, 35, 90, 55] },
  { id: 'c4', text: 'Ahmet Yılmaz', rawCoords: [120, 35, 220, 55] },
  { id: 'c5', text: 'TCKN', rawCoords: [10, 60, 60, 80] },
  { id: 'c6', text: ':', rawCoords: [90, 60, 95, 80] },
  { id: 'c7', text: '12345678901', rawCoords: [120, 60, 210, 80] },
  { id: 'c8', text: 'Doğum Tarihi :', rawCoords: [10, 85, 105, 105] },
  { id: 'c9', text: '15.08.1985', rawCoords: [120, 85, 200, 105] },
  { id: 'c10', text: 'Müşteri No', rawCoords: [10, 110, 95, 130] },
  { id: 'c11', text: ':', rawCoords: [95, 110, 100, 130] },
  { id: 'c12', text: 'M-8899445', rawCoords: [120, 110, 210, 130] },
  { id: 'c13', text: 'Adres', rawCoords: [10, 135, 70, 155] },
  { id: 'c14', text: ':', rawCoords: [95, 135, 100, 155] },
  { id: 'c15', text: 'Atatürk Mah. Cumhuriyet Cad. No:10 İstanbul', rawCoords: [120, 135, 380, 155] }
];

const res = TableClassifier.processTable({
  id: 'tbl-form',
  page: 1,
  cells: cells,
  forced_type: 'B_KEY_VALUE'
}, 1, 31, 1);

console.log('Result Items Count:', res.items.length);
res.items.forEach((it, idx) => {
  console.log(`[${idx}] SID: ${it.sentence_id} | OrigID: ${it.id} | Row: ${it.row} | Col: ${it.col} | Text: "${it.text}" | Full: "${it.fullSentenceText}"`);
});
