/**
 * Tap-to-flip study card. Front shows the prompt; a tap smoothly rotates the
 * card on its Y axis to reveal the answer. Remount (via a `key`) to reset.
 */
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

const styles = StyleSheet.create({
  container: { height: 280, width: "100%" },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: "hidden",
  },
});

export function FlipCard({ front, back }: { front: string; back: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);

  function flip() {
    Animated.spring(anim, {
      toValue: flipped ? 0 : 1,
      friction: 8,
      tension: 12,
      useNativeDriver: true,
    }).start();
    setFlipped((f) => !f);
  }

  const frontRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  return (
    <Pressable onPress={flip} style={styles.container}>
      <Animated.View
        style={[
          styles.face,
          { transform: [{ perspective: 1000 }, { rotateY: frontRotate }] },
        ]}
      >
        <View className="flex-1 items-center justify-center rounded-[28px] border border-line bg-surface p-6 shadow-sm shadow-primary/10">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Prompt
          </Text>
          <Text className="mt-3 text-center text-base font-semibold text-ink">
            {front}
          </Text>
          <Text className="mt-5 text-[11px] text-muted">Tap to flip →</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.face,
          { transform: [{ perspective: 1000 }, { rotateY: backRotate }] },
        ]}
      >
        <View className="flex-1 items-center justify-center rounded-[28px] border border-accent bg-accent-soft p-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            Answer
          </Text>
          <Text className="mt-3 text-center text-sm leading-5 text-ink">
            {back}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}
