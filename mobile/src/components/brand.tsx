import { Image, Text, View } from "react-native";

const SIZES = {
  sm: { glyph: 28, text: "text-base" },
  md: { glyph: 36, text: "text-lg" },
  lg: { glyph: 48, text: "text-2xl" },
} as const;

/** Wordmark — the app logo next to "Bragging Rights" (Rights in brand red). */
export function Brand({
  size = "sm",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const dims = SIZES[size];

  return (
    <View className={`flex-row items-center gap-2.5 ${className}`}>
      <Image
        source={require("@/assets/images/logo.png")}
        className="shrink-0"
        style={{ width: dims.glyph, height: dims.glyph, resizeMode: "contain" }}
      />
      <Text
        className={`font-semibold tracking-tight text-foreground ${dims.text}`}
      >
        Bragging<Text className="text-accent"> Rights</Text>
      </Text>
    </View>
  );
}
