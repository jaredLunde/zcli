export function* table(
  rows: string[][],
  options: {
    indent: number;
    cellPadding: number | number[];
  },
): Iterable<string> {
  const columnCount = rows[0].length;
  const columnWidths: number[] = new Array(columnCount);

  // Get the max width of each column
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Hot path for small tables
    if (columnCount <= 4) {
      columnWidths[0] = Math.max(columnWidths[0] ?? 0, row[0].length);
      columnWidths[1] = Math.max(columnWidths[1] ?? 0, row[1]?.length ?? 0);
      columnWidths[2] = Math.max(columnWidths[2] ?? 0, row[2]?.length ?? 0);
      columnWidths[3] = Math.max(columnWidths[3] ?? 0, row[3]?.length ?? 0);
    } else {
      for (let j = 0; j < columnCount; j++) {
        const column = row[j];
        const width = columnWidths[j] ?? 0;
        columnWidths[j] = Math.max(width, column.length);
      }
    }
  }

  const indent = " ".repeat(options.indent);

  // Write the rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let outputRow = "";

    for (let j = 0; j < columnCount; j++) {
      const column = row[j];
      const width = columnWidths[j];
      const cellPadding = Array.isArray(options.cellPadding)
        ? options.cellPadding[j]
        : options.cellPadding;

      const padding = j === row.length - 1
        ? ""
        : " ".repeat(width - column.length + (cellPadding ?? 0));
      outputRow += column + padding;
    }

    yield indent + outputRow;
  }
}
