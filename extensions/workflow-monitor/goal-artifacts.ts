export const REQUIRED_GOAL_SECTIONS = [
  "Objective",
  "Why it matters",
  "Constraints",
  "Success signals",
  "Verification checks",
  "Scope / Off-limits",
  "Stop conditions",
] as const;

export type GoalExecutionMode = "standard" | "autoresearch" | null;

export interface ParsedGoalArtifact {
  missingSections: string[];
  executionMode: GoalExecutionMode;
}

export function parseGoalArtifact(markdown: string): ParsedGoalArtifact {
  const missingSections = REQUIRED_GOAL_SECTIONS.filter((section) => !hasGoalSection(markdown, section));

  return {
    missingSections: [...missingSections],
    executionMode: parseExecutionMode(markdown),
  };
}

function hasGoalSection(markdown: string, section: string): boolean {
  const escaped = escapeRegex(section);
  const patterns = [
    new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, "im"),
    new RegExp(`^-\\s+\\*\\*${escaped}:\\*\\*`, "im"),
    new RegExp(`^\\*\\*${escaped}:\\*\\*`, "im"),
  ];

  return patterns.some((pattern) => pattern.test(markdown));
}

function parseExecutionMode(markdown: string): GoalExecutionMode {
  const match = markdown.match(/^\*\*Execution Mode:\*\*\s*(standard|autoresearch)\s*$/im);
  return (match?.[1] as GoalExecutionMode) ?? null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
