import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type RefreshControlProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export function Screen({
  children,
  scroll = true,
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const colors = useColors();

  if (!scroll) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.flex, { padding: 20 }, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[{ padding: 20, paddingBottom: 120 }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
