import { siteUrl } from "@/lib/site";

export type Product = {
  slug: string;
  name: string;
  category:
    | "Swaddle"
    | "Bodysuits"
    | "Food Bag"
    | "Bottle Case"
    | "Feeding Cushion"
    | "Bow Set"
    | "Food Container";
  image: string;
  description: string;
  pricePkr: number;
  compareAtPricePkr: number;
  discountPercent: 15;
  inventoryQty: number;
  inStock: boolean;
  featured?: boolean;
  bestSeller?: boolean;
};

export const whatsappBaseUrl = "https://wa.me/923009551451";

/** PDP WhatsApp order fields — clamped to inventory server-side in builders. */
export type WhatsappOrderFields = {
  quantity: number;
  variantNote?: string;
  sizeNote?: string;
};

export function productUrl(product: Pick<Product, "slug">): string {
  return `${siteUrl}/shop/${product.slug}`;
}

/** Listing cards: color/style often matters for conversion. */
export function productShowsVariantField(product: Product): boolean {
  return true;
}

/** Bodysuits typically need a size — other categories use variant only. */
export function productShowsSizeField(product: Product): boolean {
  return product.category === "Bodysuits";
}

export function clampOrderQuantity(product: Product, quantity: number): number {
  const max = Math.max(1, product.inventoryQty);
  return Math.min(max, Math.max(1, Math.floor(quantity)));
}

/** Full template when ordering from the product detail page. */
export function buildWhatsappOrderMessage(
  product: Product,
  fields: WhatsappOrderFields,
): string {
  const qty = clampOrderQuantity(product, fields.quantity);
  const lineTotal = product.pricePkr * qty;
  const lines = [
    "Hi Little Smiles,",
    "",
    "I want to order:",
    "",
    `Product: ${product.name}`,
    `Category: ${product.category}`,
  ];

  if (productShowsVariantField(product)) {
    const v = fields.variantNote?.trim();
    lines.push(
      v
        ? `Variant / preference: ${v}`
        : `Variant / preference: As shown on this listing — please confirm before packing`,
    );
  }

  if (productShowsSizeField(product)) {
    const s = fields.sizeNote?.trim();
    lines.push(
      s ? `Size: ${s}` : `Size: Please advise available sizes for this style`,
    );
  }

  lines.push(
    "",
    `Quantity: ${qty}`,
    `Unit price: ${formatPkr(product.pricePkr)}`,
    qty > 1 ? `Line total: ${formatPkr(lineTotal)}` : `Total: ${formatPkr(lineTotal)}`,
    "",
    "Please confirm availability, payment options, and delivery timeline.",
    "",
    `Product link: ${productUrl(product)}`,
  );

  return lines.join("\n");
}

/** Compact inquiry from shop grid / cards (still product-specific + price + link). */
export function buildWhatsappListingInquiryMessage(product: Product): string {
  return [
    "Hi Little Smiles,",
    "",
    "I'd like to order:",
    "",
    `Product: ${product.name}`,
    `Category: ${product.category}`,
    `Price: ${formatPkr(product.pricePkr)} (${product.discountPercent}% off vs ${formatPkr(product.compareAtPricePkr)})`,
    "",
    `Quantity: 1 (please confirm stock)`,
    "",
    `Product page: ${productUrl(product)}`,
    "",
    "Please confirm availability and next steps.",
    "",
    "Thank you!",
  ].join("\n");
}

type ProductSeed = Omit<Product, "pricePkr" | "discountPercent" | "inStock"> & {
  compareAtPricePkr: number;
};

function withLaunchPricing(product: ProductSeed): Product {
  const discountPercent = 15 as const;
  return {
    ...product,
    discountPercent,
    pricePkr: Math.round(product.compareAtPricePkr * (1 - discountPercent / 100)),
    inStock: product.inventoryQty > 0,
  };
}

