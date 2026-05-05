import { setBaseUrl } from "@workspace/api-client-react";

const domain = process.env.EXPO_PUBLIC_DOMAIN;

export const API_BASE_URL = domain ? `https://${domain}` : "";

export function configureApi() {
  if (API_BASE_URL) {
    setBaseUrl(API_BASE_URL);
  }
}

export function storageImageUrl(headshotPath: string | null | undefined): string | null {
  if (!headshotPath) return null;
  const path = headshotPath.startsWith("/") ? headshotPath : `/${headshotPath}`;
  return `${API_BASE_URL}/api/storage${path}`;
}
