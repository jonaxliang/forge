export function shouldShowModelConfigurationStatus({
  modelConfigured
}: {
  modelConfigured: boolean | null | undefined;
  requirementCount: number;
}) {
  return modelConfigured === false;
}