const productSeeds: ProductSeed[] = [
  {
    slug: "fly-high-swaddle",
    name: "Fly High Swaddle",
    category: "Swaddle",
    image: "/products/fly-high-swaddle.png",
    description:
      "Feather-soft swaddle crafted for calm naps, gentle cuddles, and everyday comfort.",
    compareAtPricePkr: 4380,
    inventoryQty: 1,
    featured: true,
    bestSeller: true,
  },
  {
    slug: "natures-cuddle-swaddle",
    name: "Nature's Cuddle Swaddle",
    category: "Swaddle",
    image: "/products/natures-cuddle-swaddle.png",
    description:
      "Breathable premium wrap designed for cozy sleep, secure swaddling, and all-day softness.",
    compareAtPricePkr: 4480,
    inventoryQty: 1,
    featured: true,
  },
  {
    slug: "unicorn-swaddle",
    name: "Unicorn Swaddle",
    category: "Swaddle",
    image: "/products/unicorn-swaddle.png",
    description:
      "Gentle cotton swaddle with a refined print for elegant naps and everyday comfort.",
    compareAtPricePkr: 4280,
    inventoryQty: 1,
    featured: true,
  },
  {
    slug: "dino-deer-bodysuits",
    name: "Dino Deer Bodysuits",
    category: "Bodysuits",
    image: "/products/dino-deer-bodysuits.png",
    description:
      "Premium daily bodysuits with soft-touch comfort, easy movement, and polished styling.",
    compareAtPricePkr: 4680,
    inventoryQty: 1,
    featured: true,
    bestSeller: true,
  },
  {
    slug: "tiny-quote-print-bodysuits",
    name: "Tiny Quote and Print Bodysuits",
    category: "Bodysuits",
    image: "/products/tiny-quote-and-print-bodysuits.png",
    description:
      "Breathable essentials made for quick changes and gentle skin contact throughout the day.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
    featured: true,
  },
  {
    slug: "tiny-quote-goggles-bodysuits",
    name: "Tiny Quote and Goggles Bodysuits",
    category: "Bodysuits",
    image: "/products/tiny-quote-and-goggles-bodysuits.png",
    description:
      "Comfort-first bodysuits with premium softness and playful detail for daily wear.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
    featured: true,
  },
  {
    slug: "beautiful-tiny-balls-bodysuits",
    name: "Beautiful Tiny Balls Bodysuits",
    category: "Bodysuits",
    image: "/products/beautiful-tiny-balls-bodysuits.png",
    description:
      "Soft premium knit bodysuits designed for all-day comfort and easy outfit rotation.",
    compareAtPricePkr: 4680,
    inventoryQty: 1,
  },
  {
    slug: "alien-dinosaour-lining-bodysuits",
    name: "Alien Dinosaour and Lining Bodysuits",
    category: "Bodysuits",
    image: "/products/alien-dinosaour-and-lining-bodysuits.png",
    description:
      "Premium cotton bodysuits with a smooth touch and dependable daily durability.",
    compareAtPricePkr: 4680,
    inventoryQty: 1,
  },
  {
    slug: "dinosaurs-bodysuits",
    name: "Dinosaurs Bodysuits",
    category: "Bodysuits",
    image: "/products/dinosaurs-bodysuits.png",
    description:
      "Breathable bodysuits that balance premium comfort with practical everyday use.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
  },
  {
    slug: "flowers-lining-bodysuits",
    name: "Flowers and Lining Bodysuits",
    category: "Bodysuits",
    image: "/products/flowers-and-lining-bodysuits.png",
    description:
      "Elegant everyday bodysuits with gentle fabric and premium stitch quality.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
  },
  {
    slug: "frilly-lining-bodysuits",
    name: "Frilly and Lining Bodysuits",
    category: "Bodysuits",
    image: "/products/frilly-and-lining-bodysuits.png",
    description:
      "Soft-touch bodysuits built for comfort, quick dressing, and refined baby styling.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
  },
  {
    slug: "gray-lining-bow-bodysuits",
    name: "Gray and Lining with a Bow Bodysuits",
    category: "Bodysuits",
    image: "/products/gray-and-lining-with-a-bow-bodysuits.png",
    description:
      "Premium daily bodysuits designed for breathable comfort and polished looks.",
    compareAtPricePkr: 4680,
    inventoryQty: 1,
  },
  {
    slug: "hello-dinosaur-bodysuits",
    name: "Hello and Dinosaur Bodysuits",
    category: "Bodysuits",
    image: "/products/hello-and-dinosaur-bodysuits.png",
    description:
      "Comfort-led bodysuits with elevated fabric quality and easy day-to-day wear.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
  },
  {
    slug: "rugby-roar-bodysuits",
    name: "Rugby Roar Bodysuits",
    category: "Bodysuits",
    image: "/products/rugby-roar-bodysuits.png",
    description:
      "Premium cotton bodysuits tailored for comfort, movement, and lasting softness.",
    compareAtPricePkr: 4680,
    inventoryQty: 1,
  },
  {
    slug: "swamp-stag-bodysuits",
    name: "Swamp Stag Bodysuits",
    category: "Bodysuits",
    image: "/products/swamp-stag-bodysuits.png",
    description:
      "Refined daily essentials with breathable comfort and clean premium finishing.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
  },
  {
    slug: "turtle-cute-owl-bodysuits",
    name: "Turtle and Cute Owl Bodysuits",
    category: "Bodysuits",
    image: "/products/turtle-and-cute-owl-bodysuits.png",
    description:
      "Soft premium bodysuits that keep babies comfortable through active daily routines.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
  },
  {
    slug: "yellow-borders-racoon-bodysuits",
    name: "Yellow Borders with a Racoon Bodysuits",
    category: "Bodysuits",
    image: "/products/yellow-borders-with-a-racoon-bodysuits.png",
    description:
      "Breathable premium bodysuits with dependable comfort and a clean everyday fit.",
    compareAtPricePkr: 4580,
    inventoryQty: 1,
  },
  {
    slug: "blue-and-white-food-bag",
    name: "Blue and White Food Bag",
    category: "Food Bag",
    image: "/products/blue-and-white-food-bag.png",
    description:
      "A sleek, practical food bag that keeps feeding essentials organized on the go.",
    compareAtPricePkr: 3580,
    inventoryQty: 1,
    featured: true,
    bestSeller: true,
  },
  {
    slug: "brown-and-white-food-bag",
    name: "Brown and White Food Bag",
    category: "Food Bag",
    image: "/products/brown-and-white-food-bag.png",
    description:
      "Premium insulated carry bag for neat feeding routines and clean daily travel.",
    compareAtPricePkr: 3580,
    inventoryQty: 1,
  },
  {
    slug: "navy-blue-food-bag",
    name: "Navy Blue Food Bag",
    category: "Food Bag",
    image: "/products/navy-blue-food-bag.png",
    description:
      "Refined insulated food bag designed for practical travel and polished utility.",
    compareAtPricePkr: 3680,
    inventoryQty: 1,
  },
  {
    slug: "orange-and-white-food-bag",
    name: "Orange and White Food Bag",
    category: "Food Bag",
    image: "/products/orange-and-white-food-bag.png",
    description:
      "Compact premium food bag with reliable insulation for everyday feeding needs.",
    compareAtPricePkr: 3480,
    inventoryQty: 1,
  },
  {
    slug: "pink-and-white-food-bag",
    name: "Pink and White Food Bag",
    category: "Food Bag",
    image: "/products/pink-and-white-food-bag.png",
    description:
      "Elegant insulated feeding bag for tidy organization and easy carrying.",
    compareAtPricePkr: 3580,
    inventoryQty: 1,
  },
  {
    slug: "pink-panda-food-bag",
    name: "Pink Panda Food Bag",
    category: "Food Bag",
    image: "/products/pink-panda-food-bag.png",
    description:
      "Premium compact food bag that blends practical insulation with charming style.",
    compareAtPricePkr: 3680,
    inventoryQty: 1,
  },
  {
    slug: "space-rocket-bottle-case",
    name: "Space Rocket Bottle Case",
    category: "Bottle Case",
    image: "/products/space-rocket-bottle-case.png",
    description:
      "Insulated bottle protection with a clean luxury finish for safer, smarter outings.",
    compareAtPricePkr: 3480,
    inventoryQty: 1,
    featured: true,
    bestSeller: true,
  },
  {
    slug: "butterfly-bottle-case",
    name: "Butterfly Bottle Case",
    category: "Bottle Case",
    image: "/products/butterfly-bottle-case.png",
    description:
      "Premium insulated case that protects bottles while keeping travel sleek and simple.",
    compareAtPricePkr: 3380,
    inventoryQty: 1,
  },
  {
    slug: "catterpillar-bottle-case",
    name: "Catterpillar Bottle Case",
    category: "Bottle Case",
    image: "/products/catterpillar-bottle-case.png",
    description:
      "Durable bottle case built for clean storage, insulation support, and daily convenience.",
    compareAtPricePkr: 3380,
    inventoryQty: 1,
  },
  {
    slug: "roboshell-bottle-case",
    name: "Roboshell Bottle Case",
    category: "Bottle Case",
    image: "/products/roboshell-bottle-case.png",
    description:
      "Practical premium bottle case designed for secure carrying and reliable insulation.",
    compareAtPricePkr: 3280,
    inventoryQty: 1,
  },
  {
    slug: "blue-feeding-cushion",
    name: "Blue Feeding Cushion",
    category: "Feeding Cushion",
    image: "/products/blue-feeding-cushion.png",
    description:
      "Supportive premium feeding cushion for better posture and calmer feeding sessions.",
    compareAtPricePkr: 4280,
    inventoryQty: 1,
    featured: true,
  },
  {
    slug: "grey-feeding-cushion",
    name: "Grey Feeding Cushion",
    category: "Feeding Cushion",
    image: "/products/grey-feeding-cushion.png",
    description:
      "Comfort-led nursing cushion that adds ergonomic support for baby and parent.",
    compareAtPricePkr: 4280,
    inventoryQty: 1,
  },
  {
    slug: "pink-feeding-cushion",
    name: "Pink Feeding Cushion",
    category: "Feeding Cushion",
    image: "/products/pink-feeding-cushion.png",
    description:
      "Premium everyday feeding cushion for improved comfort during longer holds.",
    compareAtPricePkr: 4380,
    inventoryQty: 1,
  },
  {
    slug: "baby-food-storage-container-1",
    name: "Baby Food Storage Container 1",
    category: "Food Container",
    image: "/products/baby-food-storage-container-1.png",
    description:
      "Compact premium food container for cleaner packing and organized feeding prep.",
    compareAtPricePkr: 3180,
    inventoryQty: 1,
  },
  {
    slug: "baby-food-storage-container-2",
    name: "Baby Food Storage Container 2",
    category: "Food Container",
    image: "/products/baby-food-storage-container-2.png",
    description:
      "Durable storage container designed for tidy portions and practical daily use.",
    compareAtPricePkr: 3180,
    inventoryQty: 1,
  },
  {
    slug: "floral-bow-flower-bow-set",
    name: "Floral Bow and Flower Bow Set",
    category: "Bow Set",
    image: "/products/floral-bow-and-flower-bow-set.png",
    description:
      "Curated premium bow set crafted to complete elegant baby looks.",
    compareAtPricePkr: 2380,
    inventoryQty: 1,
    featured: true,
  },
  {
    slug: "gray-bow-flower-bow-set",
    name: "Gray Bow and Flower Bow Set",
    category: "Bow Set",
    image: "/products/gray-bow-and-flower-bow-set.png",
    description:
      "Soft-finish bow set with refined tones for elevated everyday styling.",
    compareAtPricePkr: 2280,
    inventoryQty: 1,
  },
  {
    slug: "gray-crown-multi-color-balls-bow-set",
    name: "Gray Crown and Multi Color Balls Bow Set",
    category: "Bow Set",
    image: "/products/gray-crown-and-multi-color-balls-bow-set.png",
    description:
      "Premium bow accessories that balance playful detail with polished presentation.",
    compareAtPricePkr: 2380,
    inventoryQty: 1,
  },
  {
    slug: "gray-crown-flower-bow-set",
    name: "Gray Crown Flower Bow Set",
    category: "Bow Set",
    image: "/products/gray-crown-flower-bow-set.png",
    description:
      "Elegant bow set designed for comfortable wear and refined finishing touches.",
    compareAtPricePkr: 2380,
    inventoryQty: 1,
  },
  {
    slug: "gray-star-bow-set",
    name: "Gray Star Bow Set",
    category: "Bow Set",
    image: "/products/gray-star-bow-set.png",
    description:
      "Curated star bow set made for premium styling in daily outfits.",
    compareAtPricePkr: 2180,
    inventoryQty: 1,
  },
  {
    slug: "mustard-flower-bow-set",
    name: "Mustard Flower Bow Set",
    category: "Bow Set",
    image: "/products/mustard-flower-bow-set.png",
    description:
      "Premium flower bow set with soft structure and gift-ready elegance.",
    compareAtPricePkr: 2380,
    inventoryQty: 1,
  },
  {
    slug: "navy-gray-star-bow-set",
    name: "Navy Gray Star Bow Set",
    category: "Bow Set",
    image: "/products/navy-gray-star-bow-set.png",
    description:
      "Refined bow set with coordinated tones for polished baby accessorizing.",
    compareAtPricePkr: 2280,
    inventoryQty: 1,
  },
  {
    slug: "pearls-pink-bow-set",
    name: "Pearls and Pink Bow Set",
    category: "Bow Set",
    image: "/products/pearls-and-pink-bow-set.png",
    description:
      "Premium pearl-accent bow set designed for elegant occasion-ready looks.",
    compareAtPricePkr: 2480,
    inventoryQty: 1,
  },
  {
    slug: "polka-dots-red-black-bow-set",
    name: "Polka Dots Red and Black Bow Set",
    category: "Bow Set",
    image: "/products/polka-dots-red-and-black-bow-set.png",
    description:
      "Statement bow set with premium comfort and balanced everyday wearability.",
    compareAtPricePkr: 2280,
    inventoryQty: 1,
  },
  {
    slug: "white-bunny-ears-bow-set",
    name: "White Bunny Ears Bow Set",
    category: "Bow Set",
    image: "/products/white-bunny-ears-bow-set.png",
    description:
      "Soft premium bow set with playful charm and elevated finish.",
    compareAtPricePkr: 2380,
    inventoryQty: 1,
  },
];

export const products: Product[] = productSeeds.map(withLaunchPricing);

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getFeaturedProducts() {
  return products.filter((product) => product.featured);
}

export function getBestSellerProducts() {
  return products.filter((product) => product.bestSeller);
}

export function formatPkr(pricePkr: number) {
  return `Rs. ${pricePkr.toLocaleString("en-PK")}`;
}

/**
 * Without `fields`: structured listing inquiry (shop grid, cards) — includes price + PDP link.
 * With `fields`: full PDP order template — quantity, variant, size, totals.
 */
export function getWhatsappOrderLink(
  product: Product,
  fields?: WhatsappOrderFields,
): string {
  const message = fields
    ? buildWhatsappOrderMessage(product, fields)
    : buildWhatsappListingInquiryMessage(product);
  return `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
}

export function getImageCandidates(imagePath: string) {
  return [imagePath];
}
