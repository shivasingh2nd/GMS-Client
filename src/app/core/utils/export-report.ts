export type ExportCell = string | number | null | undefined;

export interface ExportTable {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: ExportCell[][];
  filename: string;
}

function cellText(value: ExportCell): string {
  if (value == null) return '';
  return String(value);
}

function escapeCsv(value: ExportCell): string {
  const text = cellText(value).replace(/"/g, '""');
  return `"${text}"`;
}

export function downloadCsv(table: ExportTable): void {
  const lines = [
    table.headers.map(escapeCsv).join(','),
    ...table.rows.map((row) => row.map(escapeCsv).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = table.filename.endsWith('.csv') ? table.filename : `${table.filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadPdf(table: ExportTable): void {
  const headerHtml = table.headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('');
  const bodyHtml = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cellText(cell))}</td>`).join('')}</tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(table.title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #1a2a2a; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { margin: 0 0 16px; color: #5a6a6a; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #c5d0d0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eef5f5; font-weight: 600; }
    td.num, th.num { text-align: right; }
    @media print {
      body { margin: 12px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <button onclick="window.print()" style="margin-bottom:12px;padding:6px 12px;">Print / Save as PDF</button>
  <h1>${escapeHtml(table.title)}</h1>
  ${table.subtitle ? `<p>${escapeHtml(table.subtitle)}</p>` : ''}
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${bodyHtml || '<tr><td colspan="' + table.headers.length + '">No rows</td></tr>'}</tbody>
  </table>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
