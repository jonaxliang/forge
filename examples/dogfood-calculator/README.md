# Dogfood Calculator

Small TypeScript calculator example created through a Forge dogfood code task.

## Usage

```ts
import { calculate } from "./src/calculator";

calculate("1 + 2 * (3 + 4)"); // 15
```

Supported syntax:

- Addition, subtraction, multiplication, and division
- Parentheses
- Decimal numbers
- Unary plus and minus
- Whitespace between tokens

## Verification

```bash
pnpm exec tsx examples/dogfood-calculator/src/calculator.test.ts
```
