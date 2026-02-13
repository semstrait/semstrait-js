/**
 * TypeScript type definitions for semstrait semantic models.
 * 
 * These types mirror the Rust `semantic_model/` types in the semstrait crate.
 * The JSON serialization from Rust (via serde) matches these interfaces.
 * 
 * @packageDocumentation
 */

// =============================================================================
// Query Request
// =============================================================================

/**
 * Filter for analytics queries.
 * 
 * Used in QueryRequest to filter results.
 */
export interface QueryFilter {
  /** Field to filter on (dimension.attribute format) */
  field: string;
  /** Operator: "eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in" (defaults to "in" for arrays, "eq" for single values) */
  operator?: string;
  /** Filter value - can be a single value or array */
  value: string | number | (string | number)[];
}

/**
 * Request body for analytics queries.
 * 
 * Send this to the query API to execute a semantic query.
 * Queries are expressed in terms of dimensions (for grouping) and metrics (for values).
 * Metrics are the public API - measures are internal implementation details.
 * 
 * @example
 * ```typescript
 * const request: QueryRequest = {
 *   model: 'sales',
 *   rows: ['geography.country', 'dates.year'],
 *   metrics: ['revenue', 'margin', 'avg_unit_price'],
 *   filter: [
 *     { field: 'dates.year', operator: 'gte', value: 2023 },
 *     { field: 'geography.country', value: ['USA', 'UK'] }
 *   ]
 * };
 * ```
 */
export interface QueryRequest {
  /** Model to query */
  model: string;
  /** Dimension attributes to include (dimension.attribute format) */
  dimensions?: string[];
  /** Row attributes for pivot tables */
  rows?: string[];
  /** Column attributes for pivot tables */
  columns?: string[];
  /** Metrics to compute - derived calculations from measures */
  metrics?: string[];
  /** Filters to apply */
  filter?: QueryFilter[];
}

// =============================================================================
// Primitives
// =============================================================================

/**
 * Data types supported by semstrait.
 * 
 * Maps to the `DataType` enum in Rust. Serialized as lowercase strings,
 * with decimal including precision and scale.
 */
export type DataType =
  | 'i8'
  | 'i16'
  | 'i32'
  | 'i64'
  | 'f32'
  | 'f64'
  | 'bool'
  | 'string'
  | 'date'
  | 'timestamp'
  | `decimal(${number}, ${number})`;

/**
 * Aggregation functions for measures.
 * 
 * Maps to the `Aggregation` enum in Rust.
 */
export type Aggregation =
  | 'sum'
  | 'avg'
  | 'count'
  | 'count_distinct'
  | 'min'
  | 'max';

// =============================================================================
// Expressions
// =============================================================================

/**
 * Literal value in an expression.
 */
export type LiteralValue = number | string | boolean;

/**
 * Expression node for measure calculations.
 * 
 * Can be a simple column reference (string) or a structured expression object.
 */
export type MeasureExpr = string | MeasureExprNode;

/**
 * Structured expression node.
 * 
 * Represents operations like add, subtract, multiply, divide, and case expressions.
 */
export interface MeasureExprNode {
  column?: string;
  literal?: LiteralValue;
  add?: ExprArg[];
  subtract?: ExprArg[];
  multiply?: ExprArg[];
  divide?: ExprArg[];
  case?: CaseExpr;
}

/**
 * Argument in an expression - can be a column name, literal, or nested node.
 */
export type ExprArg = string | number | MeasureExprNode;

/**
 * CASE WHEN expression.
 */
export interface CaseExpr {
  when: CaseWhen[];
  else?: ExprArg;
}

/**
 * A single WHEN...THEN branch in a CASE expression.
 */
export interface CaseWhen {
  condition: ConditionExpr;
  then: ExprArg;
}

/**
 * Condition expression for CASE WHEN and filters.
 */
export interface ConditionExpr {
  eq?: ExprArg[];
  ne?: ExprArg[];
  gt?: ExprArg[];
  gte?: ExprArg[];
  lt?: ExprArg[];
  lte?: ExprArg[];
  and?: ConditionExpr[];
  or?: ConditionExpr[];
  is_null?: string;
  is_not_null?: string;
}

/**
 * Metric expression - references measures by name.
 */
export type MetricExpr = string | MetricExprNode;

/**
 * Structured metric expression node.
 */
export interface MetricExprNode {
  measure?: string;
  literal?: number;
  add?: MetricExprArg[];
  subtract?: MetricExprArg[];
  multiply?: MetricExprArg[];
  divide?: MetricExprArg[];
  /** CASE WHEN expression - for cross-tableGroup metrics */
  case?: MetricCaseExpr;
}

/**
 * CASE WHEN expression for metrics.
 * Used for cross-tableGroup metrics that select different measures based on tableGroup.
 */
export interface MetricCaseExpr {
  /** List of WHEN...THEN branches */
  when: MetricCaseWhen[];
  /** Optional ELSE value (defaults to 0) */
  else?: MetricExprArg;
}

