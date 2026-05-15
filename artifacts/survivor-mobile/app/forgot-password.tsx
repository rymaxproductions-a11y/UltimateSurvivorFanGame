import { Link, useRouter } from "expo-router";
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
import { forgotPassword, resetPassword } from "@workspace/api-client-react";
import { useAuth } from "@/lib/localAuth";

type Step = "request" | "reset";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const { hydrateFromTokenAndUser } = useAuth();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleRequest() {
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await forgotPassword({ email: email.trim() });
      setInfo(r.message);
      setStep("reset");
    } catch (err: any) {
      setError(extractError(err) ?? "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (code.length !== 6) {
      setError("Code must be 6 digits.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await resetPassword({
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      await hydrateFromTokenAndUser(r.token, r.user as any);
      router.replace("/");
    } catch (err: any) {
      setError(extractError(err) ?? "Invalid or expired code.");
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
              {step === "request" ? "Reset your password" : "Enter reset code"}
            </Heading>
            <Body muted style={{ marginTop: 8, textAlign: "center" }}>
              {step === "request"
                ? "We'll email you a 6-digit code."
                : "Check your inbox for the 6-digit code."}
            </Body>
          </View>

          {step === "request" ? (
            <View style={{ gap: 14 }}>
              <Input
                label="Email"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Button label="Send Reset Code" loading={busy} onPress={handleRequest} fullWidth />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {info ? (
                <Body muted style={{ textAlign: "center" }}>
                  {info}
                </Body>
              ) : null}
              <Input
                label="6-Digit Code"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
              <Input
                label="New Password"
                placeholder="At least 8 characters"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Button label="Reset Password" loading={busy} onPress={handleReset} fullWidth />
              <Pressable
                onPress={() => {
                  setStep("request");
                  setCode("");
                  setNewPassword("");
                  setError(null);
                  setInfo(null);
                }}
              >
                <Body muted style={{ textAlign: "center", marginTop: 4 }}>
                  Didn't get it? Send a new code
                </Body>
              </Pressable>
            </View>
          )}

          {error ? (
            <Body style={{ color: colors.destructive, textAlign: "center", marginTop: 12 }}>
              {error}
            </Body>
          ) : null}

          <Link href={"/sign-in" as any} asChild>
            <Pressable style={{ marginTop: 24 }}>
              <Body muted style={{ textAlign: "center" }}>
                Back to sign in
              </Body>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function extractError(err: any): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err?.error) return err.error;
  if (err?.message) return err.message;
  return null;
}
