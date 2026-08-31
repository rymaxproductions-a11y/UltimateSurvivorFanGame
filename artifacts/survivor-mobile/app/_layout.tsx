import {
  Oswald_400Regular,
  Oswald_600SemiBold,
  Oswald_700Bold,
} from "@expo-google-fonts/oswald";
import { useFonts } from "@expo-google-fonts/inter";
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
} from "@expo-google-fonts/work-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ClerkLoaded, ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";

import { AuthBridge } from "@/components/AuthBridge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { NotificationTapHandler } from "@/components/NotificationTapHandler";
import { ReviewPromptGate } from "@/components/ReviewPrompt";
import { configureApi } from "@/lib/api";
import { LeaderboardConsentProvider } from "@/lib/leaderboardConsent";
import { configureNotificationHandler } from "@/lib/notifications";
import { LocalReviewAuthProvider } from "@/lib/localReviewAuth";

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

SplashScreen.preventAutoHideAsync();

configureApi();
configureNotificationHandler();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen
        name="episode/[id]"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: "Back",
          title: "Episode",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Oswald_400Regular,
    Oswald_600SemiBold,
    Oswald_700Bold,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={clerkPublishableKey}
          tokenCache={tokenCache}
          proxyUrl={clerkProxyUrl}
        >
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <LocalReviewAuthProvider>
                <LeaderboardConsentProvider>
                  <AuthBridge>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <NotificationTapHandler />
                        <RootLayoutNav />
                        <ReviewPromptGate />
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </AuthBridge>
                </LeaderboardConsentProvider>
              </LocalReviewAuthProvider>
            </QueryClientProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

// Keep a no-op export so router doesn't complain about loading screens
export { LoadingScreen };
