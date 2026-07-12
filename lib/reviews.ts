/**
 * REAL customer reviews — and only real ones.
 *
 * House rule (do not break it): every entry here must come from a genuine
 * customer message about a genuine order — their own words, shared with
 * their permission. No invented names, no placeholder quotes, no "sample"
 * data. An empty array is the honest state until first reviews arrive;
 * the /reviews page and the homepage section render a warm invitation
 * instead of fabricated praise.
 *
 * To add a review: append an object below (newest first), commit, deploy.
 * `photo` is optional — only use an image the customer actually sent and
 * agreed to share (drop it in /public/reviews/).
 */

export type CustomerReview = {
  /** Stable unique id, e.g. "2026-07-ayesha-lahore". */
  id: string;
  /** The customer's own words, verbatim (light trimming for length is ok). */
  quote: string;
  /** First name (+ initial) as the customer is happy to be shown. */
  author: string;
  /** City, if they shared it. */
  location?: string;
  /** ISO date the review was received, e.g. "2026-08-02". */
  receivedAt: string;
  /** What they ordered, if they mentioned it (shown as a small ticket). */
  product?: string;
  /** Optional customer-sent photo under /public/reviews/, with permission. */
  photo?: string;
};

/** Newest first. Empty until real reviews arrive — see the house rule above. */
export const customerReviews: CustomerReview[] = [];
