/**
 * semstrait - TypeScript types and utilities for semantic models
 *
 * This package provides TypeScript types for working with semstrait semantic
 * models. It is designed to be used alongside the semstrait Rust crate for
 * building analytics applications.
 *
 * @example
 * ```typescript
 * import type { Schema, SemanticModel, DatasetGroup, Measure } from 'semstrait';
 *
 * // Fetch schema from your API
 * const schema: Schema = await fetch('/api/schema').then(r => r.json());
 *
 * // Navigate the semantic model structure
 * const model = schema.semantic_models[0];
 * const datasetGroup = model.datasetGroups[0];
 *
 * // Access measures from dataset groups
 * const revenue = datasetGroup.measures.find(m => m.name === 'revenue');
 * console.log(revenue?.description);  // "Total revenue from completed orders"
 * console.log(revenue?.synonyms);     // ["sales", "total sales", "income"]
 *
 * // Access dimensions from dataset groups
 * const dateDim = datasetGroup.dimensions.find(d => d.name === 'dates');
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
  DatasetGroupDimension,
  AttributeRef,

  // Measures & Metrics
  MeasureFilter,
  Measure,
  Metric,

  // Dataset Groups
  DatasetGroup,
  GroupDataset,
  Column,

  // SemanticModel & Schema
  DataFilter,
  SemanticModel,
  Schema,

  // Utility Types
  DimensionAttributeInfo,
} from './types';

// Utilities
export { 
  pivot,
  valueFormat,
  formatDate,
  formatTimestamp,
  RowData,
  RawDataRow,
  // Dimension path utilities
  parseDimensionPath,
  getDimensionLabel,
  isQualifiedPath,
  // Conformed dimension utilities
  isConformed,
  isConformedQuery,
  // Virtual dimension utilities
  isVirtualDimension,
  // Dimension attribute discovery
  getAllDimensionAttributes,
} from './utils';

// Types
export type { ParsedDimensionPath } from './utils';
