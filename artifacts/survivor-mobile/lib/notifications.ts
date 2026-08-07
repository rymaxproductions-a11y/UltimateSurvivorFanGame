import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Push notification helpers.
 *
 * The server sends chat notifications automatically to tribe members who have
 * a registered Expo push token AND notifyChat=true. This module handles the
 * device-side pieces: permission requests, obtaining the Expo push token,
 * the Android notification channel, and the foreground presentation handler.
 */

const PROMPTED_KEY = "notifications.prompted.v1";
const TOKEN_KEY = "notifications.expoPushToken.v1";
const OWNER_KEY = "notifications.tokenOwner.v1";

export type RegisterResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unsupported" | "denied" | "error" };

/** The token stored for this device plus the user id it is registered for. */
export interface StoredPushToken {
  token: string;
  ownerId: string | null;
}

/** Show alerts (with sound/badge) even when the app is foregrounded. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Create the default Android notification channel (no-op elsewhere). */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#0f1f17",
    });
  } catch {
    // Channel creation is best-effort.
  }
}

function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId;
}

/**
 * Request permission and obtain an Expo push token for this device.
 * Returns the token on success. Does NOT persist anything locally — the token
 * must only be stored after the server confirms registration (PUT succeeds).
 * The caller persists it via persistPushToken() on success.
 */
/** True when running inside the Expo Go client (not a standalone/dev build). */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === "storeClient";
}

export async function registerForPush(): Promise<RegisterResult> {
  // Push notifications are not supported on simulators/web.
  if (Platform.OS === "web") {
    return { ok: false, reason: "unsupported" };
  }
  // Remote push was removed from Expo Go on Android in SDK 53+.
  if (Platform.OS === "android" && isExpoGo()) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") {
      return { ok: false, reason: "denied" };
    }

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return { ok: true, token: tokenResponse.data };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Persist the token together with the user id it was registered for.
 * Only call this AFTER the server has confirmed the registration.
 */
export async function persistPushToken(token: string, ownerId: string | null): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [OWNER_KEY, ownerId ?? ""],
    ]);
  } catch {
    // ignore
  }
}

/** The Expo push token + owner stored for this device, if any. */
export async function getStoredPushToken(): Promise<StoredPushToken | null> {
  try {
    const [[, token], [, owner]] = await AsyncStorage.multiGet([TOKEN_KEY, OWNER_KEY]);
    if (!token) return null;
    return { token, ownerId: owner ? owner : null };
  } catch {
    return null;
  }
}

export async function clearStoredPushToken(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, OWNER_KEY]);
  } catch {
    // ignore
  }
}

/** Current OS-level permission status (true when granted). */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/** Whether we've already shown the in-app opt-in prompt. */
export async function hasBeenPrompted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PROMPTED_KEY)) === "1";
  } catch {
    return true; // fail safe: don't nag on storage error
  }
}

export async function markPrompted(): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMPTED_KEY, "1");
  } catch {
    // ignore
  }
}
