const assert = require('assert');
const TableClassifier = require('./js/table-classifier.js');
const SentenceSplitter = require('./js/sentence-splitter.js');
const BBoxParser = require('./js/bbox-parser.js');

console.log('=== TESTING 6 TABLE CLASSIFICATION & DUAL READING ORDER SYSTEM ===\n');

// 1. A_MATRIX (4x4 Branch & Revenue Comparison Matrix)
const matrixTable = {
  id: 'table-1-matrix',
  bbox: [50, 50, 450, 200],
  cells: [
    { row: 0, col: 0, rawCoords: [50, 50, 150, 80], text: 'Şube Adı' },
    { row: 0, col: 1, rawCoords: [150, 50, 250, 80], text: '2023 Q1 Gelir (₺)' },
    { row: 0, col: 2, rawCoords: [250, 50, 350, 80], text: '2023 Q2 Gelir (₺)' },
    { row: 0, col: 3, rawCoords: [350, 50, 450, 80], text: 'Büyüme Oranı' },
    { row: 1, col: 0, rawCoords: [50, 80, 150, 110], text: 'Kadıköy' },
    { row: 1, col: 1, rawCoords: [150, 80, 250, 110], text: '120.000' },
    { row: 1, col: 2, rawCoords: [250, 80, 350, 110], text: '145.000' },
    { row: 1, col: 3, rawCoords: [350, 80, 450, 110], text: '%20.8' },
    { row: 2, col: 0, rawCoords: [50, 110, 150, 140], text: 'Beşiktaş' },
    { row: 2, col: 1, rawCoords: [150, 110, 250, 140], text: '115.000' },
    { row: 2, col: 2, rawCoords: [250, 110, 350, 140], text: '125.000' },
    { row: 2, col: 3, rawCoords: [350, 110, 450, 140], text: '%8.6' }
  ]
};

const res1 = TableClassifier.processTable(matrixTable, 1, 1, 1);
console.log('1. A_MATRIX Type:', res1.tableType, '| Items:', res1.items.length);
assert.strictEqual(res1.tableType, 'A_MATRIX');
console.log('   Global ID:', res1.items[5].sentence_id, '| Table Order ID:', res1.items[5].table_order_id);
console.log('   Cell Text:', res1.items[5].text);
assert.strictEqual(res1.items[5].table_order_id, 6);
assert.strictEqual(res1.items[5].text, '120.000');

// 2. B_KEY_VALUE (3-column form with ':' separator)
const keyValueTable = {
  id: 'table-2-kv',
  bbox: [50, 50, 400, 220],
  cells: [
    { row: 0, col: 0, rawCoords: [50, 50, 150, 80], text: 'Adı Soyadı' },
    { row: 0, col: 1, rawCoords: [150, 50, 170, 80], text: ':' },
    { row: 0, col: 2, rawCoords: [170, 50, 400, 80], text: 'Ahmet Yılmaz' },
    { row: 1, col: 0, rawCoords: [50, 80, 150, 110], text: 'TCKN' },
    { row: 1, col: 1, rawCoords: [150, 80, 170, 110], text: ':' },
    { row: 1, col: 2, rawCoords: [170, 80, 400, 110], text: '12345678901' },
    { row: 2, col: 0, rawCoords: [50, 110, 150, 140], text: 'Doğum Tarihi' },
    { row: 2, col: 1, rawCoords: [150, 110, 170, 140], text: ':' },
    { row: 2, col: 2, rawCoords: [170, 110, 400, 140], text: '15.08.1985' }
  ]
};

const res2 = TableClassifier.processTable(keyValueTable, 1, 1, 2);
console.log('\n2. B_KEY_VALUE Type:', res2.tableType);
assert.strictEqual(res2.tableType, 'B_KEY_VALUE');
console.log('   First Cell Text:', res2.items[0].text);
console.log('   First Pair Table Order ID:', res2.items[0].table_order_id, '| Second Pair Table Order ID:', res2.items[3].table_order_id);
assert.strictEqual(res2.items[0].table_order_id, 1);
assert.strictEqual(res2.items[3].table_order_id, 4);
assert.strictEqual(res2.items[0].text, 'Adı Soyadı');

