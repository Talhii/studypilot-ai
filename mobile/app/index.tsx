import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import { theme } from "../lib/theme";

/**
 * Branded launch screen: the logo fades/scales in, then the name and tagline
 * stagger in, hold briefly, then we replace into the Home tab.
 */
export default function Splash() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(nameOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.delay(650),
    ]);

    run.start(({ finished }) => {
      if (finished) router.replace("/home");
    });

    return () => run.stop();
  }, [logoOpacity, logoScale, nameOpacity, taglineOpacity]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.background,
      }}
    >
      <Animated.Image
        source={require("../assets/logo.png")}
        resizeMode="contain"
        style={{
          width: 230,
          height: 180,
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }}
      />
      <Animated.Text
        style={{
          marginTop: 24,
          fontSize: 30,
          fontWeight: "800",
          letterSpacing: 0.3,
          color: theme.ink,
          opacity: nameOpacity,
        }}
      >
        StudyPilot AI
      </Animated.Text>
      <Animated.Text
        style={{
          marginTop: 8,
          fontSize: 14,
          color: theme.muted,
          opacity: taglineOpacity,
        }}
      >
        Your Personal AI Learning Companion.
      </Animated.Text>
    </View>
  );
}
