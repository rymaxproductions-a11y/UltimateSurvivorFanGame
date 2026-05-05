import { ActivityIndicator, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function LoadingScreen() {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
