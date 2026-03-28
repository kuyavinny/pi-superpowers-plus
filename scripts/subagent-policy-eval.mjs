const capabilityOrder = ["low", "medium", "high", "very_high"];
const speedOrder = ["slow", "medium", "fast", "very_fast"];
const costWeights = { cheap: 1, moderate: 2, expensive: 3, premium: 4 };

const policy = {
  models: [
    {
      id: "cheap-fast",
      reasoning: "medium",
      codingReliability: "medium",
      reviewDepth: "medium",
      speed: "very_fast",
      costTier: "cheap",
    },
    {
      id: "balanced",
      reasoning: "high",
      codingReliability: "high",
      reviewDepth: "high",
      speed: "fast",
      costTier: "moderate",
    },
    {
      id: "deep-review",
      reasoning: "very_high",
      codingReliability: "high",
      reviewDepth: "very_high",
      speed: "medium",
      costTier: "expensive",
    },
  ],
  overlays: {
    implementer: {
      light: { codingReliability: "medium", reasoning: "medium" },
      standard: { codingReliability: "high", reasoning: "medium" },
      heavy: { codingReliability: "high", reasoning: "high" },
      deep: { codingReliability: "high", reasoning: "very_high" },
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

const scenarios = [
  { name: "implementer-standard", agentType: "implementer", finalGrade: "standard", unavailableModels: [] },
  { name: "code-reviewer-heavy", agentType: "code-reviewer", finalGrade: "heavy", unavailableModels: [] },
  {
    name: "worker-light-fallback",
    agentType: "worker",
    finalGrade: "light",
    unavailableModels: ["cheap-fast"],
  },
];

function compareOrdered(order, left, right) {
  return order.indexOf(left) - order.indexOf(right);
}

function meetsRequirements(model, requirements) {
  if (requirements.reasoning && compareOrdered(capabilityOrder, model.reasoning, requirements.reasoning) < 0) return false;
  if (
    requirements.codingReliability &&
    compareOrdered(capabilityOrder, model.codingReliability, requirements.codingReliability) < 0
  )
    return false;
  if (requirements.reviewDepth && compareOrdered(capabilityOrder, model.reviewDepth, requirements.reviewDepth) < 0)
    return false;
  if (requirements.speed && compareOrdered(speedOrder, model.speed, requirements.speed) < 0) return false;
  return true;
}

function rankModels(models) {
  return [...models].sort((left, right) => {
    const costCompare = costWeights[left.costTier] - costWeights[right.costTier];
    if (costCompare !== 0) return costCompare;

    const speedCompare = compareOrdered(speedOrder, right.speed, left.speed);
    if (speedCompare !== 0) return speedCompare;

    return left.id.localeCompare(right.id);
  });
}

function evaluateScenario(scenario) {
  const requirements = policy.overlays[scenario.agentType][scenario.finalGrade];
  const unavailable = new Set(scenario.unavailableModels ?? []);
  const eligible = rankModels(policy.models.filter((model) => meetsRequirements(model, requirements)));
  const selected = eligible.find((model) => !unavailable.has(model.id));

  if (!selected) {
    return {
      name: scenario.name,
      violation: `No eligible available model satisfies ${scenario.agentType}/${scenario.finalGrade}`,
    };
  }

  return {
    name: scenario.name,
    selectedModel: selected.id,
    costTier: selected.costTier,
    fallbackUsed: eligible[0]?.id !== selected.id,
  };
}

const results = scenarios.map(evaluateScenario);
const floorViolations = results.filter((result) => result.violation).map((result) => `${result.name}: ${result.violation}`);
const weightedCostScore = results.reduce((total, result) => total + (result.costTier ? costWeights[result.costTier] : 0), 0);
const fallbackCount = results.filter((result) => result.fallbackUsed).length;

console.log("Dynamic Subagent Model Policy Eval");
console.log(`Weighted cost score: ${weightedCostScore}`);
console.log(`Floor violations: ${floorViolations.length}`);
console.log(`Fallback count: ${fallbackCount}`);
for (const result of results) {
  if (result.violation) console.log(`- ${result.name}: ERROR ${result.violation}`);
  else console.log(`- ${result.name}: ${result.selectedModel} (${result.costTier})${result.fallbackUsed ? " [fallback]" : ""}`);
}

if (floorViolations.length > 0) {
  process.exitCode = 1;
}
