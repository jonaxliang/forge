import { describe, expect, it } from "vitest";
import { artifactStorageModes, modelProviderKinds } from "./domain.js";
import { modelProviderDefaults } from "./model-providers.js";

describe("db domain modules", () => {
  it("keeps provider defaults aligned with provider kinds", () => {
    expect(Object.keys(modelProviderDefaults).sort()).toEqual(
      [...modelProviderKinds].sort()
    );
  });

  it("keeps artifact storage modes as the public persistence choices", () => {
    expect(artifactStorageModes).toEqual(["local-only", "cloud"]);
  });
});
