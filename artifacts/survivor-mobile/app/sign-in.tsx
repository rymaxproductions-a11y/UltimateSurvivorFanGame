import { useAuth, useSignIn, useSignUp } from "@clerk/clerk-expo";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { useColors } from "@/hooks/useColors";

type Mode = "sign-in" | "sign-up" | "verify";

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { signUp, setActive: setActiveSignUp } = useSignUp();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoaded && isSignedIn) return <Redirect href="/" />;

  async function handleSignIn() {
    if (!signIn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn.create({ identifier: email.trim(), password });
      if (res.status === "complete") {
        await setActiveSignIn({ session: res.createdSessionId });
        router.replace("/");
      } else {
        setError("Additional verification required.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp() {
    if (!signUp) return;
    setBusy(true);
    setError(null);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        username: username.trim() || undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setMode("verify");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!signUp) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (res.status === "complete") {
        await setActiveSignUp({ session: res.createdSessionId });
        router.replace("/");
      } else {
        setError("Verification incomplete.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Logo size={56} />
            <Heading level={2} style={{ marginTop: 24, textAlign: "center" }}>
              {mode === "sign-up"
                ? "Join the tribe"
                : mode === "verify"
                ? "Verify your email"
                : "Welcome back"}
            </Heading>
            <Body muted style={{ marginTop: 8, textAlign: "center" }}>
              {mode === "sign-up"
                ? "Create an account to make picks and track your score."
                : mode === "verify"
                ? "Enter the code we just emailed you."
                : "Sign in to make picks and climb the leaderboard."}
            </Body>
          </View>

          <View style={{ gap: 14 }}>
            {mode === "verify" ? (
              <>
                <Input
                  label="Verification code"
                  placeholder="123456"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  autoFocus
                />
                <Button
                  label="Verify & Sign In"
                  loading={busy}
                  onPress={handleVerify}
                  fullWidth
                />
                <Pressable onPress={() => setMode("sign-up")}>
                  <Body muted style={{ textAlign: "center", marginTop: 8 }}>
                    Use a different email
                  </Body>
                </Pressable>
              </>
            ) : (
              <>
                {mode === "sign-up" && (
                  <Input
                    label="Username"
                    placeholder="jeff_probst"
                    autoCapitalize="none"
                    value={username}
                    onChangeText={setUsername}
                  />
                )}
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <Input
                  label="Password"
                  placeholder={mode === "sign-up" ? "Create a password (8+ chars)" : "••••••••"}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <Button
                  label={mode === "sign-up" ? "Create Account" : "Sign In"}
                  loading={busy}
                  onPress={mode === "sign-up" ? handleSignUp : handleSignIn}
                  fullWidth
                />
              </>
            )}

            {error ? (
              <Body style={{ color: colors.destructive, textAlign: "center", marginTop: 4 }}>
                {error}
              </Body>
            ) : null}

            {mode !== "verify" && (
              <Pressable
                onPress={() => {
                  setError(null);
                  setMode(mode === "sign-up" ? "sign-in" : "sign-up");
                }}
                style={{ marginTop: 16 }}
              >
                <Body muted style={{ textAlign: "center" }}>
                  {mode === "sign-up"
                    ? "Already have an account? Sign in"
                    : "New here? Create an account"}
                </Body>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
