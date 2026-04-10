import { db } from "../server/db";
import { cmsAssets } from "../shared/schema";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface AssetEntry {
  sourcePath: string;
  altTextEn: string;
  captionEn?: string;
  category: string;
}

async function main() {
  console.log("[SEED-MEDIA] Starting media library seed...");

  const existing = await db.select({ id: cmsAssets.id }).from(cmsAssets).limit(1);
  if (existing.length > 0) {
    console.log("[SEED-MEDIA] Media library already has assets, skipping seed.");
    process.exit(0);
  }

  const uploadsDir = path.resolve("uploads/cms-assets");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const assets: AssetEntry[] = [];

  const logoFiles = [
    { file: "Charlotte_CLT_Logo_wiih_Skyline_1771792717615.png", alt: "Charlotte CLT Logo with Skyline" },
    { file: "CLT_Charlotte_Logo_1771642928144.png", alt: "CLT Charlotte Logo" },
    { file: "CLT_Skyline_Logo_1771791860436.png", alt: "CLT Skyline Logo" },
    { file: "CLT_Charlotte_Favicon_1771646040619.png", alt: "CLT Charlotte Favicon" },
    { file: "Hero_CLT_Logo_1771808272998.png", alt: "Hero CLT Logo" },
    { file: "ClTHero_Take_2_1771643059802.png", alt: "CLT Hero Take 2" },
    { file: "CLT_Hub_Hero_Neighborhood_1771812466592.png", alt: "CLT Hub Hero Neighborhood" },
    { file: "charlotte-avatar.png", alt: "Charlotte AI Avatar" },
    { file: "charlotte-avatar-v2.png", alt: "Charlotte AI Avatar v2" },
    { file: "CLT_Proper_Map_1771566624349.png", alt: "CLT Proper Map" },
  ];

  for (const logo of logoFiles) {
    const src = path.resolve("attached_assets", logo.file);
    if (fs.existsSync(src)) {
      assets.push({ sourcePath: src, altTextEn: logo.alt, category: "brand" });
    }
  }

  const verticalIcons = [
    { file: "CLT_Biz_1771464301059.png", alt: "CLT Business Icon" },
    { file: "CLT_Connects_1771464301060.png", alt: "CLT Connects Icon" },
    { file: "CLT_Events_1771464301061.png", alt: "CLT Events Icon" },
    { file: "CLT_Family_1771464301061.png", alt: "CLT Family Icon" },
    { file: "CLT_food_1771464301060.png", alt: "CLT Food Icon" },
    { file: "CLT_Marketplace_1771464301060.png", alt: "CLT Marketplace Icon" },
    { file: "CLT_Pets_1771464301060.png", alt: "CLT Pets Icon" },
    { file: "CLT_Senior_1771464301061.png", alt: "CLT Senior Icon" },
  ];

  for (const icon of verticalIcons) {
    const src = path.resolve("attached_assets", icon.file);
    if (fs.existsSync(src)) {
      assets.push({ sourcePath: src, altTextEn: icon.alt, category: "vertical-icon" });
    }
  }

  const stockDir = path.resolve("client/public/assets/stock_images");
  if (fs.existsSync(stockDir)) {
    const stockFiles = fs.readdirSync(stockDir).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
    for (const file of stockFiles) {
      const name = file.replace(/\.\w+$/, "").replace(/_/g, " ").replace(/\d+$/, "").trim();
      assets.push({
        sourcePath: path.join(stockDir, file),
        altTextEn: `Stock image: ${name}`,
        category: "stock",
      });
    }
  }

  const countyDir = path.resolve("client/public/images/counties");
  if (fs.existsSync(countyDir)) {
    const countyFiles = fs.readdirSync(countyDir).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
    for (const file of countyFiles) {
      const county = file.replace(/\.\w+$/, "");
      assets.push({
        sourcePath: path.join(countyDir, file),
        altTextEn: `${county.charAt(0).toUpperCase() + county.slice(1)} County`,
        category: "county",
      });
    }
  }

  console.log(`[SEED-MEDIA] Found ${assets.length} assets to register`);

  let created = 0;
  for (const asset of assets) {
    try {
      const filename = path.basename(asset.sourcePath);
      const destPath = path.join(uploadsDir, filename);

      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(asset.sourcePath, destPath);
      }

      const ext = path.extname(filename).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";
      const fileUrl = `/uploads/cms-assets/${filename}`;

      await db.insert(cmsAssets).values({
        fileUrl,
        fileType: "image",
        mimeType,
        altTextEn: asset.altTextEn,
        captionEn: asset.category,
      });
      created++;
    } catch (err: any) {
      console.error(`[SEED-MEDIA] Error registering ${path.basename(asset.sourcePath)}:`, err.message);
    }
  }

  console.log(`[SEED-MEDIA] Registered ${created} assets in Media Library`);
  console.log("[SEED-MEDIA] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[SEED-MEDIA] Fatal error:", err);
  process.exit(1);
});
