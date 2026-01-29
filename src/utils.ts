/**
 * Utility functions for working with semstrait query results.
 * 
 * @packageDocumentation
 */

import type { Schema, QueryRequest, Model, TableGroupDimension, Dimension, Attribute, AttributeRef } from './types';

export class RawDataRow {
  [key: string]: string | (null | number);
}

export class RowData {
  [key: string]: string | (number | null)[];
}

/**
 * Pivot query results into a tabular format.
 * 
 * @param data - Raw query result data
 * @param schema - Schema definition
 * @param modelName - Name of the model to pivot
 * @param query - Query request
 * @returns Pivoted data
 */
export function pivot(
  data: RawDataRow[],
  schema: Schema,
  modelName: string,
  query: QueryRequest
): RowData[] {
  
  const model = schema.models.find(m => m.name === modelName);
  if (!model) {
    throw new Error(`Model '${modelName}' not found in schema`);
  }
  // Dimensions are now under model, not at schema root
  const dimensions = model.dimensions || [];

  var resultMap: Map<string, RowData> = new Map();
  var columnArr: string[] = [];

  const rows = query.rows ?? [];
  const columns = query.columns ?? [];
  const metrics = query.metrics ?? [];

  data.map(row => {
    // Compute row key, csv of all row values
    const rowKey = rows.map(rowAttName => {
      // rowAttName = dates.year_id
      const attRef: AttributeRef = getAttributeRef(rowAttName, model)
      const attAlias: string = attributeAlias(dimensions, attRef);
      return `${attAlias}:${row[attAlias]}`
    }).join(',')

    // Get the pivoted row
    var resultRow = resultMap.get(rowKey);
    if(!resultRow) {
      // Not created yet, so create it
      resultRow = new RowData();
      resultMap.set(rowKey, resultRow);

      // Set the row attributes for the pivoted result row
      rows.map(rowAttName => {
        const attRef: AttributeRef = getAttributeRef(rowAttName, model)
        const attAlias: string = attributeAlias(dimensions, attRef);
        // Format based on attribute type (handles dates, timestamps, etc.)
        const attr = getAttribute(dimensions, attRef);
        resultRow![attAlias] = formatAttributeValue(row[attAlias], attr);
      })
    }

    if(columns.length == 0) {
      // Set all metrics for given pivot in a numbers array
      let metricsArr: (number | null)[] = resultRow["metrics"] as (number | null)[];
      if(!metricsArr) {
        metricsArr = [] as number[];
      }
      metrics.map(m => {
        const value = row[m] === null ? null : parseFloat(row[m].toString());
        metricsArr.push(value);
      })
      resultRow["metrics"] = metricsArr;      
    }
    // Set the column pivot values
    const columnKey = columns.map(colAttName => {
      const attRef: AttributeRef = getAttributeRef(colAttName, model)
      const attAlias: string = attributeAlias(dimensions, attRef)
      // Format based on attribute type (handles dates, timestamps, etc.)
      const attr = getAttribute(dimensions, attRef);
      const formattedValue = formatAttributeValue(row[attAlias], attr);
      return attAlias+":"+formattedValue;
    }).join("|")

    if(columns.length > 0) {
      // Set all metrics for given pivot in a numbers array
      let metricsArr: (number | null)[] = resultRow[columnKey] as (number | null)[];
      if(!metricsArr) {
        metricsArr = [] as number[];
      }
      metrics.map(m => {
        const value = row[m] ? parseFloat(row[m].toString()) : null;
        metricsArr.push(value);
      })
      resultRow[columnKey] = metricsArr;

      // Add it to the set of seen values so we can densify it
      columnArr.push(columnKey);
    }
  })
  
  // Make densify all rows
  const columnSet = columnArr.filter((v, i, a) => a.indexOf(v) === i).sort();
  var denseRows: RowData[] = []
  Array.from(resultMap.values()).map(row => { 
    var denseRow: RowData = new RowData();
    // Set the row attribute values (row labels)
    rows.map(rowAttName => {
      const attRef: AttributeRef = getAttributeRef(rowAttName, model)
      const attAlias: string = attributeAlias(dimensions, attRef)
      denseRow[attAlias] = row[attAlias]
    })
    // Set the column attribute values (metrics)
    if(columnSet.length == 0) {
      denseRow["metrics"] = row["metrics"];
    }
    columnSet.map(col => {
      if(row[col]) {
        denseRow[col] = row[col];
      } else {
        denseRow[col] = new Array(metrics.length).fill(null);
      }
    })
    denseRows.push(denseRow);
  })
  return denseRows;
}


