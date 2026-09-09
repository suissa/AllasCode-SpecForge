# AllasCode SpecForge

**AllasCode SpecForge** compiles a business specification plus a concrete architectural plan into deterministic implementation tasks for a pinned version of `AllasCode-Blueprint`.

It does not generate vague tickets. Every generated task is a functional vertical slice (an Intent) and contains:

- exact Blueprint-relative file paths;
- required semantic and architectural values for each file;
- the `Ok`/`Error` event contract;
- input, output and event schemas;
- implementation constraints derived from the plan;
- unit, integration, invariant and architecture-conformance checks;
- a plan fingerprint, preserving traceability when architecture changes.

## Why this exists

Spec-driven development normally stops at a human-readable `tasks.md`. In AllasCode, an implementation task must be a verifiable contract between the Specification, the selected architectural configuration and the Blueprint version that defines its folders, manifests and semantic rules.

```text
Specification (business behavior)
        +
Plan (typed architecture values)
        +
Pinned AllasCode Blueprint
        ↓
SpecForge compiler
        ↓
One task per Intent / functionality
        ↓
Exact files + values + validations
```

## Initial scope

Version `0.1.0` provides an executable, dependency-free TypeScript CLI using JSON or a safe YAML subset:

- validates a `spec.json` and `plan.json` before output;
- produces `task.json`, `task.yml` and a human-readable `TASK.md` for every Intent;
- binds tasks to `Blueprint`, `zig-0.16`, UbiQ, BadgerDB, Postgres, MongoDB and the test profile selected in the plan;
- requires stateful AtomicBehavior, explicit `Ok` and `Error` events, evidence, Human-in-the-Healing-Loop and exact-resume integration coverage.

It can materialize a task as a protected scaffold and then verify that every declared file and immutable structured value remains aligned with the task contract. Blueprint-template discovery and richer semantic validation are the next increments; they must consume the same generated task contract, not create a second task format.

## Quick start

Requires Node.js `>=22.18`.

```bash
npm test
node --experimental-strip-types src/cli.ts validate examples/commerce/spec.yml examples/commerce/plan.yml
node --experimental-strip-types src/cli.ts generate examples/commerce/spec.yml examples/commerce/plan.yml generated
node --experimental-strip-types src/cli.ts verify generated/TASK-commit-sale-sales-commit-sale/task.yml
node --experimental-strip-types src/cli.ts materialize generated/TASK-commit-sale-sales-commit-sale/task.yml target
node --experimental-strip-types src/cli.ts conformance generated/TASK-commit-sale-sales-commit-sale/task.yml target
```

The last command creates:

```text
generated/
└── TASK-commit-sale-sales-commit-sale/
    ├── task.json
    └── TASK.md
```

## Input contracts

`spec.yml` (or JSON) is deliberately business-facing. A feature can contain one or more Intent-based functionalities.

```json
{
  "version": "allas-spec/v1",
  "project": "commerce-lifecycle",
  "features": [{
    "id": "commit-sale",
    "title": "Commit a paid sale",
    "description": "Finalize a sale after payment and stock reservation.",
    "intents": [{
      "canonical_label": "Sales.CommitSale",
      "actor": "SalesAgent",
      "input": "CommittedSaleRequest",
      "output": "CommittedSale",
      "requires": ["Sales.ReserveStock.Ok", "Financial.ConfirmPayment.Ok"],
      "produces": ["Sales.CommitSale.Ok"],
      "invariants": ["stock.physical_quantity >= 0"]
    }]
  }]
}
```

`plan.yml` (or JSON) is architectural and is intentionally explicit. The compiler never asks an implementation agent to guess its runtime, stores, transports or quality gates.

```json
{
  "blueprint": {
    "source": "suissa/AllasCode-Blueprint",
    "version": "main",
    "root": "Blueprint"
  },
  "architecture": {
    "runtime": "zig-0.16",
    "messaging": "ubiq",
    "event_store": "badgerdb",
    "write_store": "postgresql",
    "read_store": "mongodb"
  },
  "quality": {
    "unit": "required",
    "integration": "required",
    "conformance": "required"
  }
}
```

## Generated task guarantees

For `Sales.CommitSale`, SpecForge declares all implementation files before an agent writes code:

| Contract | Example output |
| --- | --- |
| Intent | `Blueprint/intents/Sales.CommitSale.yml` |
| AtomicBehavior | `Blueprint/atomicbehavior/Sales.CommitSale/manifest.yml` |
| Schemas | `schema/input.yml`, `schema/output.yml`, `schema/events.yml` |
| Implementation | a Zig source file constrained to the configured runtime and stores |
| Tests | unit, integration and Blueprint conformance test files |

The task is accepted only if all declared files exist with the prescribed values, every required validation passes and no undeclared implementation file is introduced.

`materialize` creates the declared files without overwriting an existing file. Structured YAML contracts are verified byte-for-byte. Implementation and test files retain a generated contract header, so agents can add code below it while the task identity and mandatory values remain auditable.

## Development

```bash
npm test
npm run check
```

## Roadmap

1. Read a pinned Blueprint manifest/catalog instead of the current fixed v1 mapping.
2. Parse the actual Blueprint schemas and validate semantic values instead of only the current structural contract.
3. Add a pull-request task report and changed-file proof.
4. Add a Codex skill that only accepts a task after `task.yml` conformance.
