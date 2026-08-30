import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { AlertCircle, MailCheck } from "lucide-react-native";
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
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordScreen(): JSX.Element {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }

    setPending(true);
    // GoTrue's /verify redirects here with ?code=… appended (see
    // lib/supabase.ts's flowType: "pkce"). expo-router matches this to
    // reset-password.tsx from the "reset-password" path segment.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL("reset-password"),
    });
    setPending(false);
    // Always report success — Supabase does the same — so this can't be
    // used to check whether an address has an account.
    setSent(true);
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

          {sent ? (
            <View className="mt-8 items-center gap-4">
              <MailCheck size={28} color="#e2402f" strokeWidth={2} />
              <Text className="text-center text-sm leading-5 text-muted">
                If that email has an account, a reset link is on its way.
                Check your inbox — the link works once and expires after a
                while.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to sign in"
                onPress={() => router.replace("/login")}
                className="h-12 w-full items-center justify-center rounded-xl border border-border active:opacity-80"
              >
                <Text className="text-base font-semibold text-foreground">
                  Back to sign in
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-8 gap-4">
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-foreground">
                  Email
                </Text>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  placeholder="you@example.com"
                  onSubmitEditing={handleSubmit}
                  returnKeyType="send"
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
                accessibilityLabel="Send reset link"
                disabled={pending}
                onPress={handleSubmit}
                className={`h-12 items-center justify-center rounded-xl bg-accent active:opacity-80 ${
                  pending ? "opacity-60" : ""
                }`}
              >
                <Text className="text-base font-semibold text-accent-foreground">
                  {pending ? "Sending…" : "Send reset link"}
                </Text>
              </Pressable>

              <View className="flex-row items-center justify-center pt-2">
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Back to sign in"
                  hitSlop={6}
                  onPress={() => router.replace("/login")}
                >
                  <Text className="text-sm font-semibold text-accent">
                    Back to sign in
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
