// Thin wrapper around the SheetJS (XLSX) UMD global loaded in index.html.
// Two jobs only: build a downloadable .xlsx template from a column spec, and
// parse an uploaded .xlsx/.xls/.csv file into plain row objects keyed by
// header. All validation and Supabase-specific logic lives in
// upload-config.js, not here, so this file stays reusable.

function xlsxLib() {
  if (!window.XLSX) throw new Error('The Excel library has not finished loading yet. Please wait a moment and try again.');
  return window.XLSX;
}

// Builds a two-sheet workbook: "Instructions" (read-only guidance) and
// "Data Entry" (the actual template, header row frozen, one example row
// clearly marked, sensible column widths).
export function downloadTemplate(spec) {
  const XLSX = xlsxLib();
  const wb = XLSX.utils.book_new();

  // --- Instructions sheet ---
  const instrRows = [
    [`${spec.label} — Upload Template`],
    [''],
    ['Purpose', spec.purpose],
    [''],
    ['How to use this file'],
    ['1. Fill in the "Data Entry" sheet — one row per record.'],
    ['2. Leave the header row (row 1) exactly as it is.'],
    ['3. Delete the example row before uploading, or leave it — the importer skips rows marked "EXAMPLE".'],
    ['4. Save the file and upload it using the Upload Excel button.'],
    [''],
    ['Columns'],
    ['Column', 'Required', 'Meaning', 'Accepted format / example'],
    ...spec.columns.map((c) => [c.header, c.required ? 'Yes' : 'No', c.note || '', String(c.example ?? '')]),
  ];
  if (spec.calcNote) { instrRows.push(['']); instrRows.push(['Calculation', spec.calcNote]); }
  if (spec.extraNotes) spec.extraNotes.forEach((n) => instrRows.push(['']) || instrRows.push([n]));
  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
  wsInstr['!cols'] = [{ wch: 22 }, { wch: 46 }, { wch: 40 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  // --- Data Entry sheet ---
  const header = spec.columns.map((c) => c.header);
  const rows = [header];
  if (spec.sampleRow) {
    rows.push(spec.columns.map((c) => spec.sampleRow[c.key] ?? ''));
  }
  const wsData = XLSX.utils.aoa_to_sheet(rows);
  wsData['!cols'] = spec.columns.map((c) => ({ wch: Math.max(14, c.header.length + 4) }));
  wsData['!freeze'] = { xSplit: 0, ySplit: 1 };
  wsData['!sheetView'] = [{ state: 'frozen', ySplit: 1 }];
  if (spec.sampleRow) {
    // Mark the sample row clearly as an example in a trailing note column.
    const noteColIdx = header.length;
    XLSX.utils.sheet_add_aoa(wsData, [['EXAMPLE — replace or delete this row']], { origin: { r: 1, c: noteColIdx } });
  }
  XLSX.utils.book_append_sheet(wb, wsData, 'Data Entry');

  XLSX.writeFile(wb, `${spec.fileBaseName}.xlsx`);
}

// Parses the first sheet of an uploaded file into an array of row objects
// keyed by the header text found in row 1. Blank rows are skipped. Rows
// whose only content flags them as the template's own example row are
// skipped too, so a Finance Manager who forgets to delete it doesn't get an
// error for it.
export async function parseUploadedFile(file) {
  const XLSX = xlsxLib();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.includes('Data Entry') ? 'Data Entry' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  return rows.filter((r) => {
    const values = Object.values(r).map((v) => String(v ?? '').trim());
    if (values.every((v) => v === '')) return false;
    if (values.some((v) => v.toUpperCase().includes('EXAMPLE'))) return false;
    return true;
  });
}
