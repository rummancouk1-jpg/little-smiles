"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-[#FDF8F4]">
        <main className="min-h-screen px-5 py-12 sm:px-6 lg:px-8">
          <section className="mx-auto max-w-2xl rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)]">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Little Smiles</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1F1918]">Something went wrong</h1>
            <p className="mt-2 text-sm text-[#3B2F2F]/72">
              We have logged this issue. Please try again.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-5 rounded-full bg-[#2F2624] px-4 py-2 text-sm font-medium text-[#F6F1EC] hover:bg-[#251E1D]"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
