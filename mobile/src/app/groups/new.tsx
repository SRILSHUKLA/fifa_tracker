import { DetailScreen } from "@/components/screen";
import { useCreateGroup } from "@/lib/hooks";
import { useRouter } from "expo-router";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function NewGroupScreen(): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const createGroup = useCreateGroup();

  function handleSubmit() {
    if (name.trim().length < 2) return;

    createGroup.mutate(name.trim(), {
      // Replace so back from the new group skips the form.
      onSuccess: (group) => router.replace(`/groups/${group.id}`),
    });
  }

  return (
    <DetailScreen
      title="Create a group"
      subtitle="You'll get an invite code and link to share with up to 11 friends."
      backLabel="Groups"
    >
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">Group name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Sunday League"
          maxLength={40}
          autoFocus
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          className="h-12 rounded-xl border border-border bg-surface px-3 text-[15px] text-foreground"
          placeholderTextColor="#71717a"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create group"
        disabled={createGroup.isPending || name.trim().length < 2}
        onPress={handleSubmit}
        className={`mt-6 h-12 items-center justify-center rounded-xl bg-accent active:opacity-80 ${
          createGroup.isPending || name.trim().length < 2 ? "opacity-50" : ""
        }`}
      >
        <Text className="text-base font-semibold text-accent-foreground">
          {createGroup.isPending ? "Creating…" : "Create group"}
        </Text>
      </Pressable>
    </DetailScreen>
  );
}