function getAttributeRef(dimAtt: string, model: Model): AttributeRef {
  const [dimName, attName] = dimAtt.split('.');
  
  // Search all table groups for this dimension
  for (const tableGroup of model.tableGroups) {
    const dimRef = tableGroup.dimensions.find((d: TableGroupDimension) => d.name === dimName);
    if (dimRef) {
      return { dimension: dimRef, attribute: attName };
    }
  }
  
  throw new Error(`Dimension '${dimName}' not found in any table group`);
}

function attributeAlias(dimensions: Dimension[], attributeRef: AttributeRef): string {
  // Check for degenerate dimension (inline attributes on the dimension reference)
  if (attributeRef.dimension.attributes) {
    const attribute = attributeRef.dimension.attributes.find(a => a.name === attributeRef.attribute);
    if (attribute) {
      return `${attributeRef.dimension.name}.${attribute.name}`;
    }
  }
  
  // Fall back to top-level dimension lookup
  const dimension = dimensions.find(d => d.name === attributeRef.dimension.name);
  if (!dimension) {
    throw new Error(`Dimension '${attributeRef.dimension.name}' not found`);
  }
  const attribute = dimension.attributes.find(a => a.name === attributeRef.attribute);
  if (!attribute) {
    throw new Error(`Attribute '${attributeRef.attribute}' not found in dimension '${attributeRef.dimension.name}'`);
  }
  return `${dimension.alias ?? dimension.name}.${attribute.name}`;
}

/**
 * Look up the attribute definition and return the full Attribute object
 */
function getAttribute(dimensions: Dimension[], attributeRef: AttributeRef): Attribute | undefined {
  // Check for degenerate dimension (inline attributes on the dimension reference)
  if (attributeRef.dimension.attributes) {
    const attribute = attributeRef.dimension.attributes.find(a => a.name === attributeRef.attribute);
    if (attribute) {
      return attribute;
    }
  }
  
  // Fall back to top-level dimension lookup
  const dimension = dimensions.find(d => d.name === attributeRef.dimension.name);
  if (!dimension) {
    return undefined;
  }
  return dimension.attributes.find(a => a.name === attributeRef.attribute);
}

/**
 * Format a value based on its attribute type
 */
function formatAttributeValue(value: string | number | null, attribute: Attribute | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const attrType = attribute?.type?.toLowerCase();
  
  // Handle date types (Date32 = days since epoch)
  if (attrType === 'date') {
    const numValue = typeof value === 'number' ? value : parseInt(value.toString(), 10);
    if (!isNaN(numValue)) {
      return formatDate(numValue);
    }
  }
  
  // Handle timestamp types (microseconds since epoch)
  if (attrType === 'timestamp') {
    const numValue = typeof value === 'number' ? value : parseInt(value.toString(), 10);
    if (!isNaN(numValue)) {
      return formatTimestamp(numValue);
    }
  }
  
  // Default: convert to string
  return value.toString();
}

/**
 * Format a date value to yyyy-MM-dd format (UTC)
 * Auto-detects format: Date32 (days since epoch) vs milliseconds
 */
export function formatDate(value: number): string {
  let milliseconds: number;
  
  // Auto-detect: if value > 100000, it's likely milliseconds; otherwise days
  // 100000 days = year 2243, so any reasonable Date32 value is below this
  // Milliseconds for dates after ~1973 are > 100000000000
  if (value > 100000) {
    // Already in milliseconds
    milliseconds = value;
  } else {
    // Date32: days since Unix epoch (1970-01-01)
    milliseconds = value * 86400000; // 24 * 60 * 60 * 1000
  }
  
  const date = new Date(milliseconds);
  // Use UTC to avoid timezone shifts
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a timestamp value (microseconds since Unix epoch) to a localized date/time string
 */
export function formatTimestamp(value: number | bigint): string {
  // Timestamps in Arrow are typically microseconds since epoch
  const milliseconds = Number(value) / 1000;
  const date = new Date(milliseconds);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a value based on a format string
 * @param value - The value to format
 * @param format - The format string
 * @returns The formatted value
 */
export function valueFormat(value: number, format: string): string {
  const regex = (/([^0,.#]*)([0,.#]*)?([a-zA-Z%]*)/g);
  const groups = regex.exec(format);
  
  if (!groups) {
    return value.toString();
  }
  
  const prefix = groups[1] ?? '';
  const number = groups[2] ?? '';
  const suffix = groups[3] ?? '';

  const numDec = number.includes(".") ? number.split(".")[1].length : 0;

  const valueFormatted = value.toLocaleString('en-US', {minimumFractionDigits:numDec, maximumFractionDigits:numDec})

  return prefix + valueFormatted + suffix;
}