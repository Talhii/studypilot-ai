import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "../../components/ui";
import { getDashboardStats, type DashboardStats } from "../../lib/api";
import {
  getLocalProfile,
  resetSession,
  saveLocalProfile,
  type LocalProfile,
} from "../../lib/session";
import { theme } from "../../lib/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<LocalProfile>(getLocalProfile());
  const [draft, setDraft] = useState<LocalProfile>(getLocalProfile());
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getDashboardStats());
    } catch {
      // soft-fail: analytics simply show zeros
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const current = getLocalProfile();
      setProfile(current);
      if (!editing) setDraft(current);
      void loadStats();
    }, [loadStats, editing]),
  );

  async function save() {
    setSaving(true);
    const cleaned: LocalProfile = {
      name: draft.name.trim(),
      university: draft.university.trim(),
      semester: draft.semester.trim(),
    };
    await saveLocalProfile(cleaned);
    setProfile(cleaned);
    setEditing(false);
    setSaving(false);
  }

  async function onReset() {
    await resetSession();
    const cleared = getLocalProfile();
    setProfile(cleared);
    setDraft(cleared);
    setEditing(false);
    setStats(null);
    setLoadingStats(true);
    void loadStats();
    router.navigate("/home");
  }

  const initial = (profile.name || "S").trim().charAt(0).toUpperCase();

  const metrics = [
    {
      emoji: "📂",
      label: "Materials Processed",
      value: `${stats?.total_files_uploaded ?? 0}`,
      soft: theme.primarySoft,
    },
    {
      emoji: "📝",
      label: "Quizzes Taken",
      value: `${stats?.active_quizzes_generated ?? 0}`,
      soft: "#E4F7F3",
    },
    {
      emoji: "⏱️",
      label: "Study Hours",
      value: `${stats?.study_velocity_hours ?? 0}h`,
      soft: "#FFEDE8",
    },
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-ink">Profile</Text>
        <Text className="mt-1 text-sm text-muted">
          Your student profile & progress.
        </Text>

        {/* Profile card */}
        <Card className="mt-6">
          <View className="flex-row items-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
              <Text className="text-2xl font-bold text-primary">{initial}</Text>
            </View>
            <View className="ml-4 flex-1">
              {editing ? (
                <Text className="text-sm font-semibold text-ink">
                  Editing profile…
                </Text>
              ) : (
                <>
                  <Text className="text-lg font-bold text-ink">
                    {profile.name || "Student"}
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted">
                    {[profile.university, profile.semester]
                      .filter(Boolean)
                      .join(" · ") || "Tap Edit to add your details"}
                  </Text>
                </>
              )}
            </View>
            {!editing ? (
              <Pressable
                onPress={() => {
                  setDraft(profile);
                  setEditing(true);
                }}
                className="rounded-full border border-primary px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-primary">
                  Edit Profile
                </Text>
              </Pressable>
            ) : null}
          </View>

          {editing ? (
            <View className="mt-4">
              <Field
                label="Name"
                value={draft.name}
                placeholder="Your name"
                onChange={(t) => setDraft((d) => ({ ...d, name: t }))}
              />
              <Field
                label="University"
                value={draft.university}
                placeholder="e.g. NUST"
                onChange={(t) => setDraft((d) => ({ ...d, university: t }))}
              />
              <Field
                label="Active Semester"
                value={draft.semester}
                placeholder="e.g. 8th Semester"
                onChange={(t) => setDraft((d) => ({ ...d, semester: t }))}
              />
              <View className="mt-1 flex-row">
                <Pressable
                  onPress={() => {
                    setEditing(false);
                    setDraft(profile);
                  }}
                  className="mr-3 flex-1 items-center rounded-full border border-line px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-muted">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={saving}
                  className="flex-1 items-center rounded-full bg-primary px-4 py-3"
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">
                      Save Profile
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Achievements & Analytics */}
        <Text className="mb-3 mt-7 text-base font-semibold text-ink">
          Achievements & Analytics
        </Text>
        <View className="flex-row justify-between">
          {metrics.map((m) => (
            <View
              key={m.label}
              className="mr-3 flex-1 rounded-[22px] border border-line bg-surface p-4 last:mr-0"
            >
              <View
                className="mb-3 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: m.soft }}
              >
                <Text className="text-lg">{m.emoji}</Text>
              </View>
              {loadingStats ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Text className="text-xl font-bold text-ink">{m.value}</Text>
              )}
              <Text className="mt-1 text-[11px] text-muted">{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Reset / logout */}
        <Pressable
          onPress={onReset}
          className="mt-8 flex-row items-center justify-center rounded-[20px] border border-danger/30 bg-peach-soft px-4 py-4 active:opacity-80"
        >
          <Ionicons name="refresh-outline" size={18} color={theme.danger} />
          <Text className="ml-2 text-sm font-semibold text-danger">
            Reset Local Session data
          </Text>
        </Pressable>
        <Text className="mt-2 text-center text-[11px] text-muted">
          Clears your local profile and starts a fresh dev-user session.
        </Text>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        className="rounded-2xl border border-line bg-background px-4 py-3 text-[14px] text-ink"
      />
    </View>
  );
}
