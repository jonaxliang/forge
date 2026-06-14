import type { ReactNode } from "react";

type StatusBadgeTone = "neutral" | "success" | "info" | "warning" | "danger";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

const toneStyles: Record<
  StatusBadgeTone,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  danger: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    color: "#991b1b"
  },
  info: {
    backgroundColor: "#dff7f4",
    borderColor: "#b8ebe5",
    color: "#006d6d"
  },
  neutral: {
    backgroundColor: "#eef2f7",
    borderColor: "#d7dee8",
    color: "#334155"
  },
  success: {
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
    color: "#166534"
  },
  warning: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    color: "#92400e"
  }
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  const style = toneStyles[tone];

  return (
    <span
      style={{
        alignItems: "center",
        backgroundColor: style.backgroundColor,
        border: `1px solid ${style.borderColor}`,
        borderRadius: 999,
        color: style.color,
        display: "inline-flex",
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1,
        minHeight: 28,
        padding: "0 10px",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}
