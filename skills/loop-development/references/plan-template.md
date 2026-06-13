# Plan Template

Use this template before implementation when the change touches code or product behavior.

```markdown
# [Task Title] Plan

## Approach

[2-4 sentences explaining the implementation path and why it fits the repo.]

## Files

- Modify: `[path]` - [responsibility]
- Create: `[path]` - [responsibility]
- Test: `[path]` - [what it proves]

## Steps

1. Add or update failing tests for [specific behavior].
2. Implement [specific module/API/UI behavior].
3. Wire [specific integration boundary].
4. Run focused verification.
5. Run broader verification if the change affects shared behavior.
6. Review against acceptance criteria.

## Risks

- [Risk]: [mitigation or verification]

## Verification Commands

```bash
[exact focused command]
[exact broader command]
```
```

Keep plans concrete. Do not use placeholders such as "add tests as needed" or "handle edge cases" without naming the cases.
