/**
 * Small premium UI primitives shared across the tab screens.
 * Styled with NativeWind classNames against the pastel theme.
 */
import { ReactNode } from "react";
import { Text, View } from "react-native";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`rounded-[24px] bg-surface p-5 shadow-sm shadow-primary/10 border border-line ${className}`}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-3 text-base font-semibold text-ink">{children}</Text>
  );
}

export function Pill({
  label,
  tone = "primary",
}: {
  label: string;
  tone?: "primary" | "accent" | "peach";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-accent",
    peach: "bg-peach-soft text-peach",
  };
  return (
    <View className={`self-start rounded-full px-3 py-1 ${tones[tone]}`}>
      <Text className={`text-xs font-semibold ${tones[tone]}`}>{label}</Text>
    </View>
  );
}

export function Divider() {
  return <View className="my-3 h-px w-full bg-line" />;
}
