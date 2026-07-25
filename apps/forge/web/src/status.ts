export function shouldShowModelConfigurationStatus({
  modelConfigured,
  requirementCount
}: {
  modelConfigured: boolean | null | undefined;
  requirementCount: number;
}) {
  return modelConfigured === false && requirementCount > 0;
}
