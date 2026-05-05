import { Text, type TextStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

export function Heading({
  children,
  level = 1,
  style,
}: {
  children: React.ReactNode;
  level?: 1 | 2 | 3;
  style?: TextStyle;
}) {
  const colors = useColors();
  const sizes = { 1: 32, 2: 22, 3: 16 };
  return (
    <Text
      style={[
        {
          color: colors.foreground,
          fontFamily: "Oswald_700Bold",
          fontSize: sizes[level],
          letterSpacing: 0.5,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const colors = useColors();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: muted ? colors.mutedForeground : colors.foreground,
          fontFamily: "WorkSans_400Regular",
          fontSize: 14,
          lineHeight: 20,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
