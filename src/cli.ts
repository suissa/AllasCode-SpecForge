#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { generateTasks } from "./generator.ts";
import { conformance, materializeTask } from "./materializer.ts";
import { renderTaskMarkdown } from "./renderer.ts";
import { validateTask } from "./task-validator.ts";
import type { Json, Plan, Specification } from "./types.ts";
import { validatePlan, validateSpecification } from "./validation.ts";
import { parseYaml, stringifyYaml } from "./yaml.ts";

async function readDocument(path: string): Promise<unknown> {
  const source = await readFile(path, "utf8");
  return [".yaml", ".yml"].includes(extname(path).toLowerCase()) ? parseYaml(source) : JSON.parse(source);
}

async function writeTask(output: string, task: ReturnType<typeof generateTasks>[number]): Promise<void> {
  const folder = join(output, task.id);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "task.json"), `${JSON.stringify(task, null, 2)}\n`);
  await writeFile(join(folder, "task.yml"), `${stringifyYaml(task as unknown as Json)}\n`);
  await writeFile(join(folder, "TASK.md"), renderTaskMarkdown(task));
}

function usage(): string {
  return `AllasCode SpecForge\n\nUsage:\n  allas-specforge validate <spec.(json|yml)> <plan.(json|yml)>\n  allas-specforge generate <spec.(json|yml)> <plan.(json|yml)> <output-directory>\n  allas-specforge verify <task.(json|yml)>\n  allas-specforge materialize <task.(json|yml)> <target-project-root>\n  allas-specforge conformance <task.(json|yml)> <target-project-root>\n`;
}

async function main(argv: string[]): Promise<void> {
  const [command, first, second, output] = argv;
  if (!command || command === "--help" || command === "-h") return void console.log(usage());
  if (command === "verify") {
    if (!first) throw new Error(usage());
    validateTask(await readDocument(first));
    return void console.log("Valid task contract.");
  }
  if (command === "materialize" || command === "conformance") {
    if (!first || !second) throw new Error(usage());
    const task = await readDocument(first);
    validateTask(task);
    if (command === "materialize") {
      await materializeTask(task, second);
      return void console.log(`Materialized ${task.files.length} declared file(s).`);
    }
    const errors = await conformance(task, second);
    if (errors.length) throw new Error(`Conformance failed:\n- ${errors.join("\n- ")}`);
    return void console.log("Conformance passed.");
  }
  if (!first || !second) throw new Error(usage());
  const specification = await readDocument(first);
  const plan = await readDocument(second);
  validateSpecification(specification);
  validatePlan(plan);
  const tasks = generateTasks(specification as Specification, plan as Plan);
  if (command === "validate") return void console.log(`Valid: ${tasks.length} deterministic task(s) can be generated.`);
  if (command !== "generate" || !output) throw new Error(usage());
  await Promise.all(tasks.map((task) => writeTask(output, task)));
  console.log(`Generated ${tasks.length} task(s) in ${output}.`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
