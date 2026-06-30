/**
 * Slide-in navigation sidebar, opened from the bottom "More" tab.
 * Lists every destination; the bottom bar keeps only the primary three.
 */
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../lib/theme";

const ITEMS = [
  { label: "Home", route: "/home", icon: "home-outline" },
  { label: "Upload Material", route: "/upload", icon: "cloud-upload-outline" },
  { label: "Tutor Chat", route: "/chat", icon: "chatbubbles-outline" },
  { label: "Exam Mode", route: "/quiz", icon: "school-outline" },
  { label: "Doubt Notebook", route: "/doubts", icon: "bookmarks-outline" },
  { label: "Profile", route: "/profile", icon: "person-outline" },
] as const;

const WIDTH = Math.min(300, Dimensions.get("window").width * 0.8);

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, anim]);

  if (!mounted) return null;

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-WIDTH, 0],
  });
  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(31,34,51,0.35)", opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: WIDTH,
          transform: [{ translateX }],
          backgroundColor: theme.surface,
          paddingTop: insets.top + 20,
          paddingHorizontal: 14,
          borderTopRightRadius: 28,
          borderBottomRightRadius: 28,
          shadowColor: theme.primary,
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 6, height: 0 },
          elevation: 18,
        }}
      >
        {/* Brand header */}
        <View className="mb-6 flex-row items-center px-2">
          <Image
            source={require("../assets/logo.png")}
            resizeMode="contain"
            style={{ width: 42, height: 42 }}
          />
          <View className="ml-2">
            <Text className="text-base font-bold text-ink">StudyPilot AI</Text>
            <Text className="text-[11px] text-muted">Learning companion</Text>
          </View>
        </View>

        {ITEMS.map((item) => {
          const active = pathname === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => {
                onClose();
                router.navigate(item.route);
              }}
              className={`mb-1 flex-row items-center rounded-2xl px-3 py-3 ${
                active ? "bg-primary-soft" : ""
              }`}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? theme.primary : theme.muted}
              />
              <Text
                className={`ml-3 text-sm font-semibold ${
                  active ? "text-primary" : "text-ink"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}
