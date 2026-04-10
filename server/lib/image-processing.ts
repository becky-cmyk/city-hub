import sharp from "sharp";
import path from "path";
import fs from "fs";

const PROCESSED_DIR = path.join(process.cwd(), "uploads", "processed");
if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

export interface ImageVariants {
  original: string;
  hero: string;
  card: string;
  square: string;
  thumb: string;
}

interface VariantConfig {
  key: keyof Omit<ImageVariants, "original">;
  width: number;
  height: number;
  fit: keyof sharp.FitEnum;
}

const VARIANTS: VariantConfig[] = [
  { key: "hero", width: 1600, height: 900, fit: "cover" },
  { key: "card", width: 800, height: 450, fit: "cover" },
  { key: "square", width: 600, height: 600, fit: "cover" },
  { key: "thumb", width: 300, height: 300, fit: "cover" },
];

export async function processUploadedImage(
  filePath: string,
  originalFilename: string
): Promise<ImageVariants> {
  const baseName = path.basename(originalFilename, path.extname(originalFilename));
  const timestamp = Date.now();
  const originalUrl = `/uploads/${path.basename(filePath)}`;

  const variants: Partial<ImageVariants> = { original: originalUrl };

  for (const variant of VARIANTS) {
    const outputName = `${timestamp}-${baseName}-${variant.key}.webp`;
    const outputPath = path.join(PROCESSED_DIR, outputName);

    try {
      await sharp(filePath)
        .resize(variant.width, variant.height, {
          fit: variant.fit,
          position: "centre",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(outputPath);

      variants[variant.key] = `/uploads/processed/${outputName}`;
    } catch (err) {
      console.error(`[ImageProcessing] Failed to create ${variant.key} variant:`, err);
      variants[variant.key] = originalUrl;
    }
  }

  return variants as ImageVariants;
}
