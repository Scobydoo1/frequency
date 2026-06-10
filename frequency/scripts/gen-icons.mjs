/* Rasterize the design's two-lights thumbnail motif into PWA icons. */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

// glow-rich version for raster icons (radial gradients don't carry from the tiny favicon)
const icon = (pad) => Buffer.from(`
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#0d0b1f"/>
      <stop offset="100%" stop-color="#05040d"/>
    </radialGradient>
    <radialGradient id="you" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f4b860" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#f4b860" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="them" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#9fc6ff" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#9fc6ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg)"/>
  <g transform="translate(50 50) scale(${1 - pad}) translate(-50 -50)">
    <circle cx="22" cy="30" r="1" fill="#9fc6ff" opacity="0.6"/>
    <circle cx="78" cy="70" r="1.2" fill="#9fc6ff" opacity="0.5"/>
    <circle cx="50" cy="22" r="0.9" fill="#dff1ff" opacity="0.5"/>
    <circle cx="80" cy="26" r="0.8" fill="#dff1ff" opacity="0.4"/>
    <circle cx="18" cy="76" r="0.9" fill="#9fc6ff" opacity="0.4"/>
    <path d="M34 56 Q50 40 66 42" stroke="#dff1ff" stroke-width="1.2" fill="none" opacity="0.85"/>
    <circle cx="34" cy="56" r="16" fill="url(#you)"/>
    <circle cx="66" cy="42" r="12" fill="url(#them)"/>
    <circle cx="34" cy="56" r="3.4" fill="#f4b860"/>
    <circle cx="34" cy="56" r="1.6" fill="#ffffff"/>
    <circle cx="66" cy="42" r="2.6" fill="#9fc6ff"/>
  </g>
</svg>`);

const jobs = [
  ["pwa-192.png", 192, 0],
  ["pwa-512.png", 512, 0],
  ["pwa-512-maskable.png", 512, 0.2], // safe zone for maskable
  ["apple-touch-icon.png", 180, 0],
];

for (const [name, size, pad] of jobs) {
  await sharp(icon(pad), { density: 300 }).resize(size, size).png().toFile(path.join(pub, name));
  console.log("wrote", name);
}
