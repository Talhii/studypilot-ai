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

import { Card, Divider } from "../../components/ui";
import { getDoubts, type DoubtItem } from "../../lib/api";
import { theme } from "../../lib/theme";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DoubtsScreen() {
  const insets = useSafeAreaInsets();
  const [doubts, setDoubts] = useState<DoubtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setDoubts(await getDoubts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load doubts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch whenever the tab gains focus (newly saved doubts appear).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-2xl font-bold text-ink">Doubt Notebook</Text>
        <Text className="mt-1 text-sm text-muted">
          Saved AI answers to revise your weak areas.
        </Text>

        {error ? (
          <Card className="mt-5 border-danger/30">
            <Text className="text-sm text-danger">⚠ {error}</Text>
          </Card>
        ) : null}

        {loading ? (
          <Card className="mt-6">
            <ActivityIndicator color={theme.primary} />
          </Card>
        ) : doubts.length === 0 ? (
          <Card className="mt-6 items-center">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
              <Ionicons name="star-outline" size={26} color={theme.primary} />
            </View>
            <Text className="text-center text-sm font-semibold text-ink">
              No saved doubts yet
            </Text>
            <Text className="mt-1 text-center text-xs text-muted">
              In Chat, tap “Save as Doubt” under any answer to collect it here.
            </Text>
          </Card>
        ) : (
          <View className="mt-6">
            {doubts.map((d) => (
              <Card key={d.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ionicons
                      name="help-circle"
                      size={16}
                      color={theme.primary}
                    />
                    <Text className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Question
                    </Text>
                  </View>
                  <Text className="text-[11px] text-muted">
                    {formatDate(d.created_at)}
                  </Text>
                </View>
                <Text className="mt-1.5 text-sm font-semibold text-ink">
                  {d.question_text}
                </Text>

                <Divider />

                <View className="flex-row items-center">
                  <Ionicons
                    name="sparkles-outline"
                    size={14}
                    color={theme.accent}
                  />
                  <Text className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    Answer
                  </Text>
                </View>
                <Text
                  selectable
                  className="mt-1.5 text-[13px] leading-5 text-ink"
                >
                  {d.ai_answer_text}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
