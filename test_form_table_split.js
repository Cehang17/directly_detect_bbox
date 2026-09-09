const assert = require('assert');

console.log('=== TESTING KEY-VALUE FORM TABLE CELL EXTRACTION ===\n');

// Mock table words from the user's screenshot
const tableWords = [
  // Row 0
  { word: 'Alan', bbox: [50, 50, 90, 70] },
  { word: 'Değer', bbox: [250, 50, 300, 70] },
  // Row 1
  { word: 'Adı', bbox: [50, 80, 75, 100] },
  { word: 'Soyadı', bbox: [80, 80, 130, 100] },
  { word: ':', bbox: [150, 80, 160, 100] },
  { word: 'Ahmet', bbox: [200, 80, 250, 100] },
  { word: 'Yılmaz', bbox: [255, 80, 310, 100] },
  // Row 2
  { word: 'TCKN', bbox: [50, 110, 95, 130] },
  { word: ':', bbox: [150, 110, 160, 130] },
  { word: '12345678901', bbox: [200, 110, 300, 130] },
  // Row 3
  { word: 'Doğum', bbox: [50, 140, 95, 160] },
  { word: 'Tarihi', bbox: [100, 140, 140, 160] },
  { word: ':', bbox: [150, 140, 160, 160] },
  { word: '15.08.1985', bbox: [200, 140, 280, 160] },
  // Row 4
  { word: 'Müşteri', bbox: [50, 170, 105, 190] },
  { word: 'No', bbox: [110, 170, 130, 190] },
  { word: ':', bbox: [150, 170, 160, 190] },
  { word: 'M-8899445', bbox: [200, 170, 280, 190] },
  // Row 5
  { word: 'Adres', bbox: [50, 200, 95, 220] },
  { word: ':', bbox: [150, 200, 160, 220] },
  { word: 'Atatürk', bbox: [200, 200, 250, 220] },
  { word: 'Mah.', bbox: [255, 200, 290, 220] },
  { word: 'Cumhuriyet', bbox: [295, 200, 370, 220] },
  { word: 'Cad.', bbox: [375, 200, 410, 220] },
  { word: 'No:10', bbox: [415, 200, 455, 220] },
  { word: 'İstanbul', bbox: [460, 200, 520, 220] }
];

