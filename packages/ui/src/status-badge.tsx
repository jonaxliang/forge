import type { ReactNode } from "react";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "success";
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      style={{
        alignItems: "center",
        backgroundColor: tone === "success" ? "#dff4e8" : "#e6e8df",
        borderRadius: 999,
        color: tone === "success" ? "#145c37" : "#394047",
        display: "inline-flex",
        fontSize: 14,
        fontWeight: 700,
        minHeight: 36,
        padding: "0 14px"
      }}
    >
      {children}
    </span>
  );
}
