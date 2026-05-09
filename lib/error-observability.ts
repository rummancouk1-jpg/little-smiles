import * as Sentry from "@sentry/nextjs";

export function captureServerError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  console.error(`[error] ${context}`, error, extra ?? {});
  Sentry.withScope((scope) => {
    scope.setTag("context", context);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}
