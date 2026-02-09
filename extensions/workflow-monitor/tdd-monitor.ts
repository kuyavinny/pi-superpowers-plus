import { isTestFile, isSourceFile } from "./heuristics";

export type TddPhase = "idle" | "red" | "green" | "refactor";

export interface TddViolation {
  type: "source-before-test";
  file: string;
}

export class TddMonitor {
  private phase: TddPhase = "idle";
  private testFilesWritten = new Set<string>();
  private sourceFilesWritten = new Set<string>();

  getPhase(): TddPhase {
    return this.phase;
  }

  onFileWritten(path: string): TddViolation | null {
    if (isTestFile(path)) {
      this.testFilesWritten.add(path);
      if (this.phase === "idle") {
        this.phase = "red";
      }
      return null;
    }

    if (isSourceFile(path)) {
      this.sourceFilesWritten.add(path);

      if (this.testFilesWritten.size === 0) {
        return { type: "source-before-test", file: path };
      }

      if (this.phase === "green") {
        this.phase = "refactor";
      }
      return null;
    }

    return null;
  }

  onTestResult(passed: boolean): void {
    if (passed && (this.phase === "red" || this.phase === "refactor")) {
      this.phase = "green";
    }
  }

  onCommit(): void {
    this.phase = "idle";
    this.testFilesWritten.clear();
    this.sourceFilesWritten.clear();
  }

  setState(phase: TddPhase, testFiles: string[], sourceFiles: string[]): void {
    this.phase = phase;
    this.testFilesWritten = new Set(testFiles);
    this.sourceFilesWritten = new Set(sourceFiles);
  }

  getState(): { phase: TddPhase; testFiles: string[]; sourceFiles: string[] } {
    return {
      phase: this.phase,
      testFiles: [...this.testFilesWritten],
      sourceFiles: [...this.sourceFilesWritten],
    };
  }
}
