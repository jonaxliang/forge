# Loop Record Template

Use this template when closing a loop or writing a durable task record.

```markdown
# Loop Record: [task title]

## Summary

[What changed and why.]

## Artifacts

- Code: [files, branch, commit, PR, or patch reference]
- Tests: [test report or commands]
- Docs: [docs changed or "none"]

## Review Result

- Status: accepted / needs changes / blocked
- Notes: [important review findings]

## Verification Result

- [command]: pass/fail/not run

## Remaining Risk

- [known risk, follow-up, or "None identified."]

## Loop Learning

[One reusable lesson that should improve future loops, such as a missing test pattern, unclear requirement template, or useful verification command.]
```

Keep loop records factual. Do not include broad retrospectives unless they change future execution.
