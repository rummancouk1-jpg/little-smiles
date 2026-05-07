/**
 * Validates `data/catalog.json` + `data/site.json` via the same Zod rules as runtime.
 * Run: `npm run validate:catalog`
 */
import "../lib/catalog-config";
import { products } from "../lib/products";

console.log(`Catalog OK — ${products.length} published products.`);