/**
 * A single WHEN...THEN branch in a metric CASE expression.
 */
export interface MetricCaseWhen {
  /** The condition to evaluate */
  condition: MetricCondition;
  /** The measure to use if condition is true */
  then: MetricExprArg;
}

/**
 * Condition expression for metric CASE WHEN.
 * Currently supports tableGroup.name comparisons for cross-tableGroup metrics.
 */
export interface MetricCondition {
  /** Equal: eq: [a, b] */
  eq?: MetricConditionArg[];
  /** Not equal: ne: [a, b] */
  ne?: MetricConditionArg[];
}

/**
 * Argument in a metric condition.
 * Can be a string (e.g., "tableGroup.name" or a table group name) or a number.
 */
export type MetricConditionArg = string | number;

/**
 * Argument in a metric expression.
 */
export type MetricExprArg = string | number | MetricExprNode;

// =============================================================================
// Dimensions
// =============================================================================

/**
 * An attribute (column) within a dimension.
 */
export interface Attribute {
  /** Attribute identifier */
  name: string;
  /** Physical column name (defaults to name if not specified) */
  column?: string;
  /** Display label for UIs */
  label?: string;
  /** Human-readable description for UIs and LLMs */
  description?: string;
  /** Sample values (helps LLMs understand valid inputs) */
  examples?: string[];
  /** Data type (defaults to string) */
  type?: DataType;
}

/**
 * Data source configuration for a table or dimension.
 */
export interface Source {
  /** Source type (currently only 'parquet' is supported) */
  type: 'parquet';
  /** Path to the data file (supports template variables) */
  path: string;
}

/**
 * Dimension definition with its physical table and attributes.
 * 
 * Defines a dimension table with its attributes. Referenced by table groups via TableGroupDimension.
 * Dimensions are defined at the model level and shared across table groups within that model.
 * 
 * Virtual dimensions (like `_table`) don't have physical tables - they provide
 * computed metadata values like tableGroup name, model name, etc.
 */
export interface Dimension {
  /** Dimension identifier */
  name: string;
  /** Data source configuration (parquet path, etc.) - not present for virtual dimensions */
  source?: Source;
  /** Physical table name (schema.table) - not present for virtual dimensions */
  table?: string;
  /** Table alias for SQL generation */
  alias?: string;
  /** Display label for UIs */
  label?: string;
  /** Human-readable description for UIs and LLMs */
  description?: string;
  /** Attributes (columns) in this dimension */
  attributes: Attribute[];
  /** Whether this is a virtual dimension (like _table metadata) */
  virtual?: boolean;
}

/**
 * Join specification between fact and dimension tables.
 */
export interface Join {
  /** Column on the fact table */
  leftKey: string;
  /** Column on the dimension table */
  rightKey: string;
  /** Optional alias for the joined table */
  rightAlias?: string;
}

/**
 * Dimension reference within a table group.
 * 
 * Can be either:
 * - Reference to a top-level dimension (has join)
 * - Degenerate dimension (no join, has inline attributes on fact table)
 */
export interface TableGroupDimension {
  /** Name of the dimension (must match top-level dimension if using join) */
  name: string;
  /** Display label for UIs */
  label?: string;
  /** Join specification - if absent, this is a degenerate dimension */
  join?: Join;
  /** Inline attributes for degenerate dimensions */
  attributes?: Attribute[];
}

/**
 * @deprecated Use TableGroupDimension instead. Kept for backward compatibility.
 */
export type DimensionRef = TableGroupDimension;

/**
 * Resolved reference to an attribute within a dimension.
 * 
 * Used by utility functions to work with dimension.attribute pairs.
 * Created by parsing strings like "dates.year" or "adwords.campaign.name" into structured references.
 */
export interface AttributeRef {
  /** The dimension reference (from tableGroup.dimensions) */
  dimension: TableGroupDimension;
  /** The attribute name */
  attribute: string;
  /** Optional tableGroup qualifier for three-part paths (e.g., "adwords" in "adwords.campaign.name") */
  tableGroupQualifier?: string;
}

// =============================================================================
// Measures & Metrics
// =============================================================================

/**
 * Filter that applies to a specific measure.
 */
export interface MeasureFilter {
  /** Field to filter on (dimension.attribute format) */
  field: string;
  /** User attribute for row-level security */
  userAttribute?: string;
}

/**
 * Measure definition - an aggregated value.
 */
export interface Measure {
  /** Measure identifier */
  name: string;
  /** Display label for UIs */
  label?: string;
  /** Human-readable description for UIs and LLMs */
  description?: string;
  /** Alternative names for LLM query understanding */
  synonyms?: string[];
  /** Hide from UI if true */
  hidden?: boolean;
  /** Display format (e.g., "$#,##0.00") */
  format?: string;
  /** Aggregation function */
  aggregation: Aggregation;
  /** Expression to aggregate (column name or structured expression) */
  expr: MeasureExpr;
  /** Result data type */
  type?: DataType;
  /** Row-level filters for this measure */
  dataFilter?: MeasureFilter[];
}

