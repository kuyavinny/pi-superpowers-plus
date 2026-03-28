export const CAPABILITY_LEVELS = ["low", "medium", "high", "very_high"] as const;
export const SPEED_LEVELS = ["slow", "medium", "fast", "very_fast"] as const;
export const COST_TIERS = ["cheap", "moderate", "expensive", "premium"] as const;
export const SUBAGENT_GRADES = ["light", "standard", "heavy", "deep"] as const;
export const SUBAGENT_AGENT_TYPES = ["implementer", "code-reviewer", "spec-reviewer", "worker"] as const;

export type CapabilityLevel = (typeof CAPABILITY_LEVELS)[number];
export type SpeedLevel = (typeof SPEED_LEVELS)[number];
export type CostTier = (typeof COST_TIERS)[number];
export type SubagentGrade = (typeof SUBAGENT_GRADES)[number];
export type SubagentAgentType = (typeof SUBAGENT_AGENT_TYPES)[number];

export interface ModelProfile {
  id: string;
  reasoning: CapabilityLevel;
  codingReliability: CapabilityLevel;
  reviewDepth: CapabilityLevel;
  speed: SpeedLevel;
  costTier: CostTier;
}

export interface ModelRequirements {
  reasoning?: CapabilityLevel;
  codingReliability?: CapabilityLevel;
  reviewDepth?: CapabilityLevel;
  speed?: SpeedLevel;
}

export type AgentGradeOverlay = Record<SubagentGrade, ModelRequirements>;

export interface SubagentModelPolicy {
  models: ModelProfile[];
  overlays: Record<SubagentAgentType, AgentGradeOverlay>;
}

const ORDERED_VALUES = {
  capability: CAPABILITY_LEVELS,
  speed: SPEED_LEVELS,
  cost: COST_TIERS,
} as const;

function compareOrderedValue<T extends string>(orderedValues: readonly T[], left: T, right: T): number {
  return orderedValues.indexOf(left) - orderedValues.indexOf(right);
}

export function compareCapabilityLevel(left: CapabilityLevel, right: CapabilityLevel): number {
  return compareOrderedValue(ORDERED_VALUES.capability, left, right);
}

export function compareSpeedLevel(left: SpeedLevel, right: SpeedLevel): number {
  return compareOrderedValue(ORDERED_VALUES.speed, left, right);
}

export function compareCostTier(left: CostTier, right: CostTier): number {
  return compareOrderedValue(ORDERED_VALUES.cost, left, right);
}

export function resolveModelRequirements(
  policy: SubagentModelPolicy,
  agentType: SubagentAgentType,
  grade: SubagentGrade,
): ModelRequirements {
  return policy.overlays[agentType][grade];
}

function isOneOf<T extends string>(value: string | undefined, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function validateRequirements(errors: string[], path: string, requirements: ModelRequirements) {
  if (requirements.reasoning && !isOneOf(requirements.reasoning, CAPABILITY_LEVELS)) {
    errors.push(`${path}.reasoning must be one of: ${CAPABILITY_LEVELS.join(", ")}`);
  }
  if (requirements.codingReliability && !isOneOf(requirements.codingReliability, CAPABILITY_LEVELS)) {
    errors.push(`${path}.codingReliability must be one of: ${CAPABILITY_LEVELS.join(", ")}`);
  }
  if (requirements.reviewDepth && !isOneOf(requirements.reviewDepth, CAPABILITY_LEVELS)) {
    errors.push(`${path}.reviewDepth must be one of: ${CAPABILITY_LEVELS.join(", ")}`);
  }
  if (requirements.speed && !isOneOf(requirements.speed, SPEED_LEVELS)) {
    errors.push(`${path}.speed must be one of: ${SPEED_LEVELS.join(", ")}`);
  }
}

export function validateModelPolicy(policy: SubagentModelPolicy): string[] {
  const errors: string[] = [];

  policy.models.forEach((model, index) => {
    if (!isOneOf(model.reasoning, CAPABILITY_LEVELS)) {
      errors.push(`models[${index}].reasoning must be one of: ${CAPABILITY_LEVELS.join(", ")}`);
    }
    if (!isOneOf(model.codingReliability, CAPABILITY_LEVELS)) {
      errors.push(`models[${index}].codingReliability must be one of: ${CAPABILITY_LEVELS.join(", ")}`);
    }
    if (!isOneOf(model.reviewDepth, CAPABILITY_LEVELS)) {
      errors.push(`models[${index}].reviewDepth must be one of: ${CAPABILITY_LEVELS.join(", ")}`);
    }
    if (!isOneOf(model.speed, SPEED_LEVELS)) {
      errors.push(`models[${index}].speed must be one of: ${SPEED_LEVELS.join(", ")}`);
    }
    if (!isOneOf(model.costTier, COST_TIERS)) {
      errors.push(`models[${index}].costTier must be one of: ${COST_TIERS.join(", ")}`);
    }
  });

  SUBAGENT_AGENT_TYPES.forEach((agentType) => {
    SUBAGENT_GRADES.forEach((grade) => {
      validateRequirements(errors, `overlays.${agentType}.${grade}`, policy.overlays[agentType][grade]);
    });
  });

  return errors;
}

export const BUNDLED_SUBAGENT_MODEL_POLICY: SubagentModelPolicy = {
  models: [
    {
      id: "claude-haiku-3-5",
      reasoning: "medium",
      codingReliability: "medium",
      reviewDepth: "medium",
      speed: "very_fast",
      costTier: "cheap",
    },
    {
      id: "gemini-2.5-flash",
      reasoning: "high",
      codingReliability: "medium",
      reviewDepth: "high",
      speed: "very_fast",
      costTier: "cheap",
    },
    {
      id: "claude-sonnet-4-5",
      reasoning: "very_high",
      codingReliability: "very_high",
      reviewDepth: "very_high",
      speed: "fast",
      costTier: "expensive",
    },
    {
      id: "gpt-5-mini",
      reasoning: "high",
      codingReliability: "high",
      reviewDepth: "high",
      speed: "fast",
      costTier: "moderate",
    },
  ],
  overlays: {
    implementer: {
      light: { reasoning: "medium", codingReliability: "medium" },
      standard: { reasoning: "medium", codingReliability: "high" },
      heavy: { reasoning: "high", codingReliability: "high" },
      deep: { reasoning: "very_high", codingReliability: "very_high" },
    },
    worker: {
      light: { reasoning: "medium" },
      standard: { reasoning: "medium", codingReliability: "medium" },
      heavy: { reasoning: "high", codingReliability: "medium" },
      deep: { reasoning: "high", codingReliability: "high" },
    },
    "spec-reviewer": {
      light: { reasoning: "medium", reviewDepth: "medium" },
      standard: { reasoning: "high", reviewDepth: "high" },
      heavy: { reasoning: "high", reviewDepth: "high" },
      deep: { reasoning: "very_high", reviewDepth: "very_high" },
    },
    "code-reviewer": {
      light: { reasoning: "medium", reviewDepth: "medium" },
      standard: { reasoning: "high", reviewDepth: "high" },
      heavy: { reasoning: "high", reviewDepth: "very_high" },
      deep: { reasoning: "very_high", reviewDepth: "very_high" },
    },
  },
};