// 3. C_PARALLEL_TEXT (Parallel Multi-Column Paragraph Blocks)
const parallelTextTable = {
  id: 'table-3-para',
  bbox: [50, 50, 500, 300],
  cells: [
    { row: 0, col: 0, rawCoords: [50, 50, 270, 150], text: 'Yapay zeka teknolojileri son yıllarda büyük bir ivme kazanmıştır. Özellikle doğal dil işleme alanındaki gelişmeler makinelerin insan dilini anlama kapasitesini artırmıştır.' },
    { row: 0, col: 1, rawCoords: [280, 50, 500, 150], text: 'Bu gelişmeler sadece teknoloji dünyasını değil, aynı zamanda finans, sağlık ve eğitim gibi birçok farklı sektörü de derinden dönüştürmektedir.' },
    { row: 1, col: 0, rawCoords: [50, 160, 270, 260], text: 'Şirketler artık müşteri hizmetleri operasyonlarını otomatize etmek için bu modellerden faydalanmaktadır.' },
    { row: 1, col: 1, rawCoords: [280, 160, 500, 260], text: 'Gelecekte bu sistemlerin çok daha entegre ve çoklu modal çalışması beklenmektedir.' }
  ]
};

const res3 = TableClassifier.processTable(parallelTextTable, 1, 1, 3);
console.log('\n3. C_PARALLEL_TEXT Type:', res3.tableType);
assert.strictEqual(res3.tableType, 'C_PARALLEL_TEXT');
console.log('   Decomposed plain text count:', res3.items.length);
assert.strictEqual(res3.items[0].table_type, 'C_PARALLEL_TEXT');

// 4. D_MERGED_CELLS (Hierarchical Headers with Colspan & Rowspan)
const mergedTable = {
  id: 'table-4-merged',
  bbox: [50, 50, 450, 220],
  cells: [
    { row: 0, col: 0, colspan: 4, rawCoords: [50, 50, 450, 80], text: '2024 Yılı Yarıyıl Satış ve Hedef Gerçekleşme Raporu' },
    { row: 1, col: 0, rowspan: 2, rawCoords: [50, 80, 150, 140], text: 'Bölge' },
    { row: 1, col: 1, colspan: 2, rawCoords: [150, 80, 350, 110], text: 'Satış Rakamları (₺)' },
    { row: 1, col: 3, rowspan: 2, rawCoords: [350, 80, 450, 140], text: 'Durum' },
    { row: 2, col: 1, rawCoords: [150, 110, 250, 140], text: 'Ocak - Mart' },
    { row: 2, col: 2, rawCoords: [250, 110, 350, 140], text: 'Nisan - Haziran' },
    { row: 3, col: 0, rawCoords: [50, 140, 150, 180], text: 'Marmara' },
    { row: 3, col: 1, rawCoords: [150, 140, 250, 180], text: '500.000' },
    { row: 3, col: 2, rawCoords: [250, 140, 350, 180], text: '650.000' },
    { row: 3, col: 3, rawCoords: [350, 140, 450, 180], text: 'Başarılı' }
  ]
};

const res4 = TableClassifier.processTable(mergedTable, 1, 1, 4);
console.log('\n4. D_MERGED_CELLS Type:', res4.tableType);
assert.strictEqual(res4.tableType, 'D_MERGED_CELLS');
console.log('   Top Banner Text:', res4.items[0].text);
assert.strictEqual(res4.items[0].text, '2024 Yılı Yarıyıl Satış ve Hedef Gerçekleşme Raporu');

// 5. E_FORMULA (Formula Grid with math equation tokens)
const formulaTable = {
  id: 'table-5-formula',
  bbox: [50, 50, 400, 150],
  cells: [
    { row: 0, col: 0, rawCoords: [50, 50, 90, 80], text: 'Net Kar' },
    { row: 0, col: 1, rawCoords: [90, 50, 110, 80], text: '=' },
    { row: 0, col: 2, rawCoords: [110, 50, 160, 80], text: 'Brüt Kar' },
    { row: 0, col: 3, rawCoords: [160, 50, 180, 80], text: '-' },
    { row: 0, col: 4, rawCoords: [180, 50, 190, 80], text: '(' },
    { row: 0, col: 5, rawCoords: [190, 50, 290, 80], text: 'Operasyonel Giderler' },
    { row: 0, col: 6, rawCoords: [290, 50, 310, 80], text: '+' },
    { row: 0, col: 7, rawCoords: [310, 50, 370, 80], text: 'Vergiler' },
    { row: 0, col: 8, rawCoords: [370, 50, 390, 80], text: ')' },
    { row: 1, col: 0, rawCoords: [50, 80, 90, 110], text: '45.000' },
    { row: 1, col: 1, rawCoords: [90, 80, 110, 110], text: '=' },
    { row: 1, col: 2, rawCoords: [110, 80, 160, 110], text: '75.000' },
    { row: 1, col: 3, rawCoords: [160, 80, 180, 110], text: '-' },
    { row: 1, col: 4, rawCoords: [180, 80, 190, 110], text: '(' },
    { row: 1, col: 5, rawCoords: [190, 80, 290, 110], text: '20.000' },
    { row: 1, col: 6, rawCoords: [290, 80, 310, 110], text: '+' },
    { row: 1, col: 7, rawCoords: [310, 80, 370, 110], text: '10.000' },
    { row: 1, col: 8, rawCoords: [370, 80, 390, 110], text: ')' }
  ]
};

