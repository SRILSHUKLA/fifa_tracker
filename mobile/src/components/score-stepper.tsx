import { Minus, Plus } from "lucide-react-native";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";

const MAX_SCORE = 99;

/**
 * Score input built for thumbs: two large tap targets and a big number.
 * Deliberately not a bare numeric field — on a sofa with a controller in
 * hand, tapping twice beats summoning the keyboard for "2".
 */
export function ScoreStepper({
  label,
  value,
  onChange,
  highlight = false,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  /** Tints the number brand red — marks the current leader. */
  highlight?: boolean;
  compact?: boolean;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(MAX_SCORE, n));
  const [editing, setEditing] = useState<string | null>(null);

  const buttonSize = compact ? 36 : 44;
  const iconSize = compact ? 16 : 20;

  return (
    <View className="flex-col items-center gap-2">
      <Text
        numberOfLines={1}
        className="max-w-[144px] text-xs font-medium uppercase tracking-wide text-muted"
      >
        {label}
      </Text>

      <View
        className="flex-row items-center"
        style={{ gap: compact ? 6 : 10 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label} score`}
          disabled={value <= 0}
          onPress={() => onChange(clamp(value - 1))}
          className={`items-center justify-center rounded-full bg-default ${
            value <= 0 ? "opacity-40" : ""
          }`}
          style={{ width: buttonSize, height: buttonSize }}
        >
          <Minus size={iconSize} color="#fafafa" strokeWidth={2.25} />
        </Pressable>

        <TextInput
          accessibilityLabel={`${label} score`}
          inputMode="numeric"
          keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
          value={editing ?? String(value)}
          onChangeText={(text) => {
            setEditing(text);
            const parsed = Number.parseInt(text, 10);
            if (!Number.isNaN(parsed)) onChange(clamp(parsed));
          }}
          onFocus={() => setEditing(String(value))}
          onEndEditing={() => setEditing(null)}
          selectTextOnFocus
          maxLength={2}
          className={`bg-transparent text-center font-bold ${
            compact ? "w-10 text-2xl" : "w-14 text-4xl"
          } ${highlight ? "text-accent" : "text-foreground"}`}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label} score`}
          disabled={value >= MAX_SCORE}
          onPress={() => onChange(clamp(value + 1))}
          className={`items-center justify-center rounded-full bg-default ${
            value >= MAX_SCORE ? "opacity-40" : ""
          }`}
          style={{ width: buttonSize, height: buttonSize }}
        >
          <Plus size={iconSize} color="#fafafa" strokeWidth={2.25} />
        </Pressable>
      </View>
    </View>
  );
}
