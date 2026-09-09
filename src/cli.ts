#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateTasks } from "./generator.ts";
import { renderTaskMarkdown } from "./renderer.ts";
import type { Plan, Specification } from "./types.ts";
import { validatePlan, validateSpecification } from "./validation.ts";

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeTask(output: string, task: ReturnType<typeof generateTasks>[number]): Promise<void> {
  const folder = join(output, task.id);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "task.json"), `${JSON.stringify(task, null, 2)}\n`);
  await writeFile(join(folder, "TASK.md"), renderTaskMarkdown(task));
}

function usage(): string {
  return `AllasCode SpecForge\n\nUsage:\n  allas-specforge validate <spec.json> <plan.json>\n  allas-specforge generate <spec.json> <plan.json> <output-directory>\n`;
}

async function main(argv: string[]): Promise<void> {
  const [command, specPath, planPath, output] = argv;
  if (!command || command === "--help" || command === "-h") return void console.log(usage());
  if (!specPath || !planPath) throw new Error(usage());
  const specification = await readJson(specPath);
  const plan = await readJson(planPath);
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
