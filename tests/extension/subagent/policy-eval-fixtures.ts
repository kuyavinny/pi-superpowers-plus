import type { SubagentModelPolicy, SubagentAgentType, SubagentGrade } from "../../../extensions/subagent/model-policy";
import { validPolicyFixture } from "./model-policy-fixtures";

export interface PolicyEvalScenario {
  name: string;
  agentType: SubagentAgentType;
  suggestedGrade: SubagentGrade;
  finalGrade: SubagentGrade;
  unavailableModels?: string[];
}

export const baselinePolicyFixture: SubagentModelPolicy = validPolicyFixture;

export const evalScenarioFixture: PolicyEvalScenario[] = [
  {
    name: "implementer-standard",
    agentType: "implementer",
    suggestedGrade: "standard",
    finalGrade: "standard",
  },
  {
    name: "code-reviewer-heavy",
    agentType: "code-reviewer",
    suggestedGrade: "heavy",
    finalGrade: "heavy",
  },
  {
    name: "worker-light-fallback",
    agentType: "worker",
    suggestedGrade: "light",
    finalGrade: "light",
    unavailableModels: ["cheap-fast"],
  },
];
