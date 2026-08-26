import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text as RNText,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Tabular numerals so scores and stat columns line up. RN has no Tailwind
 * equivalent for font-variant-numeric, hence the tiny wrapper.
 */
export function Num({
  children,
  className,
}: {
  children: string | number;
  className?: string;
}) {
  return (
    <RNText className={className} style={{ fontVariant: ["tabular-nums"] }}>
      {children}
    </RNText>
  );
}

/** Back button row used at the top of pushed screens. */
export function BackButton({ label }: { label: string }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      onPress={() => router.back()}
      className="flex-row items-center gap-1 self-start rounded-lg py-1 pr-2 active:opacity-60"
    >
      <ChevronLeft size={18} className="text-muted" strokeWidth={2} />
      <RNText className="text-sm font-medium text-muted">{label}</RNText>
    </Pressable>
  );
}

/**
 * The standard screen scaffold for pushed screens: safe-area aware, a fixed
 * back header, and a keyboard-aware scroll body. Mirrors the web app's
 * max-w-lg content column.
 */
export function DetailScreen({
  title,
  subtitle,
  backLabel = "Back",
  children,
}: {
  title: string;
  subtitle?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <View style={{ paddingTop: insets.top }} className="bg-background/95">
        <View className="h-12 flex-row items-center justify-between gap-2 px-4">
          <BackButton label={backLabel} />
        </View>
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-16 pt-1"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustsScrollIndicatorInsets
      >
        <View className="mb-5">
          <RNText
            numberOfLines={1}
            className="text-[26px] leading-8 font-bold tracking-tight text-foreground"
          >
            {title}
          </RNText>
          {subtitle && (
            <RNText className="mt-0.5 text-sm text-muted">{subtitle}</RNText>
          )}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Scrollable body for tab screens — the header is rendered separately by
 * each tab so it can vary per tab while keeping one shared scroll shell.
 */
export function TabBody({
  children,
  refreshing,
  onRefresh,
  bottomInset = 96,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  bottomInset?: number;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor="#a1a1aa"
            progressBackgroundColor="#17171a"
          />
        ) : undefined
      }
      contentContainerClassName="px-4 pb-24 pt-2"
      style={{ flex: 1 }}
    >
      {children}
    </ScrollView>
  );
}
