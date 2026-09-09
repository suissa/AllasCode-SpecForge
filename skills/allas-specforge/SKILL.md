---
name: allas-specforge
description: Implement an AllasCode functionality from a SpecForge task contract, or validate the task and resulting Blueprint tree before delivery.
---

# AllasCode SpecForge

Use this skill when the requested functionality is governed by an AllasCode SpecForge `task.yml` or `task.json`. Do not use it for an unrelated bug fix or a trivial non-architectural edit.

## Contract first

Treat the task as the implementation boundary. Before modifying the target project:

1. Run `allas-specforge verify <task-file>`.
2. Read `functionality`, `architecture`, `files`, and `validations` from the task.
3. Confirm that the task's pinned Blueprint version is available to the target project.

Do not add implementation files outside `files` merely to make a solution convenient. If the task lacks a necessary file or conflicts with the target repository, stop and report the exact missing contract change; do not silently widen the task.

## Materialization

For a new functional slice, run:

```bash
allas-specforge materialize <task-file> <target-project-root>
```

It refuses to overwrite an existing file. Preserve the generated header in implementation and test files: it carries the task identity and the configuration values that must remain auditable.

Structured Intent, manifest and schema files are immutable task material. Change them only by generating a new task from a changed specification or plan.

## Implementation rules

- Implement the configured runtime, messaging, event store and persistence bindings from `architecture`; never substitute a local preference.
- Emit the declared `Ok` and `Error` events only. Classify failures and preserve the same Intent through healing.
- Keep evidence, Human-in-the-Healing-Loop and stateful exact-resume behavior required by the generated AtomicBehavior manifest.
- Write the unit, integration and conformance tests declared by the task before claiming completion.

## Completion

Run the task's required tests, then:

```bash
allas-specforge conformance <task-file> <target-project-root>
```

Completion requires both the target test suite and SpecForge conformance to pass. Report the task ID, the tests run, and the result. A failing invariant or conformance error is a blocker, not a warning.
