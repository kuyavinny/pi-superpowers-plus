import * as fs from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function isTestPath(p: string): boolean {
  return (
    /(^|\/)tests?(\/|$)/.test(p) ||
    p.endsWith(".test.ts") ||
    p.endsWith(".spec.ts") ||
    p.endsWith(".test.js") ||
    p.endsWith(".spec.js")
  );
}

function isTestCommand(cmd: string): boolean {
  return (
    /\bvitest\b/.test(cmd) ||
    /\bpytest\b/.test(cmd) ||
    /\bnpm\s+test\b/.test(cmd) ||
    /\bpnpm\s+test\b/.test(cmd) ||
    /\byarn\s+test\b/.test(cmd)
  );
}

export default function (pi: ExtensionAPI) {
  let hasRunTests = false;
  let consecutiveBlockedWrites = 0;
  const violationsFile = process.env.PI_TDD_GUARD_VIOLATIONS_FILE;
  let violations = 0;

  function persist() {
    if (!violationsFile) return;
    try {
      fs.writeFileSync(violationsFile, String(violations), "utf-8");
    } catch {
      // ignore
    }
  }

  pi.on("tool_call", async (event) => {
    if (event.toolName === "bash") {
      const command = (event.input as any)?.command as string | undefined;
      if (command && isTestCommand(command)) {
        hasRunTests = true;
        consecutiveBlockedWrites = 0;
      }
      return;
    }

    if (event.toolName === "write" || event.toolName === "edit") {
      const p = ((event.input as any)?.path as string | undefined) ?? "";
      if (!p) return;

      if (!hasRunTests && !isTestPath(p)) {
        violations += 1;
        consecutiveBlockedWrites += 1;
        persist();

        if (consecutiveBlockedWrites >= 3) {
          process.exit(1);
        }

        return { blocked: true };
      }

      consecutiveBlockedWrites = 0;
    }
  });
}
