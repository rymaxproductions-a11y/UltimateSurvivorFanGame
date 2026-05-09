import { useAuth, useSignIn, useSignUp } from "@clerk/clerk-expo";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
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

type Mode = "sign-in" | "sign-up" | "verify-sign-in" | "verify-sign-up";

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

  // ── Sign-in: email → code (no password on mobile) ──────────────────────
  async function handleRequestSignInCode() {
    if (!signIn) return;
    setBusy(true);
    setError(null);
    try {
      // Create the sign-in attempt to discover supported factors.
      const attempt = await signIn.create({ identifier: email.trim() });

      const factors: any[] = (attempt.supportedFirstFactors as any[]) ?? [];
      const emailFactor = factors.find((f: any) => f.strategy === "email_code");

      if (!emailFactor?.emailAddressId) {
        setError(
          "This account doesn't support email-code sign-in. Please use the web app to sign in.",
        );
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });

      setCode("");
      setMode("verify-sign-in");
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Could not send code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifySignIn() {
    if (!signIn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: code.trim(),
      });
      if (res.status === "complete") {
        await setActiveSignIn({ session: res.createdSessionId });
        router.replace("/");
      } else {
        setError(`Verification incomplete (${res.status}).`);
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  // ── Sign-up: email + password + optional username ───────────────────────
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
      setMode("verify-sign-up");
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifySignUp() {
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
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  // ── Derived UI state ────────────────────────────────────────────────────
  const isVerifying = mode === "verify-sign-in" || mode === "verify-sign-up";
  const isSignUp = mode === "sign-up" || mode === "verify-sign-up";

  const heading = isVerifying
    ? "Verify your email"
    : isSignUp
    ? "Join the tribe"
    : "Welcome back";

  const subheading = isVerifying
    ? "Enter the 6-digit code we just emailed you."
    : isSignUp
    ? "Create an account to make picks and track your score."
    : "Enter your email and we'll send you a sign-in code.";

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
              {heading}
            </Heading>
            <Body muted style={{ marginTop: 8, textAlign: "center" }}>
              {subheading}
            </Body>
          </View>

          <View style={{ gap: 14 }}>
            {isVerifying ? (
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
                  onPress={mode === "verify-sign-in" ? handleVerifySignIn : handleVerifySignUp}
                  fullWidth
                />
                <Pressable
                  onPress={() => {
                    setError(null);
                    setCode("");
                    setMode(mode === "verify-sign-in" ? "sign-in" : "sign-up");
                  }}
                >
                  <Body muted style={{ textAlign: "center", marginTop: 8 }}>
                    {mode === "verify-sign-in" ? "Back to sign in" : "Use a different email"}
                  </Body>
                </Pressable>
              </>
            ) : mode === "sign-up" ? (
              <>
                <Input
                  label="Username"
                  placeholder="jeff_probst"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
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
                  placeholder="Create a password (8+ chars)"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <Button label="Create Account" loading={busy} onPress={handleSignUp} fullWidth />
              </>
            ) : (
              <>
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <Button
                  label="Send Sign-In Code"
                  loading={busy}
                  onPress={handleRequestSignInCode}
                  fullWidth
                />
              </>
            )}

            {error ? (
              <Body style={{ color: colors.destructive, textAlign: "center", marginTop: 4 }}>
                {error}
              </Body>
            ) : null}

            {!isVerifying && (
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
