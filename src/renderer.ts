import type { GeneratedTask } from "./types.ts";

export function renderTaskMarkdown(task: GeneratedTask): string {
  const files = task.files.map((file) => `- [ ] Create \`${file.path}\` — \`${file.kind}\`\n  - Required values: \`${JSON.stringify(file.values)}\``).join("\n");
  const validations = task.validations.map((validation) => `- [ ] **${validation.id}**: \`${validation.command}\`\n  - Expected: ${validation.expected}\n  - Trace: \`${validation.trace}\``).join("\n");
  return `# ${task.id}\n\n## Functional slice\n\n${task.feature.description}\n\n- Feature: \`${task.feature.id}\` — ${task.feature.title}\n- Intent: \`${task.functionality.canonical_label}\`\n- Actor: \`${task.functionality.actor}\`\n- Blueprint: \`${task.source.blueprint.source}@${task.source.blueprint.version}\`\n- Plan fingerprint: \`${task.source.plan_fingerprint}\`\n\n## Architecture binding\n\n\`\`\`json\n${JSON.stringify(task.architecture, null, 2)}\n\`\`\`\n\n## Exact file contract\n\n${files}\n\n## Mandatory validation\n\n${validations}\n\n## Completion rule\n\nThis task is complete only when every declared file exists with the required values, all validations pass, and no implementation file outside this contract is introduced.\n`;
}
