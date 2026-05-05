import { Feather } from "@expo/vector-icons";
import { Image, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { storageImageUrl } from "@/lib/api";

export function Avatar({
  headshotPath,
  size = 56,
}: {
  headshotPath?: string | null;
  size?: number;
}) {
  const colors = useColors();
  const url = storageImageUrl(headshotPath);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.muted,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} />
      ) : (
        <Feather name="user" size={size * 0.5} color={colors.mutedForeground} />
      )}
    </View>
  );
}
