const SentenceSplitter = require('./js/sentence-splitter.js');
const TableClassifier = require('./js/table-classifier.js');

const leftCol = [
  { id: '1', text: 'Kolon 1 (Aslında Sol Sütun Metni)', rawCoords: [15, 10, 480, 50] },
  { id: '2', text: 'Yapay zeka teknolojileri son yıllarda', rawCoords: [15, 60, 400, 90] },
  { id: '3', text: 'büyük', rawCoords: [405, 60, 470, 90] },
  { id: '4', text: 'bir ivme kazanmıştır. Özellikle doğal dil', rawCoords: [15, 95, 435, 125] },
  { id: '5', text: 'işleme alanındaki gelişmeler, makinelerin', rawCoords: [15, 130, 455, 160] },
  { id: '6', text: 'insan dilini anlama ve üretme kapasitesini', rawCoords: [15, 165, 460, 195] },
  { id: '7', text: 'olağanüstü boyutlara ulaştırmıştır.', rawCoords: [15, 200, 385, 230] },
  { id: '8', text: 'Şirketler artık müşteri hizmetleri', rawCoords: [15, 245, 365, 275] },
  { id: '9', text: 'operasyonlarını otomatize etmek için bu', rawCoords: [15, 280, 445, 310] },
  { id: '10', text: 'gelişmiş dil modellerinden', rawCoords: [15, 315, 295, 345] },
  { id: '11', text: 'faydalanmaktadır. Bu sayede hem', rawCoords: [15, 350, 375, 380] },
  { id: '12', text: 'maliyetler düşmekte hem de 7/24 hizmet', rawCoords: [15, 385, 455, 415] },
  { id: '13', text: 'sağlanmaktadır.', rawCoords: [15, 420, 185, 450] }
];

const rightCol = [
  { id: '14', text: 'Kolon 2 (Aslında Sağ Sütun Metni)', rawCoords: [500, 10, 960, 50] },
  { id: '15', text: 'Bu gelişmeler sadece teknoloji dünyasını', rawCoords: [500, 60, 930, 90] },
  { id: '16', text: 'değil, aynı zamanda finans, sağlık ve eğitim', rawCoords: [500, 95, 955, 125] },
  { id: '17', text: 'gibi birçok farklı sektörü de derinden', rawCoords: [500, 130, 895, 160] },
  { id: '18', text: 'etkilemekte ve dönüştürmektedir.', rawCoords: [500, 165, 865, 195] },
  { id: '19', text: 'Gelecekte bu sistemlerin çok daha entegre', rawCoords: [500, 245, 950, 275] },
  { id: '20', text: 've çoklu modal (görsel, ses ve metin bir', rawCoords: [500, 280, 900, 310] },
  { id: '21', text: 'arada) çalışması beklenmektedir.', rawCoords: [500, 315, 855, 345] },
  { id: '22', text: 'Yatırımlar bu yönde hızla artmaya devam', rawCoords: [500, 350, 940, 380] },
  { id: '23', text: 'ediyor.', rawCoords: [500, 385, 570, 415] }
];

// Mixed in Y-order like raw input
const allCells = [...leftCol, ...rightCol].sort((a, b) => a.rawCoords[1] - b.rawCoords[1]);

const res = TableClassifier.processTable({
  id: 'tbl-1',
  page: 1,
  cells: allCells,
  forced_type: 'C_PARALLEL_TEXT'
}, 1, 47, 1);

console.log('Result count:', res.items.length);
res.items.forEach(it => {
  console.log('SID:', it.sentence_id, '| TID:', it.table_order_label, '| Col:', it.col, '| X:', it.rawCoords[0], '| Y:', it.rawCoords[1], '| Text:', it.text.substring(0, 35));
});
