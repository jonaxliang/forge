export type DatabaseStatus = {
  configured: boolean;
  dialect: "sqlite" | "postgres" | "mysql" | "unconfigured";
};

export function createDatabaseStatus(): DatabaseStatus {
  return {
    configured: false,
    dialect: "unconfigured"
  };
}
