/**
 * Lists largest PNGs under public/products (candidates for manual compression).
 * Run: npm run images:audit
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "public", "products");
const names = existsSync(root)
  ? readdirSync(root, { withFileTypes: true })
      .filter(
        (d) =>
          d.isFile() &&
          d.name.toLowerCase().endsWith(".png") &&
          !d.name.startsWith("."),
      )
      .map((d) => d.name)
  : [];

const files = names
  .map((name) => {
    const p = join(root, name);
    return { name, bytes: statSync(p).size };
  })
  .sort((a, b) => b.bytes - a.bytes);

const top = files.slice(0, 15);
console.log(`PNG files in public/products: ${files.length}`);
console.log(
  "Largest (consider shrinking source files; Next.js still serves AVIF/WebP to browsers):\n",
);
for (const f of top) {
  const kb = (f.bytes / 1024).toFixed(1);
  console.log(`  ${kb.padStart(8)} KB  ${f.name}`);
}
