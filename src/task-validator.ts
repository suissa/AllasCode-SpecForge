import type { GeneratedTask, Json, TaskFile } from "./types.ts";
import { InputValidationError } from "./validation.ts";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safePath(path: string): boolean {
  return !path.startsWith("/") && !path.split("/").includes("..") && path.length > 0;
}

export function validateTask(input: unknown): asserts input is GeneratedTask {
  const issues: string[] = [];
  if (!object(input)) throw new InputValidationError(["task must be an object"]);
  if (input.api_version !== "allas-specforge/v1") issues.push("task.api_version must be allas-specforge/v1");
  if (typeof input.id !== "string" || !input.id.startsWith("TASK-")) issues.push("task.id must start with TASK-");
  if (!object(input.source) || !object(input.source.blueprint)) issues.push("task.source.blueprint must be present");
  if (!object(input.functionality) || typeof input.functionality.canonical_label !== "string") issues.push("task.functionality.canonical_label must be present");
  if (!Array.isArray(input.files) || input.files.length === 0) issues.push("task.files must contain at least one file");
  else {
    const paths = new Set<string>();
    input.files.forEach((file, index) => {
      const path = `task.files[${index}]`;
      if (!object(file) || typeof file.path !== "string" || !safePath(file.path)) issues.push(`${path}.path must be a safe relative path`);
      else if (paths.has(file.path)) issues.push(`${path}.path must be unique`);
      else paths.add(file.path);
      if (!object(file) || file.operation !== "create") issues.push(`${path}.operation must be create`);
      if (!object(file) || !object(file.values)) issues.push(`${path}.values must be an object`);
    });
  }
  if (!Array.isArray(input.validations) || input.validations.length === 0) issues.push("task.validations must contain at least one validation");
  if (issues.length) throw new InputValidationError(issues);
}

export function valuesAsYaml(values: Record<string, Json>): string {
  return Object.entries(values).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n");
}

export function taskFileHeader(task: GeneratedTask, file: TaskFile): string {
  return `SpecForge task: ${task.id}\nSpecForge required values:\n${valuesAsYaml(file.values)}`;
}
