// Spreadsheet formula mitigation is applied before normal CSV quoting.
export function csvCell(value: string) {
  const safe = /^[\s\uFEFF\p{Cc}]*[=+@-]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function csvRows(rows: string[][]) {
  return (
    "\uFEFF" +
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
