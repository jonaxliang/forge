# Verification Template

Use this template to define or report verification for a loop.

```markdown
# Verification

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `[command]` | pass/fail/not run | [important output or reason] |

## Acceptance Criteria Check

| Criterion | Status | Evidence |
| --- | --- | --- |
| [criterion] | met/not met/scoped out | [test, file, screenshot, or explanation] |

## Manual Checks

- [Flow checked]: [result]

## Failures and Fixes

- Failure: [what failed]
  Fix: [what changed]
  Re-check: `[command]`

## Remaining Risk

- [Risk still present, or "None identified beyond untested external dependencies."]
```

Never claim a command passed unless it was actually run in the current loop.
