import { Button, Dialog } from "heroui-native";
import { Copy, RefreshCw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";

import { toast } from "@/lib/toast";
import { useRegenerateInviteCode } from "@/lib/hooks";

/**
 * Invite code display plus a copy button, so getting up to eleven friends
 * into a group is two taps each. The owner can also regenerate the code
 * behind a confirm dialog — it invalidates every code already shared.
 */
export function InviteShare({
  groupId,
  inviteCode,
  isOwner,
}: {
  groupId: string;
  inviteCode: string;
  isOwner: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const regenerate = useRegenerateInviteCode(groupId);

  async function copy(text: string, label: string) {
    try {
      await Clipboard.setStringAsync(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy", "Clipboard access was blocked.");
    }
  }

  return (
    <View className="gap-3 rounded-xl border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Invite code
          </Text>
          <Text className="text-xl font-semibold tracking-[6px] text-foreground">
            {inviteCode}
          </Text>
        </View>

        {isOwner && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Regenerate invite code"
            onPress={() => setDialogOpen(true)}
            hitSlop={8}
            className="rounded-lg border border-border p-2.5 active:opacity-60"
          >
            <RefreshCw size={16} color="#a1a1aa" strokeWidth={2} />
          </Pressable>
        )}
      </View>

      <Button
        variant="outline"
        className="h-11"
        onPress={() => copy(inviteCode, "Code")}
      >
        <View className="flex-row items-center gap-2">
          <Copy size={15} color="#fafafa" />
          <Text className="text-sm font-medium text-foreground">
            Share this code with friends
          </Text>
        </View>
      </Button>

      <Dialog isOpen={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="max-w-[320px] self-center">
            <Dialog.Title>Regenerate the invite code?</Dialog.Title>
            <Dialog.Description>
              Anyone with the current code will no longer be able to join.
              Members already in the group are not affected.
            </Dialog.Description>

            <View className="mt-5 flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                isDisabled={regenerate.isPending}
                onPress={() =>
                  regenerate.mutate(undefined, {
                    onSuccess: () => setDialogOpen(false),
                  })
                }
              >
                {regenerate.isPending ? "…" : "Regenerate"}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
