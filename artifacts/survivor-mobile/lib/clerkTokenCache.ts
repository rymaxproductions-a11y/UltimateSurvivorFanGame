import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

interface TokenCache {
  getToken: (key: string) => Promise<string | undefined | null>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => void;
}

const createTokenCache = (): TokenCache => ({
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, token: string) {
    try {
      await SecureStore.setItemAsync(key, token);
    } catch {
      // ignore
    }
  },
});

export const tokenCache: TokenCache | undefined =
  Platform.OS !== "web" ? createTokenCache() : undefined;
