import { createHash } from "node:crypto";
import type { Feature, GeneratedTask, Intent, Plan, Specification, TaskFile, Validation } from "./types.ts";

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slug(value: string): string {
  return value.replaceAll(".", "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function filesFor(intent: Intent, plan: Plan): TaskFile[] {
  const behaviorDir = `atomicbehavior/${intent.canonical_label}`;
  const eventBase = intent.canonical_label;
  const outputEvents = intent.produces?.length ? intent.produces : [`${eventBase}.Ok`];
  const invariants = intent.invariants ?? [];
  const actionName = slug(intent.canonical_label);

  return [
    {
      operation: "create",
      kind: "intent",
      path: `intents/${intent.canonical_label}.yml`,
      values: {
        canonical_label: intent.canonical_label,
        actor: intent.actor,
        requires: intent.requires ?? [],
        produces: outputEvents,
        immutable: true
      }
    },
    {
      operation: "create",
      kind: "atomic_behavior_manifest",
      path: `${behaviorDir}/manifest.yml`,
      values: {
        api_version: "allascode/v1",
        kind: "AtomicBehavior",
        canonical_label: intent.canonical_label,
        behavior_type: "action",
        input: intent.input,
        output: intent.output,
        actor_enabled: true,
        state_mode: "stateful",
        event_store: plan.architecture.event_store,
        listen: intent.requires ?? [],
        emit: [...outputEvents, `${eventBase}.Error`],
        invariants,
        evidence_required: true,
        human_in_the_healing_loop: true
      }
    },
    {
      operation: "create",
      kind: "schema",
      path: `${behaviorDir}/schema/input.yml`,
      values: { semantic_type: intent.input, required: true }
    },
    {
      operation: "create",
      kind: "schema",
      path: `${behaviorDir}/schema/output.yml`,
      values: { semantic_type: intent.output, required: true }
    },
    {
      operation: "create",
      kind: "schema",
      path: `${behaviorDir}/schema/events.yml`,
      values: { ok: outputEvents, error: `${eventBase}.Error` }
    },
    {
      operation: "create",
      kind: "implementation",
      path: `${behaviorDir}/implementation/${actionName}.${plan.architecture.runtime.startsWith("zig") ? "zig" : "ts"}`,
      values: {
        runtime: plan.architecture.runtime,
        messaging: plan.architecture.messaging,
        write_store: plan.architecture.write_store,
        read_store: plan.architecture.read_store,
        must_emit: [...outputEvents, `${eventBase}.Error`],
        must_not_return_unclassified_error: true
      }
    },
    {
      operation: "create",
      kind: "test",
      path: `tests/unit/${actionName}.test.${plan.architecture.runtime.startsWith("zig") ? "zig" : "ts"}`,
      values: { verifies: ["input contract", "output contract", "Ok/Error event contract", ...invariants] }
    },
    {
      operation: "create",
      kind: "test",
      path: `tests/integration/${actionName}.test.${plan.architecture.runtime.startsWith("zig") ? "zig" : "ts"}`,
      values: { verifies: ["event persistence", "exact resume from pending action", "healing preserves immutable intent"] }
    },
    {
      operation: "create",
      kind: "test",
      path: `tests/conformance/${actionName}.conformance.${plan.architecture.runtime.startsWith("zig") ? "zig" : "ts"}`,
      values: { verifies: ["Blueprint manifest conformance", "declared effects only", "no undeclared files"] }
    }
  ];
}

function validationsFor(intent: Intent, plan: Plan): Validation[] {
  const actionName = slug(intent.canonical_label);
  const validation: Validation[] = [
    {
      id: "schema-contract",
      kind: "schema",
      required: true,
      command: `allas-specforge verify task ${actionName}`,
      expected: "Intent, AtomicBehavior manifest and declared schemas are structurally valid.",
      trace: intent.canonical_label
    },
    {
      id: "architecture-conformance",
      kind: "conformance",
      required: true,
      command: `allas-specforge conformance ${actionName}`,
      expected: `Implementation uses ${plan.architecture.runtime}, ${plan.architecture.messaging}, and ${plan.architecture.event_store} as declared by the plan.`,
      trace: "plan.architecture"
    }
  ];
  for (const invariant of intent.invariants ?? []) validation.push({
    id: `invariant-${slug(invariant)}`,
    kind: "invariant",
    required: true,
    command: `test ${actionName} --invariant ${JSON.stringify(invariant)}`,
    expected: `Invariant holds: ${invariant}`,
    trace: `specification.invariants:${intent.canonical_label}`
  });
  for (const kind of ["unit", "integration", "conformance"] as const) {
    if (plan.quality[kind] === "required") validation.push({
      id: `${kind}-test`, kind: kind === "conformance" ? "conformance" : "test", required: true,
      command: `test ${kind} ${actionName}`,
      expected: `${kind} suite passes`,
      trace: `plan.quality.${kind}`
    });
  }
  return validation;
}

export function generateTasks(specification: Specification, plan: Plan): GeneratedTask[] {
  const root = plan.blueprint.root ?? "Blueprint";
  return specification.features.flatMap((feature: Feature) => feature.intents.map((intent: Intent) => ({
    api_version: "allas-specforge/v1" as const,
    id: `TASK-${feature.id}-${slug(intent.canonical_label)}`,
    feature: { id: feature.id, title: feature.title, description: feature.description },
    source: {
      specification_version: specification.version,
      blueprint: { source: plan.blueprint.source, version: plan.blueprint.version, root },
      plan_fingerprint: fingerprint(plan)
    },
    functionality: intent,
    architecture: plan.architecture,
    files: filesFor(intent, plan).map((file) => ({ ...file, path: `${root}/${file.path}` })),
    validations: validationsFor(intent, plan)
  })));
}
