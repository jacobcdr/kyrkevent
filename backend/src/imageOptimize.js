import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const PRESETS = {
  hero: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  gallery: { maxWidth: 1920, maxHeight: 1920, quality: 82 },
  speaker: { maxWidth: 900, maxHeight: 900, quality: 82 },
  partner: { maxWidth: 640, maxHeight: 640, quality: 85 }
};

/**
 * Resize/compress an uploaded image in place. Returns final filename (may change ext to .jpg).
 */
export async function optimizeImageFile(filePath, preset = "gallery") {
  const cfg = PRESETS[preset] || PRESETS.gallery;
  const meta = await sharp(filePath).metadata();
  const usePng = meta.format === "png" && meta.hasAlpha;
  const outExt = usePng ? ".png" : ".jpg";
  const base = filePath.replace(/\.[^.]+$/i, "");
  const outPath = `${base}${outExt}`;

  let pipeline = sharp(filePath).rotate().resize({
    width: cfg.maxWidth,
    height: cfg.maxHeight,
    fit: "inside",
    withoutEnlargement: true
  });

  if (usePng) {
    await pipeline.png({ compressionLevel: 9 }).toFile(outPath);
  } else {
    await pipeline.jpeg({ quality: cfg.quality, mozjpeg: true }).toFile(outPath);
  }

  if (path.resolve(outPath) !== path.resolve(filePath)) {
    await fs.unlink(filePath).catch(() => {});
  }

  return path.basename(outPath);
}
