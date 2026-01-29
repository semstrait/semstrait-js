/**
 * Arrow IPC parsing utilities.
 *
 * This module requires `apache-arrow` as a peer dependency.
 * Install it with: `npm install apache-arrow`
 *
 * @packageDocumentation
 */

import { tableFromIPC } from 'apache-arrow';
import type { RawDataRow } from './utils';

/**
 * Parse an Arrow IPC buffer into an array of row objects.
 *
 * @param buffer - ArrayBuffer containing Arrow IPC stream data
 * @returns Array of row objects with column names as keys
 *
 * @example
 * ```typescript
 * import { parseRows } from 'semstrait/arrow';
 *
 * const response = await fetch('/api/query/sales', {
 *   method: 'POST',
 *   body: JSON.stringify(request),
 *   credentials: 'include'
 * });
 *
 * const buffer = await response.arrayBuffer();
 * const rows = parseRows(buffer);
 * ```
 */
export function parseRows(buffer: ArrayBuffer): RawDataRow[] {
  if (buffer.byteLength === 0) {
    return [];
  }

  const table = tableFromIPC(buffer);
  const rows: RawDataRow[] = [];

  for (let i = 0; i < table.numRows; i++) {
    const row: RawDataRow = {};
    for (const field of table.schema.fields) {
      const column = table.getChild(field.name);
      if (column) {
        row[field.name] = column.get(i);
      }
    }
    rows.push(row);
  }

  return rows;
}
