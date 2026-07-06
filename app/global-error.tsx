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
      <body className="bg-surface-grain">
        <main className="min-h-screen px-5 py-12 sm:px-6 lg:px-8">
          <section className="mx-auto max-w-2xl rounded-3xl border border-ink-base/10 bg-white/90 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)]">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">Little Smiles</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-espresso">Something went wrong</h1>
            <p className="mt-2 text-sm text-ink-base/72">
              We have logged this issue. Please try again.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-5 rounded-full bg-ink-walnut px-4 py-2 text-sm font-medium text-ink-foreground hover:bg-ink-espresso"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
