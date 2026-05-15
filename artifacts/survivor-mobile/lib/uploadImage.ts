import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { API_BASE_URL } from "./api";

type GetToken = () => Promise<string | null>;

export type AvatarSource = "library" | "camera";

/**
 * Open the image picker (library or camera), let the user crop a square, then
 * upload the result to object storage and return the persisted objectPath
 * (e.g. "/objects/uploads/abc.jpg") that can be saved on the user record.
 *
 * Returns `null` if the user cancels or denies a permission.
 */
export async function pickAndUploadAvatar(
  source: AvatarSource,
  getToken: GetToken,
): Promise<string | null> {
  let result: ImagePicker.ImagePickerResult;

  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera permission needed", "Please allow camera access to take a profile picture.");
      return null;
    }
    result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo permission needed", "Please allow photo access to choose a profile picture.");
      return null;
    }
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
  }

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const contentType = asset.mimeType ?? "image/jpeg";

  // Convert local file URI → blob so we can both PUT it and know its size.
  const fileResp = await fetch(asset.uri);
  const blob = await fileResp.blob();
  const ext = contentType.split("/")[1] ?? "jpg";
  const name = `avatar-${Date.now()}.${ext}`;

  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const presignResp = await fetch(`${API_BASE_URL}/api/storage/uploads/request-url`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, size: blob.size, contentType }),
  });
  if (!presignResp.ok) {
    throw new Error("Could not get upload URL");
  }
  const { uploadURL, objectPath } = await presignResp.json();

  const putResp = await fetch(uploadURL, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });
  if (!putResp.ok) {
    throw new Error("Upload failed");
  }

  return objectPath as string;
}
