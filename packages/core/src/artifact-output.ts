const finalMarkdownMarkers = [
  "以下是最终版Markdown文档",
  "以下是最终版 Markdown 文档"
];

export function normalizeArtifactOutput(output: string) {
  const trimmedOutput = output.trim();
  const markerIndex = finalMarkdownMarkers.reduce<number>(
    (foundIndex, marker) => {
      const currentIndex = trimmedOutput.indexOf(marker);

      if (currentIndex < 0) {
        return foundIndex;
      }

      return foundIndex < 0 ? currentIndex : Math.min(foundIndex, currentIndex);
    },
    -1
  );
  const finalDocument =
    markerIndex >= 0
      ? trimFinalDocumentPrefix(trimmedOutput.slice(markerIndex))
      : trimmedOutput;

  return unwrapMarkdownFence(finalDocument).trim();
}

function trimFinalDocumentPrefix(output: string) {
  const marker = finalMarkdownMarkers.find((candidate) =>
    output.startsWith(candidate)
  );

  if (!marker) {
    return output;
  }

  return output.slice(marker.length).replace(/^[\s:：-]+/, "");
}

function unwrapMarkdownFence(output: string) {
  const leadingFenceMatch = output.match(
    /^```\s*(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n?```\s*/i
  );
  const fenceMatch =
    leadingFenceMatch ??
    output.match(
      /^```\s*(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n?```\s*$/i
    );

  return fenceMatch?.[1] ?? output;
}
