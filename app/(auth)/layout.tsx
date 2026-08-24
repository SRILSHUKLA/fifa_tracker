import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      {/* Soft red glow behind the card — the only decoration in the app. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,var(--primary)_0%,transparent_70%)] opacity-[0.14]"
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand size="lg" />
        </div>
        {children}
      </div>
    </div>
  );
}
