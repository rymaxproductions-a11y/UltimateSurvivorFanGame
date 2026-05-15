import { Link, Redirect, useRouter } from "expo-router";
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
import { useAuth } from "@/lib/localAuth";

type Mode = "landing" | "sign-in" | "sign-up";

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isSignedIn, isLoaded, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("landing");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoaded && isSignedIn) return <Redirect href="/" />;

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (err: any) {
      setError(extractError(err) ?? "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp() {
    if (!username.trim()) {
      setError("Please choose a player nickname.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp(email.trim(), password, username.trim());
      router.replace("/");
    } catch (err: any) {
      setError(extractError(err) ?? "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  const isSignUp = mode === "sign-up";
  const heading = isSignUp ? "Join the tribe" : "Welcome back";
  const subheading = isSignUp
    ? "Create an account to make picks and track your score."
    : "Sign in to make picks and climb the leaderboard.";

  if (mode === "landing") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            paddingTop: 40,
            paddingBottom: 40,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <Logo size={72} />
            <Heading level={2} style={{ marginTop: 16, textAlign: "center" }}>
              Ultimate Survivor Fan Game
            </Heading>
            <Body muted style={{ marginTop: 8, textAlign: "center" }}>
              Predict weekly outcomes, pick your winner, and climb the leaderboard.
            </Body>
          </View>

          <View style={{ width: "100%", gap: 12 }}>
            <Button
              label="New Player"
              onPress={() => {
                setError(null);
                setMode("sign-up");
              }}
              fullWidth
            />
            <Button
              label="Existing Player"
              variant="secondary"
              onPress={() => {
                setError(null);
                setMode("sign-in");
              }}
              fullWidth
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
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
          <Pressable
            onPress={() => {
              setError(null);
              setMode("landing");
            }}
            style={{ alignSelf: "flex-start", marginBottom: 16 }}
          >
            <Body muted>← Back</Body>
          </Pressable>
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
            {isSignUp && (
              <Input
                label="Player nickname"
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
              placeholder={isSignUp ? "Create a password (8+ chars)" : "••••••••"}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Button
              label={isSignUp ? "Create Account" : "Sign In"}
              loading={busy}
              onPress={isSignUp ? handleSignUp : handleSignIn}
              fullWidth
            />

            {error ? (
              <Body style={{ color: colors.destructive, textAlign: "center", marginTop: 4 }}>
                {error}
              </Body>
            ) : null}

            <Pressable
              onPress={() => {
                setError(null);
                setMode(isSignUp ? "sign-in" : "sign-up");
              }}
              style={{ marginTop: 16 }}
            >
              <Body muted style={{ textAlign: "center" }}>
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </Body>
            </Pressable>

            {!isSignUp && (
              <Link href={"/forgot-password" as any} asChild>
                <Pressable style={{ marginTop: 4 }}>
                  <Body muted style={{ textAlign: "center" }}>
                    Forgot password?
                  </Body>
                </Pressable>
              </Link>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function extractError(err: any): string | null {
  // Orval mutator throws fetch Response or Error with response body.
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err?.error) return err.error;
  if (err?.message) return err.message;
  return null;
}
