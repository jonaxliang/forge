import { describe, expect, it } from "vitest";
import { normalizeArtifactOutput } from "./artifact-output";

describe("normalizeArtifactOutput", () => {
  it("keeps only the final Markdown document when the model explains its work first", () => {
    expect(
      normalizeArtifactOutput(`好的，收到。

以下是最终版Markdown文档：

\`\`\`markdown
# 调研分析报告

- 结论 A
\`\`\``)
    ).toBe(`# 调研分析报告

- 结论 A`);
  });

  it("drops review notes after a fenced final Markdown document", () => {
    expect(
      normalizeArtifactOutput(`说明文本

以下是最终版Markdown文档：

\`\`\`markdown
# 最终文档
\`\`\`

补充说明：这不是最终文档内容。`)
    ).toBe("# 最终文档");
  });

  it("unwraps a standalone Markdown code fence", () => {
    expect(
      normalizeArtifactOutput(`\`\`\`md
# Final Report
\`\`\``)
    ).toBe("# Final Report");
  });

  it("unwraps Markdown fences with extra fence spacing", () => {
    expect(
      normalizeArtifactOutput(`\`\`\` markdown
# Final Report
\`\`\``)
    ).toBe("# Final Report");
  });

  it("preserves ordinary output when there is no final document marker", () => {
    expect(normalizeArtifactOutput("Plain output")).toBe("Plain output");
  });
});
