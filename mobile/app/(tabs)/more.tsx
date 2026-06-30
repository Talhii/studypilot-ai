import { View } from "react-native";

import { theme } from "../../lib/theme";

/**
 * The "More" tab press is intercepted in `(tabs)/_layout.tsx` to open the
 * sidebar instead of navigating, so this screen is never actually shown. It
 * exists only because expo-router requires a file for every registered tab.
 */
export default function More() {
  return <View style={{ flex: 1, backgroundColor: theme.background }} />;
}
