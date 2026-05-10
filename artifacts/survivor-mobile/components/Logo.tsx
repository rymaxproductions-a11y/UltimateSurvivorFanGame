import { Text, View, type StyleProp, type ViewStyle } from "react-native";

export function Logo({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: size, justifyContent: "center" }, style]}>
      <Text
        style={{
          fontFamily: "Oswald_700Bold",
          fontSize: size * 0.55,
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
