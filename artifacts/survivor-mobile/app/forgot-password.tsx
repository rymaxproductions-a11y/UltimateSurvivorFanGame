import { useSignIn } from "@clerk/expo";
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

type Step = "request" | "reset";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn } = useSignIn();

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
    setInfo(null);
    try {
      const { error: createErr } = await signIn.create({
        identifier: email.trim().toLowerCase(),
      });
      if (createErr) {
        setError(clerkErrorMessage(createErr) ?? "Could not find that account.");
        return;
      }
      const { error: sendErr } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendErr) {
        setError(clerkErrorMessage(sendErr) ?? "Could not send reset code.");
        return;
      }
      setInfo("We've sent a 6-digit reset code to your email.");
      setStep("reset");
    } catch (err: any) {
      setError(clerkErrorMessage(err) ?? "Could not send reset code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!code.trim()) {
      setError("Please enter the code from your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: verifyErr } = await signIn.resetPasswordEmailCode.verifyCode({
        code: code.trim(),
      });
      if (verifyErr) {
        setError(clerkErrorMessage(verifyErr) ?? "Invalid or expired code.");
        return;
      }
      const { error: submitErr } = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      });
      if (submitErr) {
        setError(clerkErrorMessage(submitErr) ?? "Could not reset password.");
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: () => {
            router.replace("/");
          },
        });
      } else {
        // Password was reset but a session wasn't created — send them to sign in.
        router.replace("/sign-in");
      }
    } catch (err: any) {
      setError(clerkErrorMessage(err) ?? "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Logo size={56} />
            <Heading level={2} style={{ marginTop: 24, textAlign: "center" }}>
              Reset your password
            </Heading>
            <Body muted style={{ marginTop: 8, textAlign: "center" }}>
              {step === "request"
                ? "Enter your account email and we'll send you a 6-digit reset code."
                : "Enter the code from your email and choose a new password."}
            </Body>
          </View>

          {info ? (
            <Body style={{ textAlign: "center", marginBottom: 16 }}>{info}</Body>
          ) : null}

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
              <Input
                label="6-digit code"
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
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

function clerkErrorMessage(err: any): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  const clerkErr = err?.errors?.[0];
  if (clerkErr?.longMessage) return clerkErr.longMessage;
  if (clerkErr?.message) return clerkErr.message;
  if (err?.longMessage) return err.longMessage;
  if (err?.message) return err.message;
  return null;
}
