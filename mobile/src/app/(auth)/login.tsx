import { Redirect, useRouter } from "expo-router";
import { AlertCircle } from "lucide-react-native";
import type { JSX } from "react";
import { useState } from "react";
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
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function LoginScreen(): JSX.Element {
  const router = useRouter();
  const { session, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Already signed in (e.g. deep link to /login) → home.
  if (!isLoading && session) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleSubmit() {
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setPending(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);

    if (authError) {
      setError("Those details don't match an account. Try again.");
    }
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
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-foreground">
                  Password
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Forgot password?"
                  hitSlop={6}
                  onPress={() => router.push("/forgot-password")}
                >
                  <Text className="text-xs font-semibold text-accent">
                    Forgot password?
                  </Text>
                </Pressable>
              </View>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                placeholder="••••••••"
                onSubmitEditing={handleSubmit}
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
              accessibilityLabel="Sign in"
              disabled={pending}
              onPress={handleSubmit}
              className={`h-12 items-center justify-center rounded-xl bg-accent active:opacity-80 ${
                pending ? "opacity-60" : ""
              }`}
            >
              <Text className="text-base font-semibold text-accent-foreground">
                {pending ? "Signing in…" : "Sign in"}
              </Text>
            </Pressable>

            <View className="flex-row items-center justify-center pt-2">
              <Text className="text-sm text-muted">No account? </Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Create an account"
                hitSlop={6}
                onPress={() => router.push("/signup")}
              >
                <Text className="text-sm font-semibold text-accent">
                  Create one
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
