/**
 * Losslessly re-encode PNGs in public/products: auto-rotate (EXIF), cap long edge,
 * stronger zlib compression. Backs up originals once to public/products/.backup-pre-optimize/
 *
 * Run locally before commit: npm run images:optimize
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const MAX_EDGE = 1800;
const PRODUCTS_DIR = join(process.cwd(), "public", "products");
const BACKUP_DIR = join(PRODUCTS_DIR, ".backup-pre-optimize");

function listPngFiles() {
  if (!existsSync(PRODUCTS_DIR)) return [];
  return readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".png"))
    .map((d) => d.name);
}

async function main() {
  const pngs = listPngFiles();
  if (pngs.length === 0) {
    console.log("No PNG files in public/products — skip.");
    process.exit(0);
  }

  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    for (const f of pngs) {
      copyFileSync(join(PRODUCTS_DIR, f), join(BACKUP_DIR, f));
    }
    writeFileSync(
      join(BACKUP_DIR, "README.txt"),
      "Automatic backup before first `npm run images:optimize`.\nRestore: copy these files into public/products/ (replace).\n",
    );
    console.log(
      `Backed up ${pngs.length} file(s) to public/products/.backup-pre-optimize/\n`,
    );
  }

  let totalSaved = 0;
  for (const f of pngs) {
    const inputPath = join(PRODUCTS_DIR, f);
    const before = statSync(inputPath).size;
    const meta = await sharp(inputPath).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    let pipeline = sharp(inputPath).rotate();

    if (w > MAX_EDGE || h > MAX_EDGE) {
      pipeline = pipeline.resize(MAX_EDGE, MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const buf = await pipeline
      .png({
        compressionLevel: 9,
        effort: 10,
        adaptiveFiltering: true,
      })
      .toBuffer();

    if (buf.length <= before) {
      writeFileSync(inputPath, buf);
      const saved = before - buf.length;
      totalSaved += saved;
      console.log(
        `${f}: ${kb(before)} → ${kb(buf.length)}${saved > 0 ? ` (−${kb(saved)})` : ""}`,
      );
    } else {
      console.log(`${f}: skip (output would be larger — ${kb(buf.length)} vs ${kb(before)})`);
    }
  }

  console.log(`\nDone. Approx total saved: ${kb(totalSaved)}`);
}

function kb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
