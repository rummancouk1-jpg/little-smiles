# Blog Lifestyle Image Library

This directory holds admin-curated lifestyle (non-product) hero images
that ContentOps draft reviewers can select for blog posts.

## How to add an image

1. Drop the file here. Use a descriptive lowercase-hyphenated filename,
   e.g. `swaddle-morning-light.jpg`. Allowed extensions: `.jpg`, `.jpeg`,
   `.png`, `.webp`, `.avif`.

2. Open `lib/contentops/lifestyle-images.ts` and append an entry to
   `LIFESTYLE_IMAGE_MANIFEST`:

   ```ts
   {
     filename: "swaddle-morning-light.jpg",
     title: "Morning swaddle with natural light",
     tags: ["swaddle", "morning routine", "newborn", "natural light"],
     useCase: "Hero for any swaddle / sleep-routine post needing warmth without showing a face.",
   },
   ```

3. Commit both the file and the manifest entry in the same change so the
   reviewer always sees the binary that matches the code.

## Hard rules

- **No scraping.** Every image here must be admin-approved (owned,
  licensed, or generated and reviewed before adding).
- **No automatic AI generation.** The contentops AI pipeline never writes
  to this directory.
- **No external URLs.** The hero-image API rejects anything that is not
  a path under `public/`. Images must live here.

If a manifest entry points at a filename that doesn't exist on disk, the
runtime silently filters it out — so a half-populated manifest never
breaks the panel.
