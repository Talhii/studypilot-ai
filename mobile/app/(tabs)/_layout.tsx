import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Sidebar } from "../../components/Sidebar";
import { theme } from "../../lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.muted,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginBottom: 6,
          },
          tabBarStyle: {
            position: "absolute",
            height: 74,
            paddingTop: 8,
            backgroundColor: theme.surface,
            borderTopWidth: 1,
            borderTopColor: theme.line,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: theme.primary,
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 },
            elevation: 12,
          },
        }}
      >
        {/* Bottom bar order: More (left) · Quiz · Chat · Home (right) */}

        {/* "More" opens the sidebar instead of navigating */}
        <Tabs.Screen
          name="more"
          options={{ title: "More", tabBarIcon: tabIcon("menu") }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setSidebarOpen(true);
            },
          }}
        />
        <Tabs.Screen
          name="quiz"
          options={{ title: "Quiz", tabBarIcon: tabIcon("school-outline") }}
        />
        <Tabs.Screen
          name="chat"
          options={{ title: "Chat", tabBarIcon: tabIcon("chatbubbles-outline") }}
        />
        <Tabs.Screen
          name="home"
          options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }}
        />

        {/* Reachable only via the sidebar (hidden from the bar) */}
        <Tabs.Screen name="upload" options={{ href: null }} />
        <Tabs.Screen name="doubts" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}
