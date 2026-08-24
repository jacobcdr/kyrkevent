import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const PRESETS = {
  hero: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  gallery: { maxWidth: 1920, maxHeight: 1920, quality: 82 },
  speaker: { maxWidth: 900, maxHeight: 900, quality: 82 },
  partner: { maxWidth: 640, maxHeight: 640, quality: 85 }
};

const HERO_MIN_HEIGHT_RATIO = 0.35;

const HERO_PORTRAIT_ERROR =
  "Eventbilden får inte vara högre än den är bred. Välj en liggande eller kvadratisk bild.";

const HERO_TOO_WIDE_ERROR =
  "Eventbilden är för låg i förhållande till bredden. Höjden måste vara minst 35 % av bredden (t.ex. minst 420 px på en 1200 px bred bild).";

function validateHeroImageDimensions(width, height) {
  if (width <= 0 || height <= 0) {
    throw new Error("Kunde inte läsa bildens mått.");
  }
  if (height > width) {
    throw new Error(HERO_PORTRAIT_ERROR);
  }
  if (height < width * HERO_MIN_HEIGHT_RATIO) {
    throw new Error(HERO_TOO_WIDE_ERROR);
  }
  return { width, height };
}

/** Reject hero images taller than wide or too wide/flat (height must be >= 35% of width). */
export async function assertHeroImageAspectRatio(filePath) {
  const { width = 0, height = 0 } = await sharp(filePath).rotate().metadata();
  return validateHeroImageDimensions(width, height);
}

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
