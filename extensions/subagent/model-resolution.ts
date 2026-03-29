export interface AvailableModel {
  provider: string;
  model: string;
}

export const KNOWN_PROVIDER_QUALIFIED_MODELS: Record<string, string> = {
  "claude-haiku-3-5": "anthropic/claude-haiku-3-5",
  "gemini-2.5-flash": "google-gemini-cli/gemini-2.5-flash",
  "claude-sonnet-4-5": "anthropic/claude-sonnet-4-5",
  "gpt-5-mini": "openai-codex/gpt-5-mini",
};

const THINKING_SUFFIX_PATTERN = /:(off|minimal|low|medium|high|xhigh)$/;

function splitThinkingSuffix(modelReference: string): { baseReference: string; suffix: string } {
  const match = modelReference.match(THINKING_SUFFIX_PATTERN);
  if (!match) return { baseReference: modelReference, suffix: "" };
  return {
    baseReference: modelReference.slice(0, -match[0].length),
    suffix: match[0],
  };
}

export function isProviderQualifiedModelReference(modelReference: string): boolean {
  return /^[^/\s]+\/[^\s]+$/.test(modelReference);
}

export function parseListModelsOutput(output: string): AvailableModel[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith("provider") && !/^[-=]+$/.test(line))
    .map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+/);
      if (!match) return undefined;
      return { provider: match[1], model: match[2] } satisfies AvailableModel;
    })
    .filter((entry): entry is AvailableModel => Boolean(entry));
}

export function qualifyModelReference(
  modelReference: string,
  options?: { availableModels?: AvailableModel[] },
): string {
  if (!modelReference) return modelReference;
  if (isProviderQualifiedModelReference(modelReference)) return modelReference;

  const { baseReference, suffix } = splitThinkingSuffix(modelReference);

  const curated = KNOWN_PROVIDER_QUALIFIED_MODELS[baseReference];
  if (curated) return `${curated}${suffix}`;

  void options;
  throw new Error(
    `Unknown bare model reference \"${modelReference}\". Specify provider explicitly as \"provider/${baseReference}${suffix}\".`,
  );
}
