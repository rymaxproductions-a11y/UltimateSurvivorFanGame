import { Text, View, type StyleProp, type ViewStyle } from "react-native";

export function Logo({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const fontSize = size * 0.42;
  return (
    <View style={[{ justifyContent: "center" }, style]}>
      <Text
        style={{
          fontFamily: "Oswald_700Bold",
          fontSize,
          lineHeight: fontSize * 1.05,
          letterSpacing: 2,
          color: "#e08a1e",
          textTransform: "uppercase",
        }}
      >
        Ultimate Survivor
      </Text>
      <Text
        style={{
          fontFamily: "Oswald_700Bold",
          fontSize,
          lineHeight: fontSize * 1.05,
          letterSpacing: 2,
          color: "#e08a1e",
          textTransform: "uppercase",
        }}
      >
        Fan Game
      </Text>
    </View>
  );
}
