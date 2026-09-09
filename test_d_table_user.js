const TC = require('./js/table-classifier.js');

const rawJson = {
  type: 'table',
  coords: [233, 318, 1436, 510],
  confidence: 0.9791984558105469,
  num_rows: 4,
  num_cols: 4,
  cells: [
    { row: 0, col: 0, is_header: false, cell_coords: [18, 40, 255, 75], abs_coords: [251, 358, 488, 393], text: 'Bölge' },
    { row: 0, col: 1, is_header: false, cell_coords: [252, 40, 547, 75], abs_coords: [485, 358, 780, 393], text: '' },
    { row: 0, col: 2, is_header: false, cell_coords: [551, 40, 866, 75], abs_coords: [784, 358, 1099, 393], text: 'Satış Rakamları (₺)' },
    { row: 0, col: 3, is_header: false, cell_coords: [866, 40, 1132, 75], abs_coords: [1099, 358, 1365, 393], text: 'Durum' },
    { row: 1, col: 0, is_header: true, cell_coords: [18, 40, 255, 112], abs_coords: [251, 358, 488, 430], text: 'Bölge' },
    { row: 1, col: 1, is_header: true, cell_coords: [252, 40, 547, 112], abs_coords: [485, 358, 780, 430], text: 'Ocak - Mart' },
    { row: 1, col: 2, is_header: true, cell_coords: [551, 40, 866, 112], abs_coords: [784, 358, 1099, 430], text: 'Satış Rakamları (₺) Nisan - Haziran' },
    { row: 1, col: 3, is_header: true, cell_coords: [866, 40, 1132, 112], abs_coords: [1099, 358, 1365, 430], text: 'Durum' },
    { row: 2, col: 0, is_header: false, cell_coords: [18, 76, 255, 113], abs_coords: [251, 394, 488, 431], text: '' },
    { row: 2, col: 1, is_header: false, cell_coords: [252, 76, 547, 113], abs_coords: [485, 394, 780, 431], text: 'Ocak - Mart' },
    { row: 2, col: 2, is_header: false, cell_coords: [551, 76, 866, 113], abs_coords: [784, 394, 1099, 431], text: 'Nisan - Haziran' },
    { row: 2, col: 3, is_header: false, cell_coords: [866, 76, 1132, 113], abs_coords: [1099, 394, 1365, 431], text: '' },
    { row: 3, col: 0, is_header: false, cell_coords: [18, 115, 255, 150], abs_coords: [251, 433, 488, 468], text: 'Marmara' },
    { row: 3, col: 1, is_header: false, cell_coords: [252, 115, 547, 150], abs_coords: [485, 433, 780, 468], text: '500.000' },
    { row: 3, col: 2, is_header: false, cell_coords: [551, 115, 866, 150], abs_coords: [784, 433, 1099, 468], text: '650.000' },
    { row: 3, col: 3, is_header: false, cell_coords: [866, 115, 1132, 150], abs_coords: [1099, 433, 1365, 468], text: 'Başarılı' }
  ],
  words: [
    { word: '2024', bbox: [497, 321, 565, 357] },
    { word: 'Yılı', bbox: [572, 321, 614, 357] },
    { word: 'Yarıyıl', bbox: [621, 321, 707, 357] },
    { word: 'Satış', bbox: [713, 321, 775, 357] },
    { word: 've', bbox: [782, 321, 812, 357] },
    { word: 'Hedef', bbox: [819, 321, 896, 357] },
    { word: 'Gerçekleşme', bbox: [903, 321, 1070, 357] },
    { word: 'Raporu', bbox: [1077, 321, 1173, 357] },
    { word: 'Bölge', bbox: [348, 358, 422, 394] },
    { word: 'Satış', bbox: [709, 358, 772, 394] },
    { word: 'Rakamları', bbox: [779, 358, 913, 394] },
    { word: '(₺)', bbox: [920, 358, 961, 394] },
    { word: 'Durum', bbox: [1239, 358, 1331, 394] },
    { word: 'Ocak', bbox: [550, 395, 615, 431] },
    { word: '-', bbox: [621, 395, 632, 431] },
    { word: 'Mart', bbox: [638, 395, 701, 431] },
    { word: 'Nisan', bbox: [850, 395, 925, 431] },
    { word: '-', bbox: [932, 395, 942, 431] },
    { word: 'Haziran', bbox: [949, 395, 1052, 431] },
    { word: 'Marmara', bbox: [250, 433, 371, 469] },
    { word: '500.000', bbox: [550, 433, 658, 469] },
    { word: '650.000', bbox: [850, 433, 958, 469] },
    { word: 'Başarılı', bbox: [1150, 433, 1250, 469] },
    { word: 'İç', bbox: [250, 470, 274, 506] },
    { word: 'Anadolu', bbox: [280, 470, 390, 506] },
    { word: '300.000', bbox: [550, 470, 658, 506] },
    { word: '320.000', bbox: [850, 470, 958, 506] },
    { word: 'Beklentinin', bbox: [1150, 470, 1302, 506] },
    { word: 'Altında', bbox: [1309, 470, 1404, 506] }
  ]
};

const res = TC.processTable(rawJson, 1, 1, 1);
console.log('Classified Type:', res.tableType);
console.log('Top Banner:', res.tableMeta.top_banner);
console.log('Extracted Items Count:', res.items.length);
res.items.forEach((it, idx) => {
  console.log(`#${idx + 1} [SID:${it.sentence_id} | ${it.table_order_label}] (R:${it.row}, C:${it.col}) Text: "${it.text}" | Reading: "${it.fullSentenceText}"`);
});
