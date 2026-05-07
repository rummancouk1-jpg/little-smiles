/**
 * Generates `app/favicon.ico` from the square brand logo (multi-size .ico).
 * Run after updating `public/products/logo.png`: `npm run generate:favicon`
 *
 * Uses a 256×256 source so the `.ico` stays small (full poster logos blow up file size).
 */
import { execSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pngToIco from "png-to-ico";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logo = join(root, "public", "products", "logo.png");
const tmp = join(root, "app", ".favicon-source.png");
const out = join(root, "app", "favicon.ico");

execSync(`npx sharp-cli -i "${logo}" -o "${tmp}" resize 256 256`, {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

try {
  const buf = await pngToIco(tmp);
  writeFileSync(out, Buffer.from(buf));
} finally {
  unlinkSync(tmp);
}
