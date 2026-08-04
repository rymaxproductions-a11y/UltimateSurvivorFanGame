import { useAuth as useClerkAuth, useSignIn, useSignUp } from "@clerk/expo";
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
import { getMe, updateMyProfile } from "@workspace/api-client-react";

type Mode = "landing" | "sign-in" | "sign-up" | "verify" | "signin-code";

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { signIn, errors: signInErrors, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpFetchStatus } = useSignUp();

  const [mode, setMode] = useState<Mode>("landing");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoaded && isSignedIn) return <Redirect href="/" />;

  // After the Clerk session is active: provision/link the server-side user
  // row, apply the chosen nickname on fresh sign-ups, then enter the app.
  async function completeAndEnter(nickname?: string) {
    try {
      await getMe(); // JIT-provisions (or links) the user row
      if (nickname) {
        await updateMyProfile({ displayName: nickname });
      }
    } catch {
      // Non-fatal — the app will retry /users/me on the dashboard.
    }
    router.replace("/");
  }

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await signIn.password({
        emailAddress: email.trim().toLowerCase(),
        password,
      });
      if (err) {
        // Account exists but has no password (e.g. created on the web with
        // Google or an emailed code) — fall back to a sign-in code by email.
        if (isStrategyNotValidError(err)) {
          await startEmailCodeSignIn();
          return;
        }
        setError(clerkErrorMessage(err) ?? "Incorrect email or password.");
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: async () => {
            await completeAndEnter();
          },
        });
      } else {
        setError("Additional verification is required. Please sign in on the web app.");
      }
    } catch (err: any) {
      setError(clerkErrorMessage(err) ?? "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  // Password isn't available for this account — email a one-time sign-in
  // code instead (works for accounts created on the web without a password).
  async function startEmailCodeSignIn() {
    const emailAddress = email.trim().toLowerCase();
    if (!emailAddress) {
      setError("Please enter your email first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await signIn.emailCode.sendCode({ emailAddress });
      if (err) {
        setError(clerkErrorMessage(err) ?? "Could not send a sign-in code.");
        return;
      }
      setCode("");
      setMode("signin-code");
    } catch (err: any) {
      setError(clerkErrorMessage(err) ?? "Could not send a sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifySignInCode() {
    if (!code.trim()) {
      setError("Please enter the code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await signIn.emailCode.verifyCode({ code: code.trim() });
      if (err) {
        setError(clerkErrorMessage(err) ?? "Invalid or expired code. Please try again.");
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: async () => {
            await completeAndEnter();
          },
        });
      } else {
        setError("Additional verification is required. Please sign in on the web app.");
      }
    } catch (err: any) {
      setError(clerkErrorMessage(err) ?? "Verification failed.");
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
      const { error: err } = await signUp.password({
        emailAddress: email.trim().toLowerCase(),
        password,
      });
      if (err) {
        setError(clerkErrorMessage(err) ?? "Could not create account.");
        return;
      }
      await signUp.verifications.sendEmailCode();
      setMode("verify");
    } catch (err: any) {
      setError(clerkErrorMessage(err) ?? "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!code.trim()) {
      setError("Please enter the code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: async () => {
            await completeAndEnter(username.trim());
          },
        });
      } else {
        setError("Invalid or expired code. Please try again.");
      }
    } catch (err: any) {
      setError(clerkErrorMessage(err) ?? "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  const isSignUp = mode === "sign-up";
  const heading =
    mode === "verify" || mode === "signin-code"
      ? "Check your email"
      : isSignUp
        ? "Join the tribe"
        : "Welcome back";
  const subheading =
    mode === "signin-code"
      ? `This account signs in with an emailed code. We sent a 6-digit code to ${email.trim()} — enter it below.`
      : mode === "verify"
      ? `We sent a 6-digit code to ${email.trim()}. Enter it below to verify your account.`
      : isSignUp
        ? "Create an account to make picks and track your score. One account works on web and mobile."
        : "Sign in with the same account you use on the web app.";

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
              Outwit, Outplay and Outlast the Competition!
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
              setCode("");
              setMode(mode === "verify" ? "sign-up" : mode === "signin-code" ? "sign-in" : "landing");
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

          {mode === "signin-code" ? (
            <View style={{ gap: 14 }}>
              <Input
                label="Sign-in code"
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
                value={code}
                onChangeText={setCode}
              />
              <Button label="Sign In" loading={busy} onPress={handleVerifySignInCode} fullWidth />
              <Pressable onPress={startEmailCodeSignIn} style={{ marginTop: 8 }}>
                <Body muted style={{ textAlign: "center" }}>
                  Didn't get it? Send a new code
                </Body>
              </Pressable>
              {error ? (
                <Body style={{ color: colors.destructive, textAlign: "center", marginTop: 4 }}>
                  {error}
                </Body>
              ) : null}
            </View>
          ) : mode === "verify" ? (
            <View style={{ gap: 14 }}>
              <Input
                label="Verification code"
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
                value={code}
                onChangeText={setCode}
              />
              <Button label="Verify & Start Playing" loading={busy} onPress={handleVerify} fullWidth />
              <Pressable
                onPress={async () => {
                  setError(null);
                  try {
                    await signUp.verifications.sendEmailCode();
                  } catch (err: any) {
                    setError(clerkErrorMessage(err) ?? "Could not resend code.");
                  }
                }}
                style={{ marginTop: 8 }}
              >
                <Body muted style={{ textAlign: "center" }}>
                  Didn't get it? Send a new code
                </Body>
              </Pressable>
              {error ? (
                <Body style={{ color: colors.destructive, textAlign: "center", marginTop: 4 }}>
                  {error}
                </Body>
              ) : null}
            </View>
          ) : (
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
                loading={busy || signInFetchStatus === "fetching" || signUpFetchStatus === "fetching"}
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
                <>
                  <Pressable onPress={startEmailCodeSignIn} style={{ marginTop: 4 }}>
                    <Body muted style={{ textAlign: "center" }}>
                      Email me a sign-in code instead
                    </Body>
                  </Pressable>
                  <Link href={"/forgot-password" as any} asChild>
                    <Pressable style={{ marginTop: 4 }}>
                      <Body muted style={{ textAlign: "center" }}>
                        Forgot password?
                      </Body>
                    </Pressable>
                  </Link>
                </>
              )}

              {/* Required for sign-up flows — Clerk's bot protection mounts here. */}
              {isSignUp && <View nativeID="clerk-captcha" />}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Clerk returns this when the requested first factor (e.g. password) isn't
// available for the account — typically an account created without a password.
function isStrategyNotValidError(err: any): boolean {
  const code = err?.code ?? err?.errors?.[0]?.code;
  if (code === "strategy_for_user_invalid") return true;
  const msg = clerkErrorMessage(err) ?? "";
  return /verification strategy is not valid/i.test(msg);
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
