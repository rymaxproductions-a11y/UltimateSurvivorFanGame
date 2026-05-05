import * as Haptics from "expo-haptics";
import { ActivityIndicator, Platform, Pressable, Text, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

type Variant = "primary" | "secondary" | "outline" | "ghost";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  fullWidth,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: {
      bg: colors.primary,
      fg: colors.primaryForeground,
      border: colors.primary,
    },
    secondary: {
      bg: colors.secondary,
      fg: colors.secondaryForeground,
      border: colors.secondary,
    },
    outline: {
      bg: "transparent",
      fg: colors.foreground,
      border: colors.border,
    },
    ghost: {
      bg: "transparent",
      fg: colors.foreground,
      border: "transparent",
    },
  };

  const p = palette[variant];

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: variant === "outline" ? 1 : 0,
          borderRadius: colors.radius,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <Text
          style={{
            color: p.fg,
            fontFamily: "Oswald_600SemiBold",
            fontSize: 16,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
