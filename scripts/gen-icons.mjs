// One-off script to regenerate app icons from the new logo.png. Not part of
// the build — run manually with `node scripts/gen-icons.mjs` if the logo
// ever changes again. Deletable after use; kept for reproducibility.
import sharp from "sharp";
import { writeFileSync, copyFileSync, mkdirSync } from "node:fs";

const SRC = "logo.png";
const DARK_BG = "#0a0a0b"; // matches app/layout.tsx viewport.themeColor

mkdirSync("public", { recursive: true });
copyFileSync(SRC, "public/logo.png");

const srcMeta = await sharp(SRC).metadata();
// A logo that already ships as a square, opaque image (e.g. a club crest on
// its own solid badge background) just needs resizing — trimming/padding
// would only clip its edge-to-edge design. A logo with transparency and/or
// a non-square canvas (e.g. a bare glyph) needs to be trimmed and centered
// on a fresh square canvas instead.
const isReadySquare = srcMeta.width === srcMeta.height && !srcMeta.hasAlpha;

async function squarePng({ size, background, padPct = 0.12 }) {
  if (isReadySquare) {
    // .ico frames must be RGBA even when the source has no alpha channel —
    // without ensureAlpha() Next's image decoder rejects the embedded PNG.
    return sharp(SRC)
      .resize(size, size, { fit: "cover" })
      .ensureAlpha()
      .png()
      .toBuffer();
  }
  const inner = Math.round(size * (1 - padPct * 2));
  const trimmed = await sharp(SRC).trim().toBuffer();
  const resized = await sharp(trimmed)
    .resize(inner, inner, { fit: "contain", background })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

// app/icon.png — modern favicon + PWA icon.
const icon512 = await squarePng({
  size: 512,
  background: { r: 0, g: 0, b: 0, alpha: 0 },
});
writeFileSync("app/icon.png", icon512);

// app/apple-icon.png — iOS home screen icon. iOS composites transparency
// onto white, so the padded fallback path gets a solid background instead;
// an already-opaque square crest carries its own background as-is.
const apple180 = await squarePng({ size: 180, background: DARK_BG });
writeFileSync("app/apple-icon.png", apple180);

// favicon.ico — classic multi-size ICO, built by embedding PNG frames
// directly (supported since Vista; every modern browser reads this).
const sizes = [16, 32, 48];
const frames = await Promise.all(
  sizes.map((size) =>
    squarePng({ size, background: { r: 0, g: 0, b: 0, alpha: 0 }, padPct: 0.06 }),
  ),
);

const headerSize = 6 + 16 * frames.length;
let offset = headerSize;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(frames.length, 4);

const dirEntries = [];
frames.forEach((frame, i) => {
  const size = sizes[i];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(frame.length, 8); // bytes in resource
  entry.writeUInt32LE(offset, 12); // image offset
  offset += frame.length;
  dirEntries.push(entry);
});

writeFileSync("app/favicon.ico", Buffer.concat([header, ...dirEntries, ...frames]));

console.log(
  `Generated public/logo.png, app/icon.png, app/apple-icon.png, app/favicon.ico (mode: ${
    isReadySquare ? "direct resize (square, opaque source)" : "trim + pad (transparent/non-square source)"
  })`,
);
