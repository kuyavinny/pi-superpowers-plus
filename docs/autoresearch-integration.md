# Autoresearch Integration

Autoresearch is a **specialized execution lane** for work that is best solved through repeated measurement:

- performance tuning
- runtime reduction
- build size reduction
- benchmarked workflow optimization
- other measurable keep/discard loops

It is **not** a replacement for the core `pi-superpowers-plus` workflow.

## Position in the Workflow

The canonical workflow remains:

```
Brainstorm → Plan → Execute → Verify → Review → Finish
```

Autoresearch fits inside that model as an execution choice when:

- the goal has a clear metric
- the metric can be measured repeatedly
- experimentation is more useful than one-pass implementation

In practice:

1. **Brainstorming** clarifies the goal and captures the measurable signals.
2. **Writing plans** records whether the selected execution mode is `standard` or `autoresearch`.
3. **Execution** either follows a normal task plan or hands off to an autoresearch lane.
4. **Verification / review / finish** still happen afterward.

## What Autoresearch Is Good For

Use autoresearch when the question is:

- "Which implementation variant is actually faster?"
- "Can we reduce this benchmark result without breaking checks?"
- "Which of these ideas survives measurement?"

Autoresearch is strongest when the work has:

- one or more explicit metrics
- a repeatable command
- correctness checks
- clear files in scope
- a willingness to discard losing ideas

## What Autoresearch Does Not Replace

Autoresearch does **not** decide:

- what the user really wants
- whether the architecture is conceptually right
- whether a product decision is good
- whether vague UX goals are satisfied

That still belongs to goal capture, brainstorming, planning, and human judgment.

## Minimal Goal Requirements for Autoresearch

Before entering autoresearch, the plan or design should make these explicit:

- **Objective**
- **Metric / direction**
- **Command to run**
- **Constraints**
- **Verification checks**
- **Files in scope**
- **Stop conditions**

If those are missing, the workflow should stay in brainstorming/planning until they are concrete enough.

## Recommended Mental Model

Think of autoresearch as a **goal-validation engine**:

- the universal goal template says what success means
- autoresearch tests measured variants against that goal
- only evidence-backed winners move forward

This keeps the workflow aligned with user intent while still allowing aggressive experimentation.