/**
 * Metric definition - a derived calculation from measures.
 */
export interface Metric {
  /** Metric identifier */
  name: string;
  /** Display label for UIs */
  label?: string;
  /** Human-readable description for UIs and LLMs */
  description?: string;
  /** Alternative names for LLM query understanding */
  synonyms?: string[];
  /** Hide from UI if true */
  hidden?: boolean;
  /** Display format */
  format?: string;
  /** Result data type (defaults to f64) */
  type?: DataType;
  /** Expression combining measures */
  expr: MetricExpr;
}

// =============================================================================
// Table Groups
// =============================================================================

/**
 * Column definition in a table.
 */
export interface Column {
  /** Column name */
  name: string;
  /** Data type */
  type: DataType;
}

/**
 * A table group - tables sharing dimension and measure definitions.
 * 
 * Enables aggregate awareness: multiple tables with different granularities
 * can share the same dimension and measure definitions.
 */
export interface TableGroup {
  /** Table group identifier */
  name: string;
  /** Dimensions available to tables in this group */
  dimensions: TableGroupDimension[];
  /** Measures shared by all tables in this group */
  measures: Measure[];
  /** Physical tables, each declaring which subset of fields it has */
  tables: GroupTable[];
}

/**
 * A physical table within a table group.
 * 
 * Each table declares which dimensions/attributes and measures it supports,
 * enabling automatic table selection (aggregate awareness).
 */
export interface GroupTable {
  /** Physical table name (e.g., "warehouse.orderfact") */
  table: string;
  /** Unique identifier for this table (e.g., Iceberg table UUID) */
  uuid?: string;
  /** Custom key-value properties (e.g., connectorType, sourceSystem) */
  properties?: Record<string, string>;
  /** Column definitions - optional, used for explicit schema documentation */
  columns?: Column[];
  /** 
   * Dimension attributes available on this table.
   * Map from dimension name to list of attribute names.
   */
  dimensions: Record<string, string[]>;
  /** Measure names available on this table (references group-level measures) */
  measures: string[];
  /** 
   * Row filter for partitioned tables.
   * e.g., { "dates.year": 2023 } means this table only contains 2023 data
   */
  rowFilter?: Record<string, unknown>;
}

// =============================================================================
// Model & Schema
// =============================================================================

/**
 * Data filter for row-level security.
 */
export interface DataFilter {
  /** Field to filter on */
  field: string;
  /** User attribute to match against */
  userAttribute?: string;
}

/**
 * Semantic model definition - the queryable business entity.
 * 
 * Contains one or more table groups that share dimension and measure definitions.
 * The selector picks the optimal table based on query requirements.
 * 
 * Model-level dimensions are queryable with 2-part paths (dimension.attribute)
 * across all tableGroups that reference them.
 */
export interface SemanticModel {
  /** Model identifier */
  name: string;
  /** Namespace for the model (e.g., organization or project identifier) */
  namespace?: string;
  /** Model-level dimensions - queryable with 2-part paths across all tableGroups */
  dimensions?: Dimension[];
  /** Table groups - each group contains tables that share field definitions */
  tableGroups: TableGroup[];
  /** Metric definitions - derived calculations from measures (model-level, shared across table groups) */
  metrics?: Metric[];
  /** Row-level security filters */
  dataFilter?: DataFilter[];
}

/**
 * Complete semantic schema.
 * 
 * Contains all semantic model definitions.
 */
export interface Schema {
  /** Semantic model definitions */
  semantic_models: SemanticModel[];
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Information about a dimension attribute for UI consumption.
 * 
 * Provides all the information a UI needs to display and use dimension attributes,
 * including whether to use a two-part key (conformed/virtual) or three-part key (qualified).
 * 
 * @example
 * ```typescript
 * const attrs = getAllDimensionAttributes(model);
 * 
 * // Filter to just conformed dimensions
 * const conformed = attrs.filter(a => a.isConformed);
 * 
 * // Filter to just a specific tableGroup
 * const adwords = attrs.filter(a => a.tableGroup === 'adwords');
 * 
 * // Use the key for queries
 * const request = { dimensions: [attrs[0].key], metrics: ['revenue'] };
 * ```
 */
export interface DimensionAttributeInfo {
  /** TableGroup name, or null for conformed/virtual dimensions */
  tableGroup: string | null;
  /** Dimension name */
  dimension: string;
  /** Attribute name */
  attribute: string;
  /** 
   * Query key to use in requests.
   * - Two-part for conformed/virtual: "dimension.attribute"
   * - Three-part for qualified: "tableGroup.dimension.attribute"
   */
  key: string;
  /** True if this key produces a cross-tableGroup UNION query */
  isConformed: boolean;
  /** True if this is a virtual dimension (like _table) */
  isVirtual: boolean;
}
