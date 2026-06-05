import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const svgBuffer = readFileSync(join(root, "public", "icons", "icon.svg"));

// Android mipmap densities: dp size → actual px (at density)
const densities = [
  { dir: "mipmap-mdpi",     size: 48 },
  { dir: "mipmap-hdpi",     size: 72 },
  { dir: "mipmap-xhdpi",    size: 96 },
  { dir: "mipmap-xxhdpi",   size: 144 },
  { dir: "mipmap-xxxhdpi",  size: 192 },
];

async function main() {
  const base = join(root, "android", "app", "src", "main", "res");

  for (const { dir, size } of densities) {
    const outDir = join(base, dir);
    mkdirSync(outDir, { recursive: true });

    // Foreground icon (without background — for adaptive icon fallback)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(outDir, "ic_launcher_foreground.png"));
    console.log(`Generated ${dir}/ic_launcher_foreground.png (${size}x${size})`);

    // Round icon (same foreground, will be masked by the OS)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(outDir, "ic_launcher_round.png"));
    console.log(`Generated ${dir}/ic_launcher_round.png (${size}x${size})`);
  }

  console.log("\nAll Android launcher icons generated.");
}

main().catch(console.error);
