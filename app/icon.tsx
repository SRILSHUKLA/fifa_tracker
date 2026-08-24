import { ImageResponse } from "next/og";

/**
 * Favicon / PWA icon, generated at build time so there is no binary asset to
 * keep in the repo. Next serves this at /icon.
 */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          color: "#e01b2b",
          fontSize: 340,
          fontWeight: 700,
        }}
      >
        <svg width="330" height="330" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.25" stroke="#e01b2b" strokeWidth="1.9" />
          <path d="M12 7.4 15.2 9.7 14 13.5h-4L8.8 9.7 12 7.4Z" fill="#e01b2b" />
        </svg>
      </div>
    ),
    size,
  );
}
