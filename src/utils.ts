/**
 * Utility functions for working with semstrait query results.
 * 
 * @packageDocumentation
 */

import type { Schema, QueryRequest, SemanticModel, TableGroupDimension, Dimension, Attribute, AttributeRef, DimensionAttributeInfo } from './types';

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
  
  const model = schema.semantic_models.find(m => m.name === modelName);
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


function getAttributeRef(dimAtt: string, model: SemanticModel): AttributeRef {
  const parts = dimAtt.split('.');
  
  // Handle three-part path: tableGroup.dimension.attribute
  if (parts.length === 3) {
    const [tgName, dimName, attName] = parts;
    
    // Find the specific tableGroup
    const tableGroup = model.tableGroups.find(tg => tg.name === tgName);
    if (!tableGroup) {
      throw new Error(`TableGroup '${tgName}' not found`);
    }
    
    // Find the dimension in that tableGroup
    const dimRef = tableGroup.dimensions.find((d: TableGroupDimension) => d.name === dimName);
    if (dimRef) {
      return { dimension: dimRef, attribute: attName, tableGroupQualifier: tgName };
    }
    
    throw new Error(`Dimension '${dimName}' not found in tableGroup '${tgName}'`);
  }
  
  // Handle two-part path: dimension.attribute
  if (parts.length === 2) {
    const [dimName, attName] = parts;
    
    // Search all table groups for this dimension
    for (const tableGroup of model.tableGroups) {
      const dimRef = tableGroup.dimensions.find((d: TableGroupDimension) => d.name === dimName);
      if (dimRef) {
        return { dimension: dimRef, attribute: attName };
      }
    }
    
    // Check model-level dimensions (for virtual dimensions like _table)
    const modelDim = model.dimensions?.find(d => d.name === dimName);
    if (modelDim) {
      // Convert model-level Dimension to TableGroupDimension-compatible object
      const dimRef: TableGroupDimension = {
        name: modelDim.name,
        label: modelDim.label,
        attributes: modelDim.attributes,
      };
      return { dimension: dimRef, attribute: attName };
    }
    
    throw new Error(`Dimension '${dimName}' not found in any table group`);
  }
  
  throw new Error(`Invalid attribute format '${dimAtt}', expected 'dimension.attribute' or 'tableGroup.dimension.attribute'`);
}

