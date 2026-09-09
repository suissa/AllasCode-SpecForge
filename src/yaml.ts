import type { Json } from "./types.ts";

interface Line {
  indent: number;
  text: string;
  number: number;
}

function scalar(value: string): Json {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed === "null" || trimmed === "~") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    if (trimmed.startsWith("\"")) return JSON.parse(trimmed) as Json;
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const body = trimmed.slice(1, -1).trim();
    return body === "" ? [] : body.split(",").map((item) => scalar(item));
  }
  return trimmed;
}

function linesFrom(input: string): Line[] {
  return input.split(/\r?\n/).flatMap((raw, index) => {
    const withoutComment = raw.replace(/\s+#.*$/, "").replace(/\t/g, "  ");
    if (withoutComment.trim() === "" || withoutComment.trim() === "---") return [];
    const indent = withoutComment.length - withoutComment.trimStart().length;
    return [{ indent, text: withoutComment.trim(), number: index + 1 }];
  });
}

/** A deliberate, safe YAML subset for SpecForge contracts: mappings, lists and scalars. */
export function parseYaml(input: string): Json {
  const lines = linesFrom(input);
  let index = 0;

  const block = (indent: number): Json => {
    if (index >= lines.length) return null;
    const first = lines[index]!;
    if (first.indent < indent) return null;
    const isList = first.text === "-" || first.text.startsWith("- ");
    const result: Json[] | Record<string, Json> = isList ? [] : {};
    while (index < lines.length) {
      const line = lines[index]!;
      if (line.indent < indent) break;
      if (line.indent > indent) throw new Error(`Unexpected indentation at YAML line ${line.number}`);
      if (isList) {
        if (!(line.text === "-" || line.text.startsWith("- "))) throw new Error(`Mixed mapping/list at YAML line ${line.number}`);
        const rest = line.text.slice(1).trim();
        index += 1;
        if (rest === "") {
          (result as Json[]).push(index < lines.length && lines[index]!.indent > indent ? block(lines[index]!.indent) : null);
          continue;
        }
        const mapping = /^([^:]+):(.*)$/.exec(rest);
        if (!mapping) {
          (result as Json[]).push(scalar(rest));
          continue;
        }
        const object: Record<string, Json> = { [mapping[1]!.trim()]: scalar(mapping[2]!.trim()) };
        if (mapping[2]!.trim() === "" && index < lines.length && lines[index]!.indent > indent) object[mapping[1]!.trim()] = block(lines[index]!.indent);
        while (index < lines.length && lines[index]!.indent > indent) {
          const child = lines[index]!;
          if (child.indent !== indent + 2) throw new Error(`Expected list mapping indentation at YAML line ${child.number}`);
          const pair = /^([^:]+):(.*)$/.exec(child.text);
          if (!pair) throw new Error(`Expected key:value at YAML line ${child.number}`);
          index += 1;
          const key = pair[1]!.trim();
          const value = pair[2]!.trim();
          object[key] = value === "" && index < lines.length && lines[index]!.indent > child.indent ? block(lines[index]!.indent) : scalar(value);
        }
        (result as Json[]).push(object);
      } else {
        if (line.text.startsWith("- ")) throw new Error(`Mixed mapping/list at YAML line ${line.number}`);
        const pair = /^([^:]+):(.*)$/.exec(line.text);
        if (!pair) throw new Error(`Expected key:value at YAML line ${line.number}`);
        index += 1;
        const key = pair[1]!.trim();
        const value = pair[2]!.trim();
        (result as Record<string, Json>)[key] = value === "" && index < lines.length && lines[index]!.indent > indent ? block(lines[index]!.indent) : scalar(value);
      }
    }
    return result;
  };

  if (lines.length === 0) throw new Error("YAML document is empty");
  return block(lines[0]!.indent);
}

function scalarYaml(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

export function stringifyYaml(value: Json, indent = 0): string {
  const prefix = " ".repeat(indent);
  if (Array.isArray(value)) return value.map((item) => {
    if (item !== null && typeof item === "object") return `${prefix}-\n${stringifyYaml(item, indent + 2)}`;
    return `${prefix}- ${scalarYaml(item)}`;
  }).join("\n");
  if (value !== null && typeof value === "object") return Object.entries(value).map(([key, item]) => {
    if (item !== null && typeof item === "object") return `${prefix}${key}:\n${stringifyYaml(item, indent + 2)}`;
    return `${prefix}${key}: ${scalarYaml(item)}`;
  }).join("\n");
  return `${prefix}${scalarYaml(value)}`;
}
