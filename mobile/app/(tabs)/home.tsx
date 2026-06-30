import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, SectionTitle } from "../../components/ui";
import { getDashboardStats, type DashboardStats } from "../../lib/api";
import { getLocalProfile } from "../../lib/session";
import { theme } from "../../lib/theme";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type Metric = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  soft: string;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localProfile, setLocalProfile] = useState(getLocalProfile());

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboardStats();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLocalProfile(getLocalProfile());
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const metrics: Metric[] = [
    {
      label: "Study velocity",
      value: `${stats?.study_velocity_hours ?? 0}h`,
      icon: "flash-outline",
      tint: theme.primary,
      soft: theme.primarySoft,
    },
    {
      label: "Files uploaded",
      value: `${stats?.total_files_uploaded ?? 0}`,
      icon: "documents-outline",
      tint: theme.accent,
      soft: "#E4F7F3",
    },
    {
      label: "Quizzes",
      value: `${stats?.active_quizzes_generated ?? 0}`,
      icon: "school-outline",
      tint: theme.peach,
      soft: "#FFEDE8",
    },
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <Text className="text-sm text-muted">{greeting()},</Text>
        <Text className="text-2xl font-bold text-ink">
          {localProfile.name || stats?.user?.name || "Welcome to StudyPilot"}
        </Text>
        <Text className="mt-1 text-sm text-muted">
          {[localProfile.university, localProfile.semester]
            .filter(Boolean)
            .join(" · ") ||
            [stats?.user?.university, stats?.user?.semester]
              .filter(Boolean)
              .join(" · ") ||
            "Your AI learning companion is ready."}
        </Text>

        {error ? (
          <Card className="mt-5 border-danger/30">
            <Text className="text-sm text-danger">⚠ {error}</Text>
            <Text className="mt-1 text-xs text-muted">
              Is the backend running on port 8000? Pull to retry.
            </Text>
          </Card>
        ) : null}

        {/* Metric cards */}
        <View className="mt-6 flex-row justify-between">
          {metrics.map((m) => (
            <View
              key={m.label}
              className="mr-3 flex-1 rounded-[22px] border border-line bg-surface p-4 last:mr-0"
            >
              <View
                className="mb-3 h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: m.soft }}
              >
                <Ionicons name={m.icon} size={18} color={m.tint} />
              </View>
              {loading ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Text className="text-xl font-bold text-ink">{m.value}</Text>
              )}
              <Text className="mt-1 text-[11px] text-muted">{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Recent notes */}
        <View className="mt-7">
          <SectionTitle>Recent notes</SectionTitle>
          {loading ? (
            <Card>
              <ActivityIndicator color={theme.primary} />
            </Card>
          ) : stats && stats.documents.length > 0 ? (
            stats.documents.slice(0, 6).map((doc) => (
              <Card key={doc.id} className="mb-3">
                <View className="flex-row items-center">
                  <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft">
                    <Text className="text-xs font-bold uppercase text-primary">
                      {doc.format}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-sm font-semibold text-ink"
                    >
                      {doc.file_name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted">
                      {doc.chunk_count} chunks · {doc.format.toUpperCase()}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.muted}
                  />
                </View>
              </Card>
            ))
          ) : (
            <Card>
              <Text className="text-sm text-ink">No materials yet.</Text>
              <Text className="mt-1 text-xs text-muted">
                Open More → Upload to add your first study file.
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
