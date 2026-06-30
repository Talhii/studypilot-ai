/**
 * Shared palette for places that need raw color values (navigation options,
 * icon tints) rather than Tailwind classNames. Keep in sync with
 * `tailwind.config.js`.
 */
export const theme = {
  background: "#F6F5FF",
  surface: "#FFFFFF",
  primary: "#7C6FF0",
  primarySoft: "#EAE7FF",
  accent: "#7AD7C9",
  peach: "#FFB5A7",
  ink: "#1F2233",
  muted: "#8A8FA8",
  line: "#ECECF5",
  success: "#5CC98F",
  danger: "#F2789F",
} as const;

export type Theme = typeof theme;
