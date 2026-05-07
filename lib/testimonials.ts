export type ImageTestimonial = {
  id: string;
  image: string;
  quote: string;
  author: string;
  location: string;
};

/** Short written reviews (no photo) — use on /reviews to avoid repeating homepage images. */
export type TextReviewSnippet = {
  id: string;
  quote: string;
  author: string;
  location: string;
};

/** Homepage: one photo per story (4 assets). */
export const homepageTestimonials: ImageTestimonial[] = [
  {
    id: "areeba-lahore",
    image: "/testimonials/testimonial-01.png",
    quote:
      "The fabric feels incredibly soft and premium. My baby stays comfortable all day.",
    author: "Areeba M.",
    location: "Lahore",
  },
  {
    id: "sana-karachi",
    image: "/testimonials/testimonial-02.png",
    quote:
      "Beautiful quality and practical design. Exactly what I wanted for daily use.",
    author: "Sana R.",
    location: "Karachi",
  },
  {
    id: "hira-islamabad",
    image: "/testimonials/testimonial-03.png",
    quote:
      "The wrapping and stitching feel refined. It is now part of our everyday routine.",
    author: "Hira A.",
    location: "Islamabad",
  },
  {
    id: "parent-photo-four",
    image: "/testimonials/testimonial-04.png",
    quote: "Thank you for this beautiful piece. We love it.",
    author: "Parent Review",
    location: "Pakistan",
  },
];

/** Reviews page: extra snippets, city-level detail, no duplicate hero photos. */
export const textReviewSnippets: TextReviewSnippet[] = [
  {
    id: "nadia-rawalpindi",
    quote:
      "Ordered the food bag for day trips to family in Rawalpindi—everything stays neat and the lining feels sturdy, not flimsy.",
    author: "Nadia T.",
    location: "Rawalpindi",
  },
  {
    id: "fatima-multan",
    quote:
      "The bodysuits washed beautifully and kept their shape. Finally something that looks nice in photos and survives real life.",
    author: "Fatima S.",
    location: "Multan",
  },
  {
    id: "maryam-peshawar",
    quote:
      "Packaging was careful and delivery to Peshawar was smooth. The swaddle is lightweight but cozy—exactly what we needed.",
    author: "Maryam H.",
    location: "Peshawar",
  },
  {
    id: "sadia-hyderabad",
    quote:
      "The bottle case fits our routine for outings around Hyderabad. Insulation is reassuring on warmer days.",
    author: "Sadia I.",
    location: "Hyderabad",
  },
  {
    id: "aisha-sialkot",
    quote:
      "Bought it as a gift for my sister in Sialkot—she said the quality feels like a boutique find, not a rushed online order.",
    author: "Aisha N.",
    location: "Sialkot",
  },
  {
    id: "rabia-gujranwala",
    quote:
      "After two washes the fabric still feels soft on sensitive skin. That was my biggest worry, and you nailed it.",
    author: "Rabia Q.",
    location: "Gujranwala",
  },
  {
    id: "sumaira-quetta",
    quote:
      "Living in Quetta, I am picky about layers and breathability. This swaddle strikes a good balance—warm enough without bulk.",
    author: "Sumaira B.",
    location: "Quetta",
  },
  {
    id: "noor-bahawalpur",
    quote:
      "Placed the order on WhatsApp and got clear replies. The feeding cushion made long evening feeds much easier on my arms.",
    author: "Noor F.",
    location: "Bahawalpur",
  },
];
