import { Image, View, type StyleProp, type ViewStyle } from "react-native";

const LOGO_SOURCE = require("../assets/images/logo-mark.png");

export function Logo({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const dimension = size * 2.4;
  return (
    <View style={[{ alignItems: "center", justifyContent: "center" }, style]}>
      <Image
        source={LOGO_SOURCE}
        resizeMode="contain"
        style={{ width: dimension, height: dimension }}
        accessibilityLabel="Ultimate Survivor Fan Game"
      />
    </View>
  );
}
