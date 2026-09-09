import type { Intent, Plan, Specification } from "./types.ts";

export class InputValidationError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid SpecForge input:\n- ${issues.join("\n- ")}`);
    this.issues = issues;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string, issues: string[]): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path} must be a non-empty string`);
    return false;
  }
  return true;
}

function validateIntent(intent: unknown, path: string, issues: string[]): intent is Intent {
  if (!isObject(intent)) {
    issues.push(`${path} must be an object`);
    return false;
  }
  const required = ["canonical_label", "actor", "input", "output"];
  required.forEach((key) => requiredString(intent[key], `${path}.${key}`, issues));
  if (typeof intent.canonical_label === "string" && !/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/.test(intent.canonical_label)) {
    issues.push(`${path}.canonical_label must use Agent.Intent notation`);
  }
  for (const key of ["requires", "produces", "invariants"]) {
    if (intent[key] !== undefined && (!Array.isArray(intent[key]) || intent[key].some((item) => typeof item !== "string"))) {
      issues.push(`${path}.${key} must be an array of strings when supplied`);
    }
  }
  return true;
}

export function validatePlan(input: unknown): asserts input is Plan {
  const issues: string[] = [];
  if (!isObject(input)) throw new InputValidationError(["plan must be an object"]);
  const blueprint = input.blueprint;
  const architecture = input.architecture;
  const quality = input.quality;
  if (!isObject(blueprint)) issues.push("plan.blueprint must be an object");
  else {
    requiredString(blueprint.source, "plan.blueprint.source", issues);
    requiredString(blueprint.version, "plan.blueprint.version", issues);
    if (blueprint.root !== undefined) requiredString(blueprint.root, "plan.blueprint.root", issues);
  }
  if (!isObject(architecture)) issues.push("plan.architecture must be an object");
  else for (const key of ["runtime", "messaging", "event_store", "write_store", "read_store"]) requiredString(architecture[key], `plan.architecture.${key}`, issues);
  if (!isObject(quality)) issues.push("plan.quality must be an object");
  else for (const key of ["unit", "integration", "conformance"]) {
    if (quality[key] !== "required" && quality[key] !== "optional") issues.push(`plan.quality.${key} must be required or optional`);
  }
  if (issues.length) throw new InputValidationError(issues);
}

export function validateSpecification(input: unknown): asserts input is Specification {
  const issues: string[] = [];
  if (!isObject(input)) throw new InputValidationError(["specification must be an object"]);
  if (input.version !== "allas-spec/v1") issues.push("specification.version must be allas-spec/v1");
  requiredString(input.project, "specification.project", issues);
  if (!Array.isArray(input.features) || input.features.length === 0) issues.push("specification.features must contain at least one feature");
  else {
    const seen = new Set<string>();
    input.features.forEach((feature, index) => {
      const path = `specification.features[${index}]`;
      if (!isObject(feature)) return void issues.push(`${path} must be an object`);
      requiredString(feature.id, `${path}.id`, issues);
      requiredString(feature.title, `${path}.title`, issues);
      requiredString(feature.description, `${path}.description`, issues);
      if (typeof feature.id === "string") {
        if (!/^[a-z][a-z0-9-]*$/.test(feature.id)) issues.push(`${path}.id must be kebab-case`);
        if (seen.has(feature.id)) issues.push(`${path}.id must be unique`);
        seen.add(feature.id);
      }
      if (!Array.isArray(feature.intents) || feature.intents.length === 0) issues.push(`${path}.intents must contain at least one Intent`);
      else feature.intents.forEach((intent, intentIndex) => validateIntent(intent, `${path}.intents[${intentIndex}]`, issues));
    });
  }
  if (issues.length) throw new InputValidationError(issues);
}
