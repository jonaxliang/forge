export function calculate(expression: string): number {
  const parser = new CalculatorParser(expression);
  const value = parser.parse();

  return Object.is(value, -0) ? 0 : value;
}

class CalculatorParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse() {
    this.skipWhitespace();

    if (this.index >= this.input.length) {
      throw new Error("Empty expression");
    }

    const value = this.parseExpression();
    this.skipWhitespace();

    if (this.index < this.input.length) {
      throw new Error(`Unexpected token "${this.input[this.index]}" at ${this.index}`);
    }

    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (true) {
      this.skipWhitespace();

      if (this.consume("+")) {
        value += this.parseTerm();
      } else if (this.consume("-")) {
        value -= this.parseTerm();
      } else {
        return value;
      }
    }
  }

  private parseTerm(): number {
    let value = this.parseUnary();

    while (true) {
      this.skipWhitespace();

      if (this.consume("*")) {
        value *= this.parseUnary();
      } else if (this.consume("/")) {
        const divisor = this.parseUnary();

        if (divisor === 0) {
          throw new Error("Division by zero");
        }

        value /= divisor;
      } else {
        return value;
      }
    }
  }

  private parseUnary(): number {
    this.skipWhitespace();

    if (this.consume("+")) {
      return this.parseUnary();
    }

    if (this.consume("-")) {
      return -this.parseUnary();
    }

    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWhitespace();

    if (this.consume("(")) {
      const value = this.parseExpression();
      this.skipWhitespace();

      if (!this.consume(")")) {
        throw new Error(`Expected ")" at ${this.index}`);
      }

      return value;
    }

    return this.parseNumber();
  }

  private parseNumber(): number {
    this.skipWhitespace();
    const start = this.index;
    let hasDigit = false;

    while (this.isDigit(this.input[this.index])) {
      this.index += 1;
      hasDigit = true;
    }

    if (this.input[this.index] === ".") {
      this.index += 1;

      while (this.isDigit(this.input[this.index])) {
        this.index += 1;
        hasDigit = true;
      }
    }

    if (!hasDigit) {
      const token = this.input[this.index] ?? "end of input";

      throw new Error(`Unexpected token "${token}" at ${this.index}`);
    }

    const value = Number(this.input.slice(start, this.index));

    if (!Number.isFinite(value)) {
      throw new Error(`Invalid number at ${start}`);
    }

    return value;
  }

  private consume(token: string) {
    if (this.input[this.index] !== token) {
      return false;
    }

    this.index += 1;
    return true;
  }

  private skipWhitespace() {
    while (/\s/.test(this.input[this.index] ?? "")) {
      this.index += 1;
    }
  }

  private isDigit(value: string | undefined) {
    return value !== undefined && value >= "0" && value <= "9";
  }
}
