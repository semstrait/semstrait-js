/**
 * semstrait - TypeScript types and utilities for semantic models
 *
 * This package provides TypeScript types for working with semstrait semantic
 * models. It is designed to be used alongside the semstrait Rust crate for
 * building analytics applications.
 *
 * @example
 * ```typescript
 * import type { Schema, Model, TableGroup, Measure } from 'semstrait';
 *
 * // Fetch schema from your API
 * const schema: Schema = await fetch('/api/schema').then(r => r.json());
 *
 * // Navigate the model structure
 * const model = schema.models[0];
 * const tableGroup = model.tableGroups[0];
 *
 * // Access measures from table groups
 * const revenue = tableGroup.measures.find(m => m.name === 'revenue');
 * console.log(revenue?.description);  // "Total revenue from completed orders"
 * console.log(revenue?.synonyms);     // ["sales", "total sales", "income"]
 *
 * // Access dimensions from table groups
 * const dateDim = tableGroup.dimensions.find(d => d.name === 'dates');
 * console.log(dateDim?.join?.leftKey); // "time_id"
 * ```
 *
 * @packageDocumentation
 *
 * @see {@link https://crates.io/crates/semstrait} - Rust crate
 * @see {@link https://github.com/semstrait/semstrait} - Main repository
 */

// Type definitions
export type {
  // Query
  QueryFilter,
  QueryRequest,

  // Primitives
  DataType,
  Aggregation,

  // Expressions
  LiteralValue,
  MeasureExpr,
  MeasureExprNode,
  ExprArg,
  CaseExpr,
  CaseWhen,
  ConditionExpr,
  MetricExpr,
  MetricExprNode,
  MetricExprArg,
  MetricCaseExpr,
  MetricCaseWhen,
  MetricCondition,
  MetricConditionArg,

  // Dimensions
  Attribute,
  Dimension,
  Join,
  TableGroupDimension,
  DimensionRef,  // Deprecated alias for TableGroupDimension
  AttributeRef,

  // Measures & Metrics
  MeasureFilter,
  Measure,
  Metric,

  // Table Groups
  TableGroup,
  GroupTable,
  Column,

  // Model & Schema
  DataFilter,
  Model,
  Schema,
} from './types';

// Utilities
export { 
  pivot,
  valueFormat,
  formatDate,
  formatTimestamp,
  RowData,
  RawDataRow 
} from './utils';
