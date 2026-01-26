export type CsvColumn<T> = {
  key: string;
  header: string;
  value: (row: T) => any;
};

function escapeCsvCell(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Quote if it contains comma, quote, or newline.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((r) => columns.map((c) => escapeCsvCell(c.value(r))).join(","));
  return [header, ...lines].join("\n");
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=\"${filename}\"`,
      "cache-control": "no-store",
    },
  });
}
