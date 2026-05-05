import { TextInput, View, type TextInputProps } from "react-native";

import { useColors } from "@/hooks/useColors";
import { Body } from "@/components/Heading";

export function Input({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Body style={{ fontFamily: "WorkSans_600SemiBold", color: colors.foreground }}>
          {label}
        </Body>
      ) : null}
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        {...props}
        style={[
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
            borderWidth: 1,
            borderRadius: colors.radius,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: colors.foreground,
            fontFamily: "WorkSans_400Regular",
            fontSize: 16,
          },
          props.style,
        ]}
      />
      {error ? (
        <Body style={{ color: colors.destructive, fontSize: 12 }}>{error}</Body>
      ) : null}
    </View>
  );
}
