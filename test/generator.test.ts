import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateTasks } from "../src/generator.ts";
import { conformance, materializeTask } from "../src/materializer.ts";
import { validateTask } from "../src/task-validator.ts";
import { validatePlan, validateSpecification } from "../src/validation.ts";
import type { Plan, Specification } from "../src/types.ts";
import { parseYaml, stringifyYaml } from "../src/yaml.ts";

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

test("YAML contracts preserve a Specification and Plan", () => {
  const specYaml = `version: allas-spec/v1\nproject: commerce\nfeatures:\n  - id: commit-sale\n    title: Commit sale\n    description: Commit a sale.\n    intents:\n      - canonical_label: Sales.CommitSale\n        actor: SalesAgent\n        input: Request\n        output: Result\n`;
  const planYaml = `blueprint:\n  source: suissa/AllasCode-Blueprint\n  version: main\narchitecture:\n  runtime: zig-0.16\n  messaging: ubiq\n  event_store: badgerdb\n  write_store: postgresql\n  read_store: mongodb\nquality:\n  unit: required\n  integration: required\n  conformance: required\n`;
  const parsedSpecification = parseYaml(specYaml);
  const parsedPlan = parseYaml(planYaml);
  validateSpecification(parsedSpecification);
  validatePlan(parsedPlan);
  assert.equal(generateTasks(parsedSpecification, parsedPlan).length, 1);
  assert.match(stringifyYaml(parsedPlan), /runtime: "zig-0.16"/);
});

test("materialized task passes conformance and detects contract mutation", async () => {
  const [task] = generateTasks(specification, plan);
  validateTask(task);
  const root = await mkdtemp(join(tmpdir(), "allas-specforge-"));
  await materializeTask(task, root);
  assert.deepEqual(await conformance(task, root), []);
  const manifest = join(root, "Blueprint/atomicbehavior/Sales.CommitSale/manifest.yml");
  const changed = (await readFile(manifest, "utf8")).replace("event_store: \"badgerdb\"", "event_store: \"other\"");
  await writeFile(manifest, changed);
  assert.deepEqual(await conformance(task, root), ["Structured contract differs from task values: Blueprint/atomicbehavior/Sales.CommitSale/manifest.yml"]);
});
