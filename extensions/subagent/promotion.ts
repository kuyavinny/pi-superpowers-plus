import type { CostTier, SubagentModelPolicy } from "./model-policy";
import { selectModelForInvocation } from "./model-selector";

interface PolicyEvalScenario {
  name: string;
  agentType: "implementer" | "code-reviewer" | "spec-reviewer" | "worker";
  suggestedGrade: "light" | "standard" | "heavy" | "deep";
  finalGrade: "light" | "standard" | "heavy" | "deep";
  unavailableModels?: string[];
}

interface PromotionProposal {
  kind: "reorder" | "threshold-change" | "model-reclassify";
  sameCapabilityBand?: boolean;
}

const COST_WEIGHTS: Record<CostTier, number> = {
  cheap: 1,
  moderate: 2,
  expensive: 3,
  premium: 4,
};

export function classifyPromotionRisk(proposal: PromotionProposal): "auto" | "review" {
  if (proposal.kind === "reorder" && proposal.sameCapabilityBand) return "auto";
  return "review";
}

export function evaluatePolicy(policy: SubagentModelPolicy, scenarios: PolicyEvalScenario[]) {
  const floorViolations: string[] = [];
  let weightedCostScore = 0;
  let fallbackCount = 0;

  const evaluatedScenarios = scenarios.map((scenario) => {
    const decision = selectModelForInvocation({
      policy,
      agentType: scenario.agentType,
      suggestedGrade: scenario.suggestedGrade,
      finalGrade: scenario.finalGrade,
      isModelAvailable: (modelId) => !new Set(scenario.unavailableModels ?? []).has(modelId),
    });

    if (decision.error || !decision.selectedModel) {
      floorViolations.push(`${scenario.name}: ${decision.error ?? "No selection"}`);
      return {
        name: scenario.name,
        selectedModel: undefined,
        costTier: undefined,
        fallbackUsed: false,
      };
    }

    weightedCostScore += COST_WEIGHTS[decision.selectedModel.costTier];
    if (decision.fallbackReason) fallbackCount += 1;

    return {
      name: scenario.name,
      selectedModel: decision.selectedModel.id,
      costTier: decision.selectedModel.costTier,
      fallbackUsed: Boolean(decision.fallbackReason),
    };
  });

  return {
    weightedCostScore,
    floorViolations,
    fallbackCount,
    scenarios: evaluatedScenarios,
  };
}
