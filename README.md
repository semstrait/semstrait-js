# semstrait

> TypeScript types for semstrait semantic models

## What is semstrait?

semstrait provides TypeScript types for working with semantic model definitions. It is the JavaScript/TypeScript companion to the [semstrait Rust crate](https://crates.io/crates/semstrait).

## Installation

```bash
npm install semstrait
```

## Usage

```typescript
import type { Schema, QueryRequest, QueryFilter } from 'semstrait';

// Fetch schema from your API (JSON matches these types)
const schema: Schema = await fetch('/api/schema').then(r => r.json());

// Access model, measures, dimensions with full type safety
const model = schema.models[0];
const revenue = model.measures.find(m => m.name === 'revenue');

// LLM-friendly metadata
console.log(revenue?.description);  // "Total revenue from completed orders"
console.log(revenue?.synonyms);     // ["sales", "total sales", "income"]

// Build a query request
const request: QueryRequest = {
  model: 'sales',
  dimensions: ['geography.country', 'dates.year'],
  measures: ['revenue', 'quantity'],
  filter: [
    { field: 'dates.year', operator: 'gte', value: 2023 },
    { field: 'geography.country', value: ['USA', 'UK'] }
  ]
};

// Send query to API
const result = await fetch('/api/query', {
  method: 'POST',
  body: JSON.stringify(request)
}).then(r => r.json());
```

## Features

- **TypeScript types** for semantic schemas and query requests
- **LLM-friendly metadata** — description, synonyms, examples
- **Pivot utility** for transforming query results into tables
- **Formatting utilities** — valueFormat, formatDate, formatTimestamp
- **Arrow parsing** (optional) — parse Arrow IPC responses

## Type Reference

### Query Types

| Type | Description |
|------|-------------|
| `QueryRequest` | Request body for analytics queries |
| `QueryFilter` | Filter condition (field, operator, value) |

### Schema Types

| Type | Description |
|------|-------------|
| `Schema` | Complete semantic schema (models + dimensions) |
| `Model` | Fact table with dimensions, measures, metrics |
| `Dimension` | Shared dimension definition with attributes |
| `DimensionRef` | Reference to dimension from a model |
| `Attribute` | Column within a dimension |
| `Measure` | Aggregated value (sum, count, etc.) |
| `Metric` | Derived calculation from measures |

## Pivot Utility

The `pivot` function transforms raw query results into a table-friendly format.

**Query request**

```javascript
{
  model: "sales",
  rows: ["geography.country"],
  columns: ["dates.year"],
  metrics: ["revenue"]
}
```

**Input: Raw query response**

```javascript
[
  { "geography.country": "USA", "dates.year": 2023, "revenue": 50000 },
  { "geography.country": "USA", "dates.year": 2024, "revenue": 62000 },
  { "geography.country": "UK",  "dates.year": 2023, "revenue": 30000 },
  { "geography.country": "UK",  "dates.year": 2024, "revenue": 35000 }
]
```

**Output: Pivoted data**

```javascript
[
  { "geography.country": "USA", "dates.year:2023": [50000], "dates.year:2024": [62000] },
  { "geography.country": "UK",  "dates.year:2023": [30000], "dates.year:2024": [35000] }
]
```

Row labels become keys, column values become dynamic keys with metrics as arrays.

## Arrow Module (Optional)

For parsing Arrow IPC responses, import from `semstrait/arrow`. This requires `apache-arrow` as a peer dependency:

```bash
npm install apache-arrow
```

```typescript
import { parseRows } from 'semstrait/arrow';
import type { QueryRequest } from 'semstrait';

const request: QueryRequest = {
  model: 'sales',
  rows: ['geography.country'],
  metrics: ['revenue']
};

// Application handles HTTP
const response = await fetch('/api/query/sales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
  credentials: 'include'
});

// semstrait parses Arrow to JSON
const buffer = await response.arrayBuffer();
const rows = parseRows(buffer);
```

The Arrow module is optional — if you don't import from `semstrait/arrow`, the `apache-arrow` dependency is not required.

## Status

🚧 **Early Development** — Core types and utilities implemented, API may change.

## Related

- [semstrait (Rust)](https://crates.io/crates/semstrait) — Compile semantic models to Substrait compute plans
- [GitHub Organization](https://github.com/semstrait)

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
