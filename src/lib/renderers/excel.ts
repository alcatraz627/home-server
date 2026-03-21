import type { DocumentRenderer, RenderResult, SheetData } from './index';
import * as XLSX from 'xlsx';

export const excelRenderer: DocumentRenderer = {
  name: 'excel',

  canRender(mime: string, filename: string): boolean {
    const ext = extOf(filename);
    return (
      ['.xlsx', '.xls', '.csv'].includes(ext) ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'text/csv'
    );
  },

  async render(data: ArrayBuffer): Promise<RenderResult> {
    const workbook = XLSX.read(data, { type: 'array' });

    const sheets: SheetData[] = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      if (raw.length === 0) {
        return { name, headers: [], rows: [] };
      }

      // First row as headers, rest as data
      const headers = raw[0].map(String);
      const rows = raw.slice(1).map((row) => headers.map((_, i) => String(row[i] ?? '')));

      return { name, headers, rows };
    });

    return { type: 'data', sheets };
  },
};

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}
