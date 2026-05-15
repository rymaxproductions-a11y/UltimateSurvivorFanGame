import { useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, View, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Avatar } from "./Avatar";
import { Body } from "./Heading";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/localAuth";
import { pickAndUploadAvatar, type AvatarSource } from "@/lib/uploadImage";

interface Props {
  avatarPath?: string | null;
  size?: number;
  onChange: (avatarPath: string | null) => void | Promise<void>;
  /** Disable interaction while a save is in flight. */
  disabled?: boolean;
}

/**
 * Tappable avatar with edit overlay. On press shows a sheet with
 * camera / library / remove options.
 */
export function AvatarPicker({ avatarPath, size = 96, onChange, disabled }: Props) {
  const colors = useColors();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);

  async function runUpload(source: AvatarSource) {
    try {
      setBusy(true);
      const path = await pickAndUploadAvatar(source, getToken);
      if (path) await onChange(path);
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function runRemove() {
    try {
      setBusy(true);
      await onChange(null);
    } finally {
      setBusy(false);
    }
  }

  function openSheet() {
    if (busy || disabled) return;
    const hasAvatar = !!avatarPath;
    const options = hasAvatar
      ? ["Take Photo", "Choose from Library", "Remove Photo", "Cancel"]
      : ["Take Photo", "Choose from Library", "Cancel"];
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = hasAvatar ? 2 : undefined;

    const handle = (i: number) => {
      if (i === cancelButtonIndex) return;
      if (i === 0) runUpload("camera");
      else if (i === 1) runUpload("library");
      else if (hasAvatar && i === 2) runRemove();
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, destructiveButtonIndex },
        handle,
      );
    } else {
      Alert.alert("Profile photo", undefined, [
        { text: "Take Photo", onPress: () => runUpload("camera") },
        { text: "Choose from Library", onPress: () => runUpload("library") },
        ...(hasAvatar
          ? [{ text: "Remove Photo", style: "destructive" as const, onPress: runRemove }]
          : []),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }

  return (
    <Pressable onPress={openSheet} disabled={busy || disabled} style={{ alignItems: "center" }}>
      <View style={{ position: "relative" }}>
        <Avatar headshotPath={avatarPath} size={size} />
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            backgroundColor: colors.primary,
            borderRadius: 999,
            padding: 6,
            borderWidth: 2,
            borderColor: colors.background,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="camera" size={14} color={colors.primaryForeground} />
          )}
        </View>
      </View>
      <Body muted style={{ fontSize: 11, marginTop: 8, letterSpacing: 1 }}>
        {avatarPath ? "TAP TO CHANGE" : "TAP TO ADD PHOTO"}
      </Body>
    </Pressable>
  );
}
