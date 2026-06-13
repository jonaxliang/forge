# Task Template

Use this template to convert a product request into an executable engineering task.

```markdown
# Task: [short title]

## Goal

[One sentence describing the user-visible outcome.]

## Context

[Why this matters, what existing behavior or constraint matters.]

## Non-Goals

- [Explicitly out-of-scope item]

## Acceptance Criteria

- [Observable behavior or artifact]
- [Error/edge behavior if relevant]
- [Test or validation expectation]

## Affected Areas

- [app/package/module]
- [API/schema/UI/test/docs surface]

## Verification

- Command: `[exact command]`
  Expected: [pass/fail condition]
- Manual check: [specific flow if needed]

## Expected Artifacts

- [code change / test report / screenshot / doc / migration / release note]
```

Good tasks are small enough to verify independently. If one task has unrelated acceptance criteria, split it.
