import assert from "node:assert/strict";
import { calculate } from "./calculator";

const cases: Array<[string, number]> = [
  ["1 + 2 * 3", 7],
  ["(1 + 2) * 3", 9],
  ["10 / 4", 2.5],
  ["-2 * (3 + 4)", -14],
  ["+3.5 + .5", 4]
];

for (const [expression, expected] of cases) {
  assert.equal(calculate(expression), expected, expression);
}

assert.throws(() => calculate(""), /empty expression/i);
assert.throws(() => calculate("1 / 0"), /division by zero/i);
assert.throws(() => calculate("1 + )"), /unexpected token/i);

console.log("dogfood calculator tests passed");
