import assert from "node:assert/strict";
import test from "node:test";
import { generateTasks } from "../src/generator.ts";
import { validatePlan, validateSpecification } from "../src/validation.ts";
import type { Plan, Specification } from "../src/types.ts";

const plan: Plan = {
  blueprint: { source: "suissa/AllasCode-Blueprint", version: "main", root: "Blueprint" },
  architecture: { runtime: "zig-0.16", messaging: "ubiq", event_store: "badgerdb", write_store: "postgresql", read_store: "mongodb" },
  quality: { unit: "required", integration: "required", conformance: "required" }
};

const specification: Specification = {
  version: "allas-spec/v1",
  project: "commerce",
  features: [{
    id: "commit-sale",
    title: "Commit sale",
    description: "Commit a validated sale.",
    intents: [{
      canonical_label: "Sales.CommitSale",
      actor: "SalesAgent",
      input: "CommittedSaleRequest",
      output: "CommittedSale",
      requires: ["Financial.ConfirmPayment.Ok"],
      produces: ["Sales.CommitSale.Ok"],
      invariants: ["stock.physical_quantity >= 0"]
    }]
  }]
};

test("valid inputs generate one deterministic vertical-slice task", () => {
  validatePlan(plan);
  validateSpecification(specification);
  const [task] = generateTasks(specification, plan);
  assert.equal(task.id, "TASK-commit-sale-sales-commit-sale");
  assert.equal(task.files[0]?.path, "Blueprint/intents/Sales.CommitSale.yml");
  assert.equal(task.files.find((file) => file.kind === "implementation")?.path, "Blueprint/atomicbehavior/Sales.CommitSale/implementation/sales-commit-sale.zig");
  assert.deepEqual(task.files.find((file) => file.kind === "atomic_behavior_manifest")?.values.emit, ["Sales.CommitSale.Ok", "Sales.CommitSale.Error"]);
  assert.ok(task.validations.some((validation) => validation.id === "integration-test"));
  assert.ok(task.validations.some((validation) => validation.kind === "invariant"));
});

test("an incomplete plan is rejected before task generation", () => {
  assert.throws(() => validatePlan({ ...plan, architecture: { ...plan.architecture, runtime: "" } }), /runtime must be a non-empty string/);
});

test("an unqualified intent label is rejected", () => {
  const invalid = structuredClone(specification);
  invalid.features[0]!.intents[0]!.canonical_label = "CommitSale";
  assert.throws(() => validateSpecification(invalid), /Agent.Intent notation/);
});
