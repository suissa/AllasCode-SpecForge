import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { GeneratedTask, TaskFile } from "./types.ts";
import { taskFileHeader, validateTask } from "./task-validator.ts";
import { stringifyYaml } from "./yaml.ts";

function targetPath(root: string, taskPath: string): string {
  const target = resolve(root, taskPath);
  if (relative(resolve(root), target).startsWith("..")) throw new Error(`Unsafe task path: ${taskPath}`);
  return target;
}

export function renderFile(task: GeneratedTask, file: TaskFile): string {
  if (["intent", "atomic_behavior_manifest", "schema"].includes(file.kind)) return `${stringifyYaml(file.values)}\n`;
  const prefix = file.path.endsWith(".zig") ? "//" : "//";
  return `${prefix} ${taskFileHeader(task, file).replaceAll("\n", `\n${prefix} `)}\n\n${prefix} TODO: implement ${file.kind} for ${task.functionality.canonical_label}.\n`;
}

export async function materializeTask(task: GeneratedTask, root: string): Promise<void> {
  validateTask(task);
  for (const file of task.files) {
    const destination = targetPath(root, file.path);
    try {
      await access(destination, constants.F_OK);
      throw new Error(`Refusing to overwrite existing file: ${file.path}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, renderFile(task, file), "utf8");
  }
}

export async function conformance(task: GeneratedTask, root: string): Promise<string[]> {
  validateTask(task);
  const errors: string[] = [];
  for (const file of task.files) {
    const destination = targetPath(root, file.path);
    let actual: string;
    try {
      actual = await readFile(destination, "utf8");
    } catch {
      errors.push(`Missing required file: ${file.path}`);
      continue;
    }
    if (file.kind === "implementation" || file.kind === "test") {
      const expectedHeader = renderFile(task, file).split("\n\n")[0]!;
      if (!actual.startsWith(expectedHeader)) errors.push(`Missing or altered contract header: ${file.path}`);
    } else {
      const expected = renderFile(task, file).trim();
      if (actual.trim() !== expected) errors.push(`Structured contract differs from task values: ${file.path}`);
    }
  }
  const declared = new Set(task.files.map((file) => file.path));
  const manifest = task.files.find((file) => file.kind === "atomic_behavior_manifest");
  if (manifest) {
    const behaviorDirectory = manifest.path.slice(0, manifest.path.lastIndexOf("/"));
    const directory = targetPath(root, behaviorDirectory);
    const walk = async (current: string): Promise<string[]> => {
      let entries: Awaited<ReturnType<typeof readdir>>;
      try {
        entries = await readdir(current, { withFileTypes: true });
      } catch {
        return [];
      }
      const children = await Promise.all(entries.map(async (entry) => {
        const next = join(current, entry.name);
        return entry.isDirectory() ? walk(next) : [next];
      }));
      return children.flat();
    };
    for (const found of await walk(directory)) {
      const taskRelative = relative(resolve(root), found).replaceAll("\\", "/");
      if (!declared.has(taskRelative)) errors.push(`Undeclared file in AtomicBehavior boundary: ${taskRelative}`);
    }
  }
  return errors;
}
