import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const svgBuffer = readFileSync(join(root, "public", "icons", "icon.svg"));

const sizes = [
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
  { size: 72, name: "icon-72.png" },
  { size: 96, name: "icon-96.png" },
  { size: 128, name: "icon-128.png" },
  { size: 144, name: "icon-144.png" },
  { size: 152, name: "icon-152.png" },
  { size: 167, name: "icon-167.png" },
  { size: 180, name: "icon-180.png" },
  { size: 256, name: "icon-256.png" },
  { size: 384, name: "icon-384.png" },
];

async function main() {
  mkdirSync(join(root, "public", "icons"), { recursive: true });

  for (const { size, name } of sizes) {
    const outPath = join(root, "public", "icons", name);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${name} (${size}x${size})`);
  }

  await sharp(svgBuffer).resize(16, 16).png().toFile(join(root, "public", "favicon.ico"));
  console.log("Generated favicon.ico (16x16)");

  await sharp(svgBuffer).resize(180, 180).png().toFile(join(root, "public", "apple-touch-icon.png"));
  console.log("Generated apple-touch-icon.png (180x180)");

  const maskableSvg = svgBuffer.toString().replace('viewBox="0 0 512 512"', 'viewBox="0 0 512 512"');
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(join(root, "public", "icons", "icon-maskable-512.png"));
  console.log("Generated icon-maskable-512.png");
}

main().catch(console.error);
