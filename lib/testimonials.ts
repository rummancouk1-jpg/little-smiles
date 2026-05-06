export type Testimonial = {
  image: string;
  quote: string;
  author: string;
  location: string;
};

export const testimonials: Testimonial[] = [
  {
    image: "/testimonials/testimonial-01.png",
    quote:
      "The fabric feels incredibly soft and premium. My baby stays comfortable all day.",
    author: "Areeba M.",
    location: "Lahore",
  },
  {
    image: "/testimonials/testimonial-02.png",
    quote:
      "Beautiful quality and practical design. Exactly what I wanted for daily use.",
    author: "Sana R.",
    location: "Karachi",
  },
  {
    image: "/testimonials/testimonial-03.png",
    quote:
      "The wrapping and stitching feel refined. It is now part of our everyday routine.",
    author: "Hira A.",
    location: "Islamabad",
  },
  {
    image: "/testimonials/testimonial-04.png",
    quote: "Thank you for this beautiful piece. We love it.",
    author: "Parent Review",
    location: "Pakistan",
  },
];
