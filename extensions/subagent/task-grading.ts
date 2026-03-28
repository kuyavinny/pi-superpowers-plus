import type { SubagentGrade } from "./model-policy";

export interface TaskGradingInput {
  task: string;
}

export interface TaskGradeDecision {
  suggestedGrade: SubagentGrade;
  finalGrade: SubagentGrade;
}

const DEEP_PATTERNS = [
  /architecture/,
  /system-?wide/,
  /cross-?cutting/,
  /entire feature/,
  /full feature/,
  /end-to-end/,
  /broad context/,
  /high-consequence/,
];

const LIGHT_PATTERNS = [/single file/, /one file/, /minor/, /small/, /quick/, /typo/, /narrow/];

function countFileLikeMentions(text: string): number {
  const matches = text.match(/[\w./-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|kt|md|json|yml|yaml)/g);
  return matches?.length ?? 0;
}

export function suggestTaskGrade(input: TaskGradingInput): SubagentGrade {
  const normalized = input.task.trim().toLowerCase();
  const fileMentions = countFileLikeMentions(normalized);

  if (DEEP_PATTERNS.some((pattern) => pattern.test(normalized))) return "deep";
  if (normalized.length > 1200 || fileMentions >= 6) return "deep";
  if (fileMentions >= 3 || normalized.includes("multiple files") || normalized.includes("multi-file")) return "heavy";
  if (LIGHT_PATTERNS.some((pattern) => pattern.test(normalized))) return "light";
  const isImplementationTask = /\b(implement|build|refactor|fix|add)\b/.test(normalized);
  const mentionsTests = /\btests?\b/.test(normalized);
  if (!isImplementationTask && !mentionsTests && normalized.length < 160 && fileMentions <= 1) return "light";
  return "standard";
}

export function resolveTaskGrade(suggestedGrade: SubagentGrade, overrideGrade?: SubagentGrade): SubagentGrade {
  return overrideGrade ?? suggestedGrade;
}

export function decideTaskGrade(input: TaskGradingInput, overrideGrade?: SubagentGrade): TaskGradeDecision {
  const suggestedGrade = suggestTaskGrade(input);
  return {
    suggestedGrade,
    finalGrade: resolveTaskGrade(suggestedGrade, overrideGrade),
  };
}
