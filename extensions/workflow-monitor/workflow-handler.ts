import { TddMonitor, type TddViolation } from "./tdd-monitor";
import { parseTestCommand, parseTestResult } from "./test-runner";

export interface ToolCallResult {
  violation: TddViolation | null;
}

export interface WorkflowHandler {
  handleToolCall(toolName: string, input: Record<string, any>): ToolCallResult;
  handleBashResult(command: string, output: string, exitCode: number | undefined): void;
  getTddPhase(): string;
  getWidgetText(): string;
  getTddState(): ReturnType<TddMonitor["getState"]>;
  restoreTddState(phase: any, testFiles: string[], sourceFiles: string[]): void;
}

export function createWorkflowHandler(): WorkflowHandler {
  const tdd = new TddMonitor();

  return {
    handleToolCall(toolName: string, input: Record<string, any>): ToolCallResult {
      if (toolName === "write" || toolName === "edit") {
        const path = input.path as string | undefined;
        if (path) {
          const violation = tdd.onFileWritten(path);
          return { violation };
        }
      }
      return { violation: null };
    },

    handleBashResult(command: string, output: string, exitCode: number | undefined): void {
      if (/\bgit\s+commit\b/.test(command)) {
        tdd.onCommit();
        return;
      }

      if (parseTestCommand(command)) {
        const passed = parseTestResult(output, exitCode);
        if (passed !== null) {
          tdd.onTestResult(passed);
        }
      }
    },

    getTddPhase(): string {
      return tdd.getPhase();
    },

    getWidgetText(): string {
      const phase = tdd.getPhase();
      if (phase === "idle") return "";
      return `TDD: ${phase.toUpperCase()}`;
    },

    getTddState() {
      return tdd.getState();
    },

    restoreTddState(phase: any, testFiles: string[], sourceFiles: string[]) {
      tdd.setState(phase, testFiles, sourceFiles);
    },
  };
}