const res5 = TableClassifier.processTable(formulaTable, 1, 1, 5);
console.log('\n5. E_FORMULA Type:', res5.tableType);
assert.strictEqual(res5.tableType, 'E_FORMULA');
console.log('   Formula Item 1 Text:', res5.items[0].text);
assert.strictEqual(res5.items[0].table_order_id, 1);
assert.strictEqual(res5.items[0].text, 'Net Kar');

// 6. F_HYBRID_NOTE (Matrix Table with * Dipnot: explanation row)
const hybridTable = {
  id: 'table-6-hybrid',
  bbox: [50, 50, 450, 250],
  cells: [
    { row: 0, col: 0, rawCoords: [50, 50, 150, 80], text: 'Personel Unvanı' },
    { row: 0, col: 1, rawCoords: [150, 50, 300, 80], text: 'Günlük Yemek Ücreti' },
    { row: 0, col: 2, rawCoords: [300, 50, 450, 80], text: 'Yol Yardımı' },
    { row: 1, col: 0, rawCoords: [50, 80, 150, 110], text: 'Uzman' },
    { row: 1, col: 1, rawCoords: [150, 80, 300, 110], text: '180 ₺' },
    { row: 1, col: 2, rawCoords: [300, 80, 450, 110], text: 'Yok' },
    { row: 2, col: 0, rawCoords: [50, 110, 150, 140], text: 'Müdür' },
    { row: 2, col: 1, rawCoords: [150, 110, 300, 140], text: '250 ₺' },
    { row: 2, col: 2, rawCoords: [300, 110, 450, 140], text: 'Var (Araç Tahsisi)' },
    { row: 3, col: 0, colspan: 3, rawCoords: [50, 140, 450, 190], text: '* Dipnot: Yukarıda belirtilen yol yardımı ve yemek ücretleri 1 Ocak 2024 itibarıyla geçerli olan brüt tutarlardır. Vergi kesintileri uygulanacaktır.' }
  ]
};

const res6 = TableClassifier.processTable(hybridTable, 1, 1, 6);
console.log('\n6. F_HYBRID_NOTE Type:', res6.tableType);
assert.strictEqual(res6.tableType, 'F_HYBRID_NOTE');
const lastFootnoteItem = res6.items[res6.items.length - 1];
console.log('   Bottom footnote Text:', lastFootnoteItem.text);
console.log('   Footnote Table Order ID:', lastFootnoteItem.table_order_id, '| Global Sentence ID:', lastFootnoteItem.sentence_id);
assert.ok(lastFootnoteItem.text.includes('* Dipnot:'));

// 7. Test Raw JSON with 'category: Table' or 'type: table' (Extracts individual cells & assigns table_type)
console.log('\n7. Testing Raw JSON containing Category "Table":');
const rawJsonDoc = [
  { page: 1, category: 'TITLE', bbox: [50, 20, 500, 45], text: 'Finansal Tablo Raporu' },
  {
    page: 1,
    category: 'TABLE',
    bbox: [50, 50, 450, 200],
    text: "Şube Adı\t2023 Q1 Gelir\t2023 Q2 Gelir\nKadıköy\t120.000\t145.000\nBeşiktaş\t115.000\t125.000"
  },
  { page: 1, category: 'PARAGRAPH', bbox: [50, 220, 500, 250], text: 'Yukarıdaki tablo incelendiğinde büyüme görülmektedir.' }
];

const parsedDoc = BBoxParser.parse(rawJsonDoc);
console.log('   Parsed items count:', parsedDoc.length);
assert.strictEqual(parsedDoc.length, 11);
const tableCells = parsedDoc.filter(it => it.table_id || it.table_type || it.table_order_id);
console.log('   Extracted individual table cells:', tableCells.length);
assert.strictEqual(tableCells.length, 9);
console.log('   Assigned Table Type:', tableCells[0].table_type);
assert.strictEqual(tableCells[0].table_type, 'A_MATRIX');
console.log('   First Cell BBox:', tableCells[0].rawBox);
console.log('   First Cell Text:', tableCells[0].text);

console.log('\n=== ALL 7 TABLE CLASSIFICATION & DUAL READING ORDER TESTS PASSED PERFECTLY! ===');

