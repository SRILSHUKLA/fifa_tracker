import { useRouter } from "expo-router";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { DetailScreen } from "@/components/screen";
import { useJoinGroup } from "@/lib/hooks";

export default function JoinGroupScreen(): JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState("");
  const joinGroup = useJoinGroup();

  function handleSubmit() {
    if (!code.trim()) return;

    joinGroup.mutate(code.trim(), {
      onSuccess: (group) => {
        // Replace so back skips the entry form.
        router.replace(`/groups/${group.id}`);
      },
    });
  }

  return (
    <DetailScreen
      title="Join a group"
      subtitle="Enter the code someone shared with you."
      backLabel="Groups"
    >
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">Invite code</Text>
        <TextInput
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          placeholder="ABCD1234"
          maxLength={8}
          autoFocus
          autoCapitalize="characters"
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
