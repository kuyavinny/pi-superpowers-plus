/**
 * Workflow Monitor Extension
 *
 * Observes tool_call and tool_result events to track TDD phase (RED→GREEN→REFACTOR).
 * Injects warnings on TDD violations. Shows phase in TUI widget.
 * Registers workflow_reference tool for on-demand reference content.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import { createWorkflowHandler } from "./workflow-monitor/workflow-handler";
import { getTddViolationWarning } from "./workflow-monitor/warnings";
import { loadReference, REFERENCE_TOPICS } from "./workflow-monitor/reference-tool";

export default function (pi: ExtensionAPI) {
  const handler = createWorkflowHandler();

  // Track pending violation from tool_call to inject in tool_result
  let pendingViolation: { type: string; file: string } | null = null;

  // --- State reconstruction on session events ---
  for (const event of [
    "session_start",
    "session_switch",
    "session_fork",
    "session_tree",
  ] as const) {
    pi.on(event, async (_event, ctx) => {
      handler.restoreTddState("idle", [], []);
      updateWidget(ctx);
    });
  }

  // --- Tool call observation (detect file writes) ---
  pi.on("tool_call", async (event, _ctx) => {
    const result = handler.handleToolCall(event.toolName, event.input as Record<string, any>);
    pendingViolation = result.violation;
  });

  // --- Tool result modification (inject warnings) ---
  pi.on("tool_result", async (event, ctx) => {
    // Inject TDD violation warning
    if ((event.toolName === "write" || event.toolName === "edit") && pendingViolation) {
      const violation = pendingViolation;
      pendingViolation = null;
      const warning = getTddViolationWarning(violation.type, violation.file);
      const existingText = event.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      updateWidget(ctx);
      return {
        content: [{ type: "text", text: `${existingText}\n\n${warning}` }],
      };
    }
    pendingViolation = null;

    // Handle bash results (test runs, commits)
    if (event.toolName === "bash") {
      const command = (event.input as Record<string, any>).command as string ?? "";
      const output = event.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      const exitCode = (event.details as any)?.exitCode as number | undefined;
      handler.handleBashResult(command, output, exitCode);
    }

    updateWidget(ctx);
    return undefined;
  });

  // --- TUI Widget ---
  function updateWidget(ctx: ExtensionContext) {
    if (!ctx.hasUI) return;
    const text = handler.getWidgetText();
    if (!text) {
      ctx.ui.setWidget("workflow_monitor", undefined);
    } else {
      ctx.ui.setWidget("workflow_monitor", (_tui, theme) => {
        const phase = handler.getTddPhase().toUpperCase();
        const colorMap: Record<string, string> = {
          RED: "error",
          GREEN: "success",
          REFACTOR: "accent",
        };
        const color = colorMap[phase] ?? "muted";
        return new Text(theme.fg(color, `TDD: ${phase}`), 0, 0);
      });
    }
  }

  // --- Reference Tool ---
  pi.registerTool({
    name: "workflow_reference",
    label: "Workflow Reference",
    description: `Detailed guidance for workflow skills. Topics: ${REFERENCE_TOPICS.join(", ")}`,
    parameters: Type.Object({
      topic: StringEnum(REFERENCE_TOPICS as unknown as readonly [string, ...string[]], {
        description: "Reference topic to load",
      }),
    }),
    async execute(_toolCallId, params) {
      const content = await loadReference(params.topic);
      return {
        content: [{ type: "text", text: content }],
        details: { topic: params.topic },
      };
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("workflow_reference "));
      text += theme.fg("accent", args.topic);
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      const topic = (result.details as any)?.topic ?? "unknown";
      const content = result.content[0];
      const len = content?.type === "text" ? content.text.length : 0;
      return new Text(
        theme.fg("success", "✓ ") + theme.fg("muted", `${topic} (${len} chars)`),
        0,
        0
      );
    },
  });
}
