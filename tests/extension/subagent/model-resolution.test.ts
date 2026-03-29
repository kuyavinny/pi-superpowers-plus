import { describe, expect, test } from "vitest";
import {
  KNOWN_PROVIDER_QUALIFIED_MODELS,
  parseListModelsOutput,
  qualifyModelReference,
} from "../../../extensions/subagent/model-resolution";

describe("model resolution", () => {
  test("leaves provider-qualified references unchanged", () => {
    expect(qualifyModelReference("google-gemini-cli/gemini-2.5-flash")).toBe(
      "google-gemini-cli/gemini-2.5-flash",
    );
    expect(qualifyModelReference("openai-codex/gpt-5.4:high")).toBe("openai-codex/gpt-5.4:high");
  });

  test("qualifies curated bundled model ids with known provider prefixes", () => {
    expect(qualifyModelReference("gpt-5-mini")).toBe(KNOWN_PROVIDER_QUALIFIED_MODELS["gpt-5-mini"]);
    expect(qualifyModelReference("claude-sonnet-4-5")).toBe(
      KNOWN_PROVIDER_QUALIFIED_MODELS["claude-sonnet-4-5"],
    );
  });

  test("qualifies exact bare model ids from curated provider mappings", () => {
    expect(qualifyModelReference("gemini-2.5-flash")).toBe(KNOWN_PROVIDER_QUALIFIED_MODELS["gemini-2.5-flash"]);
  });

  test("does not infer provider from available model listings for custom bare ids", () => {
    expect(() =>
      qualifyModelReference("custom-model", {
        availableModels: [{ provider: "project-provider", model: "custom-model" }],
      }),
    ).toThrow(/Unknown bare model reference/);
  });

  test("preserves thinking suffixes when qualifying bare model ids", () => {
    expect(qualifyModelReference("gemini-2.5-flash:high")).toBe("google-gemini-cli/gemini-2.5-flash:high");
  });

  test("throws for bare model ids that are not in the curated mapping", () => {
    expect(() =>
      qualifyModelReference("gpt-5.4", {
        availableModels: [
          { provider: "openai-codex", model: "gpt-5.4" },
          { provider: "other-provider", model: "gpt-5.4" },
        ],
      }),
    ).toThrow(/Unknown bare model reference/);
  });

  test("throws for unknown bare model ids instead of passing ambiguous references through", () => {
    expect(() => qualifyModelReference("mystery-model", { availableModels: [] })).toThrow(/Unknown bare model reference/);
  });

  test("parses pi --list-models output into provider/model pairs", () => {
    const parsed = parseListModelsOutput(`provider           model                   context\ngoogle-gemini-cli  gemini-2.5-flash        1.0M\nopenai-codex       gpt-5.4                 272K\n`);

    expect(parsed).toEqual([
      { provider: "google-gemini-cli", model: "gemini-2.5-flash" },
      { provider: "openai-codex", model: "gpt-5.4" },
    ]);
  });
});