function extractTableCellsRobust(tWords) {
  if (!tWords || tWords.length === 0) return [];

  // 1. Group words into horizontal lines (rows)
  const sortedByY = [...tWords].sort((a, b) => {
    const cyA = (a.bbox[1] + a.bbox[3]) / 2;
    const cyB = (b.bbox[1] + b.bbox[3]) / 2;
    return cyA - cyB;
  });

  const lines = [];
  sortedByY.forEach(w => {
    const [wx0, wy0, wx1, wy1] = w.bbox;
    const wcy = (wy0 + wy1) / 2;
    const match = lines.find(l => Math.abs(l.cy - wcy) < 10);
    if (match) {
      match.words.push(w);
      match.x0 = Math.min(match.x0, wx0);
      match.y0 = Math.min(match.y0, wy0);
      match.x1 = Math.max(match.x1, wx1);
      match.y1 = Math.max(match.y1, wy1);
      match.cy = (match.y0 + match.y1) / 2;
    } else {
      lines.push({
        x0: wx0, y0: wy0, x1: wx1, y1: wy1,
        cy: wcy,
        words: [w]
      });
    }
  });

  lines.sort((a, b) => a.y0 - b.y0);

  // 2. Discover global column cut planes from intra-line gaps
  const gapCuts = [];
  lines.forEach(l => {
    l.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
    for (let i = 0; i < l.words.length - 1; i++) {
      const wA = l.words[i];
      const wB = l.words[i + 1];
      const gap = wB.bbox[0] - wA.bbox[2];
      const tA = (wA.word || wA.text || '').trim();
      if (gap >= 22 || ((tA === ':' || tA.endsWith(':')) && gap >= 10)) {
        gapCuts.push((wA.bbox[2] + wB.bbox[0]) / 2);
      }
    }
  });

  // Cluster gap cut points
  gapCuts.sort((a, b) => a - b);
  const colSplits = [];
  gapCuts.forEach(gx => {
    const match = colSplits.find(cl => Math.abs(cl.center - gx) <= 25);
    if (match) {
      match.points.push(gx);
      match.center = match.points.reduce((a, b) => a + b, 0) / match.points.length;
    } else {
      colSplits.push({ center: gx, points: [gx] });
    }
  });
  const globalSplitX = colSplits.map(cl => cl.center).sort((a, b) => a - b);

  // 3. For each line, partition words into cells using gaps and global splits
  const allCells = [];
  lines.forEach((l, rIdx) => {
    l.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
    const rowCellWordGroups = [];
    let curGroup = [];

    for (let i = 0; i < l.words.length; i++) {
      const w = l.words[i];
      if (curGroup.length === 0) {
        curGroup.push(w);
        continue;
      }

      const prevW = curGroup[curGroup.length - 1];
      const gap = w.bbox[0] - prevW.bbox[2];
      const prevText = (prevW.word || prevW.text || '').trim();
      const currText = (w.word || w.text || '').trim();

      const crossesGlobalSplit = globalSplitX.some(sx => prevW.bbox[2] <= sx && w.bbox[0] >= sx);
      const isColonBoundary = (prevText === ':' || prevText.endsWith(':')) && gap >= 10;
      const isLargeGap = gap >= 22;

      // Attach standalone ':' to preceding label; do not isolate ':' as its own cell
      const isSplit = (currText !== ':') && (crossesGlobalSplit || isColonBoundary || isLargeGap);

      if (isSplit) {
        rowCellWordGroups.push(curGroup);
        curGroup = [w];
      } else {
        curGroup.push(w);
      }
    }
    if (curGroup.length > 0) {
      rowCellWordGroups.push(curGroup);
    }

    rowCellWordGroups.forEach((wGroup, cIdx) => {
      const cx0 = Math.min(...wGroup.map(w => w.bbox[0]));
      const cy0 = Math.min(...wGroup.map(w => w.bbox[1]));
      const cx1 = Math.max(...wGroup.map(w => w.bbox[2]));
      const cy1 = Math.max(...wGroup.map(w => w.bbox[3]));
      const text = wGroup.map(w => w.word || w.text || '').join(' ').trim();

      allCells.push({
        row: rIdx,
        col: cIdx,
        text: text,
        rawCoords: [cx0, cy0, cx1, cy1]
      });
    });
  });

  return allCells;
}

const cells = extractTableCellsRobust(tableWords);
console.log(`Extracted ${cells.length} cells from 6 rows:\n`);
cells.forEach((c, idx) => {
  console.log(`  [Cell ${idx + 1}] (R${c.row}, C${c.col}): "${c.text}" | Box: [${c.rawCoords.join(', ')}]`);
});

assert.strictEqual(cells.length, 12, 'Must extract exactly 12 cells (2 per row for 6 rows)');
assert.strictEqual(cells[0].text, 'Alan');
assert.strictEqual(cells[1].text, 'Değer');
assert.strictEqual(cells[2].text, 'Adı Soyadı :');
assert.strictEqual(cells[3].text, 'Ahmet Yılmaz');
assert.strictEqual(cells[4].text, 'TCKN :');
assert.strictEqual(cells[5].text, '12345678901');
assert.strictEqual(cells[6].text, 'Doğum Tarihi :');
assert.strictEqual(cells[7].text, '15.08.1985');
assert.strictEqual(cells[8].text, 'Müşteri No :');
assert.strictEqual(cells[9].text, 'M-8899445');
assert.strictEqual(cells[10].text, 'Adres :');
assert.strictEqual(cells[11].text, 'Atatürk Mah. Cumhuriyet Cad. No:10 İstanbul');

console.log('\n=== ALL 12 CELLS EXTRACTED PERFECTLY WITHOUT CROSS-COLUMN BLEED! ===\n');
