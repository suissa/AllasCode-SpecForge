export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Plan {
  blueprint: {
    source: string;
    version: string;
    root?: string;
  };
  architecture: {
    runtime: string;
    messaging: string;
    event_store: string;
    write_store: string;
    read_store: string;
    crypto?: Record<string, string>;
  };
  quality: {
    unit: "required" | "optional";
    integration: "required" | "optional";
    conformance: "required" | "optional";
    property_tests?: "required" | "optional";
  };
}

export interface Specification {
  version: "allas-spec/v1";
  project: string;
  features: Feature[];
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  intents: Intent[];
}

export interface Intent {
  canonical_label: string;
  actor: string;
  input: string;
  output: string;
  requires?: string[];
  produces?: string[];
  invariants?: string[];
}

export interface TaskFile {
  operation: "create";
  path: string;
  kind: "intent" | "atomic_behavior_manifest" | "schema" | "implementation" | "test";
  values: Record<string, Json>;
}

export interface GeneratedTask {
  api_version: "allas-specforge/v1";
  id: string;
  feature: { id: string; title: string; description: string };
  source: {
    specification_version: string;
    blueprint: { source: string; version: string; root: string };
    plan_fingerprint: string;
  };
  functionality: Intent;
  architecture: Plan["architecture"];
  files: TaskFile[];
  validations: Validation[];
}

export interface Validation {
  id: string;
  kind: "schema" | "invariant" | "test" | "conformance";
  required: true;
  command: string;
  expected: string;
  trace: string;
}
