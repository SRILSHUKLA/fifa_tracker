import { useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { DetailScreen } from "@/components/screen";
import { useJoinGroup } from "@/lib/hooks";

/**
 * Target of a shared invite code — prefills the field so confirming is the
 * whole flow. The join itself goes through the same RPC as manual entry.
 */
export default function JoinGroupByCodeScreen(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const defaultCode =
    typeof params.code === "string"
      ? decodeURIComponent(params.code).toUpperCase()
      : "";

  const [code, setCode] = useState(defaultCode);
  const joinGroup = useJoinGroup();

  function handleSubmit() {
    if (!code.trim()) return;

    joinGroup.mutate(code.trim(), {
      onSuccess: (group) => router.replace(`/groups/${group.id}`),
    });
  }

  return (
    <DetailScreen
      title="Join a group"
      subtitle="Confirm below to join with the invite code from your link."
      backLabel="Groups"
    >
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">Invite code</Text>
        <TextInput
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          placeholder="ABCD1234"
          maxLength={8}
          autoCapitalize="characters"
          autoFocus={!defaultCode}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          className="h-12 rounded-xl border border-border bg-surface px-3 text-[15px] tracking-[6px] text-foreground"
          placeholderTextColor="#71717a"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Join group"
        disabled={joinGroup.isPending || code.trim().length === 0}
        onPress={handleSubmit}
        className={`mt-6 h-12 items-center justify-center rounded-xl bg-accent active:opacity-80 ${
          joinGroup.isPending || code.trim().length === 0 ? "opacity-50" : ""
        }`}
      >
        <Text className="text-base font-semibold text-accent-foreground">
          {joinGroup.isPending ? "Joining…" : "Join group"}
        </Text>
      </Pressable>
    </DetailScreen>
  );
}
