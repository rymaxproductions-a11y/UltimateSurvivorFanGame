import { Image, type ImageStyle, type StyleProp } from "react-native";

export function Logo({ size = 48, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require("@/assets/images/survivor-logo.png")}
      style={[{ width: size * 4, height: size, resizeMode: "contain" }, style]}
    />
  );
}
