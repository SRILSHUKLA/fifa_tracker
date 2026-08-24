import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon. Rendered on a filled background because iOS does not
 * respect transparency and would otherwise composite it onto white.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
        }}
      >
        <svg width="118" height="118" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.25" stroke="#e01b2b" strokeWidth="1.9" />
          <path d="M12 7.4 15.2 9.7 14 13.5h-4L8.8 9.7 12 7.4Z" fill="#e01b2b" />
        </svg>
      </div>
    ),
    size,
  );
}