function attributeAlias(dimensions: Dimension[], attributeRef: AttributeRef): string {
  // Check for degenerate dimension (inline attributes on the dimension reference)
  if (attributeRef.dimension.attributes) {
    const attribute = attributeRef.dimension.attributes.find(a => a.name === attributeRef.attribute);
    if (attribute) {
      // Include tableGroup qualifier if present
      if (attributeRef.tableGroupQualifier) {
        return `${attributeRef.tableGroupQualifier}.${attributeRef.dimension.name}.${attribute.name}`;
      }
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
  
  // Include tableGroup qualifier if present
  const dimAlias = dimension.alias ?? dimension.name;
  if (attributeRef.tableGroupQualifier) {
    return `${attributeRef.tableGroupQualifier}.${dimAlias}.${attribute.name}`;
  }
  return `${dimAlias}.${attribute.name}`;
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

// =============================================================================
// Dimension Path Utilities
// =============================================================================

/**
 * Parsed dimension attribute path
 * 
 * Represents a structured view of dimension paths like:
 * - "dates.year" (two-part, unqualified)
 * - "adwords.dates.year" (three-part, tableGroup-qualified)
 */
export interface ParsedDimensionPath {
  /** Original path string */
  raw: string;
  /** TableGroup qualifier (only for three-part paths) */
  tableGroup?: string;
  /** Dimension name */
  dimension: string;
  /** Attribute name */
  attribute: string;
  /** True if this is a tableGroup-qualified path */
  isQualified: boolean;
}

/**
 * Parse a dimension.attribute path into structured components.
 * 
 * Handles both two-part and three-part formats:
 * - "dates.year" → { dimension: "dates", attribute: "year", isQualified: false }
 * - "adwords.dates.year" → { tableGroup: "adwords", dimension: "dates", attribute: "year", isQualified: true }
 * 
 * @param path - The dimension path string
 * @returns Parsed path components
 * @throws Error if path format is invalid
 * 
 * @example
 * ```typescript
 * const p = parseDimensionPath("dates.year");
 * // { raw: "dates.year", dimension: "dates", attribute: "year", isQualified: false }
 * 
 * const q = parseDimensionPath("adwords.campaign.name");
 * // { raw: "adwords.campaign.name", tableGroup: "adwords", dimension: "campaign", attribute: "name", isQualified: true }
 * ```
 */
export function parseDimensionPath(path: string): ParsedDimensionPath {
  const parts = path.split('.');
  
  if (parts.length === 3) {
    return {
      raw: path,
      tableGroup: parts[0],
      dimension: parts[1],
      attribute: parts[2],
      isQualified: true,
    };
  }
  
  if (parts.length === 2) {
    return {
      raw: path,
      dimension: parts[0],
      attribute: parts[1],
      isQualified: false,
    };
  }
  
  throw new Error(`Invalid dimension path '${path}', expected 'dimension.attribute' or 'tableGroup.dimension.attribute'`);
}

/**
 * Get a display label for a dimension path.
 * 
 * Formats the attribute name as a human-readable label, optionally including
 * the tableGroup qualifier for three-part paths.
 * 
 * @param path - The dimension path string
 * @param includeQualifier - Whether to include tableGroup in label (default: true)
 * @returns Human-readable label
 * 
 * @example
 * ```typescript
 * getDimensionLabel("dates.year");                    // "Year"
 * getDimensionLabel("adwords.campaign.name");         // "Name (adwords)"
 * getDimensionLabel("adwords.campaign.name", false);  // "Name"
 * ```
 */
export function getDimensionLabel(path: string, includeQualifier: boolean = true): string {
  const parsed = parseDimensionPath(path);
  const attrLabel = parsed.attribute
    .charAt(0).toUpperCase() + 
    parsed.attribute.slice(1).replace(/_/g, ' ');
  
  if (parsed.isQualified && includeQualifier) {
    return `${attrLabel} (${parsed.tableGroup})`;
  }
  return attrLabel;
}

/**
 * Check if a dimension path is tableGroup-qualified (three-part format).
 * 
 * @param path - The dimension path string
 * @returns true if path is three-part (tableGroup.dimension.attribute)
 */
export function isQualifiedPath(path: string): boolean {
  return path.split('.').length === 3;
}

// =============================================================================
// Conformed Dimension Utilities
// =============================================================================

/**
 * Check if a dimension is defined at model level (can be queried with 2-part path).
 * 
 * Model-level dimensions are queryable across all tableGroups that reference them.
 * The attrName parameter is kept for API compatibility but is not used in the check.
 * 
 * @param model - The model to check
 * @param dimName - The dimension name
 * @param _attrName - The attribute name (kept for API compatibility, not used)
 * @returns true if the dimension exists at model level
 * 
 * @example
 * ```typescript
 * isConformed(model, 'dates', 'year');    // true if dates is in model.dimensions
 * isConformed(model, 'campaign', 'id');   // true if campaign is in model.dimensions
 * isConformed(model, '_table', 'name');   // true (_table is model-level virtual)
 * ```
 */
export function isConformed(model: SemanticModel, dimName: string, _attrName: string): boolean {
  const modelDimensions = model.dimensions || [];
  return modelDimensions.some(d => d.name === dimName);
}

/**
 * Check if a dimension is virtual (like _table metadata).
 * 
 * @param model - The model to check
 * @param dimName - The dimension name
 * @returns true if the dimension is virtual
 */
export function isVirtualDimension(model: SemanticModel, dimName: string): boolean {
  const dimension = model.dimensions?.find(d => d.name === dimName);
  return dimension?.virtual === true;
}

/**
 * Check if all dimension.attribute pairs in a list can use the cross-tableGroup UNION path.
 * 
 * Returns true if all dimensions are either:
 * - Virtual dimensions (like `_table`) - implicitly work across tableGroups
 * - Model-level dimensions - defined at model.dimensions, queryable with 2-part paths
 * 
 * TableGroup-qualified dimensions (e.g., "adwords.campaign.name") are NOT conformed - 
 * they are explicitly scoped to a single tableGroup.
 * 
 * @param model - The model to check
 * @param dimensionAttrs - Array of dimension.attribute strings (e.g., ['dates.year', 'campaign.id'])
 * @returns true if all dimension attributes can use the cross-tableGroup path
 * 
 * @example
 * ```typescript
 * isConformedQuery(model, ['dates.year', '_table.tableGroup']);  // true if dates is model-level
 * isConformedQuery(model, ['dates.year', 'product.name']);       // false if product not model-level
 * isConformedQuery(model, ['_table.tableGroup']);                // true (virtual)
 * isConformedQuery(model, ['adwords.campaign.name']);            // false (tableGroup-qualified)
 * ```
 */
export function isConformedQuery(model: SemanticModel, dimensionAttrs: string[]): boolean {
  if (dimensionAttrs.length === 0) {
    return false;
  }
  
  return dimensionAttrs.every(dimAttr => {
    const parts = dimAttr.split('.');
    
    // Three-part path: tableGroup.dimension.attribute (qualified) - NOT conformed
    if (parts.length === 3) {
      return false;
    }
    
    // Two-part path: dimension.attribute
    if (parts.length !== 2) {
      return false;
    }
    
    const dimName = parts[0];
    // Check if dimension exists at model level (includes virtual dimensions)
    return isConformed(model, dimName, parts[1]);
  });
}

// =============================================================================
// Dimension Attribute Discovery
// =============================================================================

/**
 * Get all dimension attributes from a model with metadata for UI consumption.
 * 
 * Returns a flat list of all dimension attributes across all tableGroups, plus
 * entries for conformed and virtual dimensions with `tableGroup: null`.
 * 
 * Each entry includes:
 * - `tableGroup`: which tableGroup this is from, or null for conformed/virtual
 * - `dimension`: the dimension name
 * - `attribute`: the attribute name
 * - `key`: the query key to use (two-part or three-part)
 * - `isConformed`: whether this key produces a cross-tableGroup query
 * - `isVirtual`: whether this is a virtual dimension
 * 
 * @param model - The model to extract dimension attributes from
 * @returns Array of dimension attribute info objects
 * 
 * @example
 * ```typescript
 * const attrs = getAllDimensionAttributes(model);
 * 
 * // Show only conformed/virtual (for a simple dimension picker)
 * const simpleList = attrs.filter(a => a.tableGroup === null);
 * 
 * // Show all entries (for advanced users who want tableGroup-specific queries)
 * const fullList = attrs;
 * 
 * // Group by dimension for display
 * const byDimension = Object.groupBy(attrs, a => a.dimension);
 * ```
 */
export function getAllDimensionAttributes(model: SemanticModel): DimensionAttributeInfo[] {
  const results: DimensionAttributeInfo[] = [];
  const topLevelDimensions = model.dimensions || [];
  
  // Track which (dimension, attribute) pairs we've seen for conformed entries
  // Map from "dim.attr" -> { added: boolean, isVirtual: boolean }
  const conformedTracker = new Map<string, { added: boolean; isVirtual: boolean }>();
  
  // 1. Process each tableGroup's dimensions
  for (const tableGroup of model.tableGroups || []) {
    for (const dimRef of tableGroup.dimensions || []) {
      // Find top-level dimension definition (for attributes and virtual flag)
      const topLevelDim = topLevelDimensions.find(d => d.name === dimRef.name);
      
      // Get attributes: prefer dimRef.attributes, fallback to top-level
      const attributes = dimRef.attributes || topLevelDim?.attributes || [];
      const isVirtual = topLevelDim?.virtual === true;
      
      for (const attr of attributes) {
        // Handle both string attributes and Attribute objects
        const attrName = typeof attr === 'string' ? attr : attr.name;
        const attrIsConformed = isConformed(model, dimRef.name, attrName);
        const conformedKey = `${dimRef.name}.${attrName}`;
        
        // Virtual dimensions: only add once (with tableGroup: null)
        if (isVirtual) {
          if (!conformedTracker.has(conformedKey)) {
            conformedTracker.set(conformedKey, { added: true, isVirtual: true });
            results.push({
              tableGroup: null,
              dimension: dimRef.name,
              attribute: attrName,
              key: conformedKey,
              isConformed: true,  // virtual = implicitly conformed
              isVirtual: true,
            });
          }
          continue;
        }
        
        // Physical dimensions: always add tableGroup-specific entry
        results.push({
          tableGroup: tableGroup.name,
          dimension: dimRef.name,
          attribute: attrName,
          key: `${tableGroup.name}.${dimRef.name}.${attrName}`,
          isConformed: false,
          isVirtual: false,
        });
        
        // Track conformed attrs for later (if not already added)
        if (attrIsConformed && !conformedTracker.has(conformedKey)) {
          conformedTracker.set(conformedKey, { added: false, isVirtual: false });
        }
      }
    }
  }
  
  // 2. Process model-level virtual dimensions that aren't referenced in any tableGroup
  // (e.g., _table which is defined at model.dimensions but not in tableGroup.dimensions)
  for (const dim of topLevelDimensions) {
    if (dim.virtual === true) {
      for (const attr of dim.attributes || []) {
        const attrName = typeof attr === 'string' ? attr : attr.name;
        const conformedKey = `${dim.name}.${attrName}`;
        
        // Only add if not already added from tableGroup processing
        if (!conformedTracker.has(conformedKey)) {
          conformedTracker.set(conformedKey, { added: true, isVirtual: true });
          results.push({
            tableGroup: null,
            dimension: dim.name,
            attribute: attrName,
            key: conformedKey,
            isConformed: true,  // virtual = implicitly conformed
            isVirtual: true,
          });
        }
      }
    }
  }
  
  // 3. Add conformed dimension entries (tableGroup: null) that weren't already added
  for (const [key, tracker] of conformedTracker) {
    if (!tracker.added && !tracker.isVirtual) {
      const [dim, attr] = key.split('.');
      results.push({
        tableGroup: null,
        dimension: dim,
        attribute: attr,
        key,
        isConformed: true,
        isVirtual: false,
      });
    }
  }
  
  return results;
}