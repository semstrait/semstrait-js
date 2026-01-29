# CONTEXT.md

Context for AI coding assistants (Cursor, Claude Code, etc.) working on semstrait-js.

## Project Overview

TypeScript types and utilities for working with semstrait semantic models. It is the JavaScript/TypeScript companion to the [semstrait Rust crate](https://crates.io/crates/semstrait).

## Design Principles

- **No I/O** — This library is for parsing and transformation only. Applications handle HTTP, file I/O, and network concerns.
- **Pure functions** — Utilities like `pivot`, `parseRows`, and formatters are pure transformations with no side effects.
- **Optional dependencies** — Heavy dependencies (like `apache-arrow`) are in separate entry points so they're only bundled when used.

## Scope

semstrait-js handles:
- Type definitions (Schema, Model, TableGroup, QueryRequest, etc.)
- Data transformation (pivot, formatting)
- Arrow IPC parsing (optional module)

semstrait-js does NOT handle:
- HTTP requests or fetch calls
- Authentication
- Caching
- State management

## Architecture

```
Application → HTTP → semstrait (parsing/transform) → UI
```

semstrait sits between raw data and the UI. It doesn't fetch data — the application does.

## Key Types

The type system mirrors the Rust semstrait crate:

- **Schema** — Root container with models and dimension definitions
- **Model** — Queryable business entity with tableGroups and metrics
- **TableGroup** — Group of tables sharing dimension/measure definitions (aggregate awareness)
- **GroupTable** — Physical table declaring which subset of fields it has
- **TableGroupDimension** — Dimension reference within a table group (joined or degenerate)
- **Dimension** — Top-level dimension table definition
- **Measure** — Aggregated value with expression and aggregation function
- **Metric** — Derived calculation from measures (can span table groups)

## Package Structure

```
semstrait           # Core types and utilities (no heavy deps)
semstrait/arrow     # Arrow parsing (requires apache-arrow peer dep)
```

## Code Style

- TypeScript strict mode
- ESM modules
- Prefer `type` imports for type-only exports
- No runtime dependencies in core; optional peer dependencies for extras
