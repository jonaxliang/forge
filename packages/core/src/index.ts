export function createHealthPayload() {
  return {
    ok: true,
    service: "forge",
    status: "healthy"
  } as const;
}
