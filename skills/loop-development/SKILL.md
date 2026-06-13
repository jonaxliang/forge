---
name: loop-development
description: Use when developing product features, bug fixes, refactors, or code changes that need a closed engineering loop: clarify, shape, plan, implement, verify, review, fix, and record. Trigger whenever the user asks to build, fix, modify, implement, improve, or ship software, even if they do not mention "loop".
---

# Loop Development

Use this skill to turn software work into a closed engineering loop instead of a one-shot code edit.

The loop is:

```text
intake -> shape -> plan -> implement -> verify -> review -> fix -> record
```

## Core Rule

Do not treat implementation as complete until the change has been planned, verified, reviewed against acceptance criteria, and summarized with remaining risk.

When local markdown issues or tracker issues drive the work, close the loop against the issue list, not just the code diff.

## When Starting

First inspect the project context: existing docs, package scripts, tests, architecture notes, and relevant files. Prefer existing repo conventions over new process.

If the request is too broad for one loop, split it into independently verifiable tasks and run the loop on the first task.

## Workflow

1. Intake
   Identify the user goal, constraints, non-goals, target users, and success criteria.

2. Shape
   Convert the request into one or more executable tasks. Each task must have acceptance criteria and a verification path.

3. Plan
   Identify affected files, interfaces, tests, risks, and exact verification commands.

4. Implement
   Make the smallest coherent change that satisfies the task. Keep unrelated refactors out of the loop.

5. Verify
   Run the relevant checks. Prefer repo scripts and focused tests first, then broader checks when risk warrants it.

6. Review
   Check acceptance criteria, regressions, missing tests, design fit, and user-facing behavior.

7. Fix
   If verification or review fails, return to implementation with concrete feedback. Preserve the failed output as context.

8. Record
   Summarize the change, verification result, review result, remaining risk, and one reusable learning.

## Issue Audit Loop

Use this after completing an issue-driven change, before final reporting or commit:

1. Re-read the active issue and nearby dependent issues.
2. Compare every acceptance criterion with code, tests, UI/API behavior, and docs.
3. Mark criteria complete only when evidence exists.
4. Review for P0 issue-related gaps: data corruption, orphan records, broken primary flows, missing persistence, impossible next issue, or unverifiable acceptance criteria.
5. If a P0 gap exists, create a new issue first, then fix or explicitly block it.
6. Leave non-P0 follow-ups as open issues or remaining risk; do not hide them as "done".

## Exit Criteria

A task is complete only when:

- Acceptance criteria are satisfied or explicitly scoped out.
- Relevant tests/checks were run, or the reason they could not run is stated.
- Review found no blocking issue, or unresolved issues are clearly reported.
- Issue status was audited when the project uses issues as the task source.
- Final response includes what changed, how it was verified, and remaining risk.

## Harness Guidance

Use any available harness as the execution environment, not as the decision maker. Harness may prepare workspaces, run commands, execute agents, and collect logs. The loop decides whether the result is acceptable.

If no harness exists, use the local repo commands directly.

## Reference Templates

Load these only when useful:

- `references/task-template.md`: use when shaping a request into an executable task.
- `references/plan-template.md`: use when writing a task implementation plan.
- `references/verification-template.md`: use when defining or reporting verification.
- `references/record-template.md`: use when closing a loop and preserving learning.

## Final Report Format

When finishing a loop, report:

```text
Changed:
Verified:
Review result:
Remaining risk:
Loop learning:
```
