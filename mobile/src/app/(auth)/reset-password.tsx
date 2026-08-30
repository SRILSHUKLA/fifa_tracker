import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle } from "lucide-react-native";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

/**
 * Landed on from the "Reset Password" email link (bragging-rights:///reset-
 * password?code=… — see forgot-password.tsx's redirectTo and lib/supabase.ts's
 * flowType: "pkce", which is what puts a plain `?code=` query param in the
 * link rather than tokens after a `#` that route params can't see).
 *
 * `exchangeCodeForSession` establishes a real session from that code, which
 * is what lets `updateUser` below actually change the password. The auth
 * _layout normally bounces a signed-in user away from every screen in this
 * group — it special-cases this route so that session doesn't kick the user
 * out before they get to set a new password.
 */
export default function ResetPasswordScreen(): JSX.Element {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();

  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!code) {
        setVerifyError("This reset link is invalid.");
        setVerifying(false);
        return;
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (exchangeError) {
        setVerifyError("This reset link has expired or was already used.");
      }
      setVerifying(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleSubmit() {
    setError(null);

    if (password.length < 6) {
      setError("Use a password of at least 6 characters.");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setPending(false);

    if (updateError) {
      setError("Could not update your password. Try again.");
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

          {verifying ? (
            <View className="mt-8 items-center gap-3 py-6">
              <ActivityIndicator color="#e2402f" />
              <Text className="text-sm text-muted">Checking your link…</Text>
            </View>
          ) : verifyError ? (
            <View className="mt-8 items-center gap-4">
              <View className="w-full flex-row items-start gap-2 rounded-lg bg-danger/10 px-3 py-2.5">
                <AlertCircle
                  size={15}
                  color="#ef4444"
                  strokeWidth={2}
                  style={{ marginTop: 2 }}
                />
                <Text className="min-w-0 flex-1 text-sm leading-5 text-loss">
                  {verifyError}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Request a new link"
                onPress={() => router.replace("/forgot-password")}
                className="h-12 w-full items-center justify-center rounded-xl border border-border active:opacity-80"
              >
                <Text className="text-base font-semibold text-foreground">
                  Request a new link
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-8 gap-4">
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-foreground">
                  New password
                </Text>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  placeholder="At least 6 characters"
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
                accessibilityLabel="Update password"
                disabled={pending}
                onPress={handleSubmit}
                className={`h-12 items-center justify-center rounded-xl bg-accent active:opacity-80 ${
                  pending ? "opacity-60" : ""
                }`}
              >
                <Text className="text-base font-semibold text-accent-foreground">
                  {pending ? "Updating…" : "Update password"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
