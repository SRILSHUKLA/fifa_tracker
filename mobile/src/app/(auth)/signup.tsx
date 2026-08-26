import { useRouter } from "expo-router";
import { AlertCircle } from "lucide-react-native";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Input } from "heroui-native";

import { Brand } from "@/components/brand";
import { supabase } from "@/lib/supabase";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function SignupScreen(): JSX.Element {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Live username availability — the same RPC the web app's signup uses.
  const usernameValid = USERNAME_RE.test(username);
  useEffect(() => {
    if (!usernameValid) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc("is_username_available", {
        u: username,
      });
      if (!cancelled && data === false) {
        setError(`@${username} is already taken.`);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, usernameValid]);

  const canSubmit = useMemo(
    () => usernameValid && email.includes("@") && password.length >= 6,
    [usernameValid, email, password],
  );

  async function handleSubmit() {
    setError(null);

    if (!USERNAME_RE.test(username)) {
      setError("Usernames are 3–20 letters, numbers or underscores.");
      return;
    }

    setPending(true);
    const check = await supabase.rpc("is_username_available", {
      u: username.trim(),
    });
    if (check.data === false) {
      setPending(false);
      setError(`@${username} is already taken.`);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    });
    setPending(false);

    if (authError) {
      setError(
        authError.message.includes("already registered")
          ? "That email already has an account — try signing in."
          : "Could not create your account. Try again.",
      );
      return;
    }

    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-5 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-md self-center rounded-2xl border border-border bg-surface p-6">
          <View className="items-center">
            <Brand size="md" />
          </View>

          <View className="mt-8 gap-4">
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">
                Username
              </Text>
              <Input
                value={username}
                onChangeText={(text) =>
                  setUsername(text.replace(/[^a-zA-Z0-9_]/g, ""))
                }
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
                maxLength={20}
                placeholder="rooney_07"
                className="h-12"
              />
              <Text className="text-xs text-muted">
                This is how friends will find you.
              </Text>
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Email</Text>
              <Input
                value={email}
                onChangeText={setEmail}
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="you@example.com"
                className="h-12"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">
                Password
              </Text>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder="At least 6 characters"
                onSubmitEditing={() => {
                  if (canSubmit) void handleSubmit();
                }}
                returnKeyType="done"
                className="h-12"
              />
            </View>

            {error && (
              <View className="flex-row items-start gap-2 rounded-lg bg-danger/10 px-3 py-2.5">
                <AlertCircle
                  size={15}
                  color="#ef4444"
                  strokeWidth={2}
                  style={{ marginTop: 2 }}
                />
                <Text className="min-w-0 flex-1 text-sm leading-5 text-loss">
                  {error}
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create account"
              disabled={pending || !canSubmit}
              onPress={handleSubmit}
              className={`h-12 items-center justify-center rounded-xl bg-accent active:opacity-80 ${
                pending || !canSubmit ? "opacity-50" : ""
              }`}
            >
              <Text className="text-base font-semibold text-accent-foreground">
                {pending ? "Creating…" : "Create account"}
              </Text>
            </Pressable>

            <View className="flex-row items-center justify-center pt-2">
              <Text className="text-sm text-muted">Already have one? </Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Sign in"
                hitSlop={6}
                onPress={() => router.push("/login")}
              >
                <Text className="text-sm font-semibold text-accent">
                  Sign in
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
