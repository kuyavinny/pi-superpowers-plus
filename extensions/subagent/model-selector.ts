import {
  compareCapabilityLevel,
  compareCostTier,
  compareSpeedLevel,
  resolveModelRequirements,
  SUBAGENT_AGENT_TYPES,
  type ModelProfile,
  type ModelRequirements,
  type SubagentAgentType,
  type SubagentGrade,
  type SubagentModelPolicy,
} from "./model-policy.js";

export interface ModelSelectionInput {
  policy: SubagentModelPolicy;
  agentType: SubagentAgentType;
  suggestedGrade: SubagentGrade;
  finalGrade: SubagentGrade;
  requestedModel?: string;
  isModelAvailable?: (modelId: string) => boolean;
}

export interface ModelSelectionDecision {
  agentType: SubagentAgentType;
  suggestedGrade: SubagentGrade;
  finalGrade: SubagentGrade;
  selectedModel?: ModelProfile;
  selectedModelId?: string;
  eligibleModels: ModelProfile[];
  requiredCapabilities: ModelRequirements;
  overrideUsed: boolean;
  fallbackReason?: string;
  selectionReason: string;
  error?: string;
}

export function getAgentTypeForAgentName(agentName: string): SubagentAgentType | undefined {
  return SUBAGENT_AGENT_TYPES.find((type) => type === agentName);
}

export function meetsModelRequirements(model: ModelProfile, requirements: ModelRequirements): boolean {
  if (requirements.reasoning && compareCapabilityLevel(model.reasoning, requirements.reasoning) < 0) return false;
  if (requirements.codingReliability && compareCapabilityLevel(model.codingReliability, requirements.codingReliability) < 0)
    return false;
  if (requirements.reviewDepth && compareCapabilityLevel(model.reviewDepth, requirements.reviewDepth) < 0) return false;
  if (requirements.speed && compareSpeedLevel(model.speed, requirements.speed) < 0) return false;
  return true;
}

export function rankEligibleModels(models: ModelProfile[]): ModelProfile[] {
  return [...models].sort((left, right) => {
    const costCompare = compareCostTier(left.costTier, right.costTier);
    if (costCompare !== 0) return costCompare;

    const speedCompare = compareSpeedLevel(right.speed, left.speed);
    if (speedCompare !== 0) return speedCompare;

    return left.id.localeCompare(right.id);
  });
}

export function selectModelForInvocation(input: ModelSelectionInput): ModelSelectionDecision {
  const requiredCapabilities = resolveModelRequirements(input.policy, input.agentType, input.finalGrade);
  const availabilityCheck = input.isModelAvailable ?? (() => true);

  if (input.requestedModel) {
    return {
      agentType: input.agentType,
      suggestedGrade: input.suggestedGrade,
      finalGrade: input.finalGrade,
      selectedModelId: input.requestedModel,
      eligibleModels: [],
      requiredCapabilities,
      overrideUsed: true,
      selectionReason: "requested model override",
    };
  }

  const eligibleModels = rankEligibleModels(
    input.policy.models.filter((model) => meetsModelRequirements(model, requiredCapabilities)),
  );

  for (let i = 0; i < eligibleModels.length; i++) {
    const model = eligibleModels[i];
    if (!availabilityCheck(model.id)) continue;

    const previousModel = eligibleModels.slice(0, i).find((candidate) => !availabilityCheck(candidate.id));
    return {
      agentType: input.agentType,
      suggestedGrade: input.suggestedGrade,
      finalGrade: input.finalGrade,
      selectedModel: model,
      selectedModelId: model.id,
      eligibleModels,
      requiredCapabilities,
      overrideUsed: false,
      fallbackReason: previousModel ? `${previousModel.id} unavailable` : undefined,
      selectionReason: previousModel
        ? `fallback to next eligible model after ${previousModel.id}`
        : "lowest-cost eligible available model",
    };
  }

  return {
    agentType: input.agentType,
    suggestedGrade: input.suggestedGrade,
    finalGrade: input.finalGrade,
    eligibleModels,
    requiredCapabilities,
    overrideUsed: false,
    selectionReason: "no eligible available model",
    error: `No eligible available model satisfies ${input.agentType}/${input.finalGrade}`,
  };
}

export function describeModelSelection(agentType: SubagentAgentType, decision: ModelSelectionDecision) {
  return {
    agentType,
    suggestedGrade: decision.suggestedGrade,
    finalGrade: decision.finalGrade,
    selectedModel: decision.selectedModelId,
    overrideUsed: decision.overrideUsed,
    fallbackReason: decision.fallbackReason,
    selectionReason: decision.selectionReason,
  };
}
