import { getServerHealth, type ServerHealth } from "@forge/sdk";
import { StatusBadge } from "@forge/ui";
import { useEffect, useState } from "react";
import "./styles.css";

type ConnectionState =
  | { status: "checking"; message: string }
  | { status: "connected"; message: string; health: ServerHealth }
  | { status: "unavailable"; message: string };

export function App() {
  const [connection, setConnection] = useState<ConnectionState>({
    status: "checking",
    message: "Checking server connection"
  });

  useEffect(() => {
    let cancelled = false;

    getServerHealth()
      .then((health) => {
        if (!cancelled) {
          setConnection({
            status: "connected",
            message: "Server connected",
            health
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnection({
            status: "unavailable",
            message: "Server unavailable"
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Forge local development</p>
        <h1>Forge</h1>
        <p className="lede">
          A TypeScript workspace for orchestrating local agent workflows.
        </p>
        <div className="status-row" aria-live="polite">
          <StatusBadge
            tone={connection.status === "connected" ? "success" : "neutral"}
          >
            {connection.message}
          </StatusBadge>
          {connection.status === "connected" ? (
            <span className="health-detail">
              {connection.health.service} is {connection.health.status}
            </span>
          ) : null}
        </div>
      </section>
    </main>
  );
}
