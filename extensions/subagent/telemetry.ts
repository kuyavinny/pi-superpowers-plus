import * as fs from "node:fs";
import * as path from "node:path";
import type { SubagentGrade } from "./model-policy";

interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export interface TelemetryRecordInput {
  cwd: string;
  agent: string;
  task: string;
  suggestedGrade?: SubagentGrade;
  finalGrade?: SubagentGrade;
  selectedModel?: string;
  requestedModel?: string;
  fallbackReason?: string;
  selectionReason?: string;
  exitCode: number;
  durationMs: number;
  retries: number;
  reviewRejections: number;
  usage: UsageStats;
}

export interface TelemetryRecord {
  timestamp: string;
  cwd: string;
  agent: string;
  task: string;
  suggestedGrade?: SubagentGrade;
  finalGrade?: SubagentGrade;
  selectedModel?: string;
  requestedModel?: string;
  overrideUsed: boolean;
  fallbackReason?: string;
  selectionReason?: string;
  success: boolean;
  durationMs: number;
  retries: number;
  reviewRejections: number;
  usage: UsageStats;
}

export function getTelemetryFilePath(cwd: string): string {
  return path.join(cwd, ".pi", "subagent", "telemetry.jsonl");
}

export function buildTelemetryRecord(input: TelemetryRecordInput): TelemetryRecord {
  return {
    timestamp: new Date().toISOString(),
    cwd: input.cwd,
    agent: input.agent,
    task: input.task,
    suggestedGrade: input.suggestedGrade,
    finalGrade: input.finalGrade,
    selectedModel: input.selectedModel,
    requestedModel: input.requestedModel,
    overrideUsed: Boolean(input.requestedModel),
    fallbackReason: input.fallbackReason,
    selectionReason: input.selectionReason,
    success: input.exitCode === 0,
    durationMs: input.durationMs,
    retries: input.retries,
    reviewRejections: input.reviewRejections,
    usage: input.usage,
  };
}

export function appendTelemetryRecord(
  cwd: string,
  record: TelemetryRecord,
  append: (filePath: string, content: string) => void = (filePath, content) => fs.appendFileSync(filePath, content, "utf-8"),
): void {
  try {
    const filePath = getTelemetryFilePath(cwd);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    append(filePath, `${JSON.stringify(record)}\n`);
  } catch {
    // Best effort only. Telemetry must never block subagent execution.
  }
}
