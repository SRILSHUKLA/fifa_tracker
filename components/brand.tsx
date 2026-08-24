import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Wordmark. The glyph is the app logo (public/logo.png) rather than an
 * inline SVG — see scripts/gen-icons.mjs for how the icon variants
 * (favicon, PWA icon, apple-icon) are derived from the same source file.
 */
export function Brand({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = {
    sm: "size-7",
    md: "size-9",
    lg: "size-12",
  }[size];

  const px = {
    sm: 28,
    md: 36,
    lg: 48,
  }[size];

  const text = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt=""
        width={px}
        height={px}
        priority
        className={cn("shrink-0 object-contain", dimensions)}
      />
      <span className={cn("font-semibold tracking-tight", text)}>
        Bragging<span className="text-primary"> Rights</span>
      </span>
    </div>
  );
}
