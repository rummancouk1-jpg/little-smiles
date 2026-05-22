// OAuth user credentials for Google APIs (GA4 first; GSC can reuse patterns later).
//
// Env (all required when using OAuth for a provider):
//   GA4_OAUTH_CLIENT_ID
//   GA4_OAUTH_CLIENT_SECRET
//   GA4_OAUTH_REFRESH_TOKEN
//
// Never log or return client_secret / refresh_token.

import { OAuth2Client } from "google-auth-library";

/** Read-only GA4 Data API scope for the user who completed the OAuth consent screen. */
export const GA4_OAUTH_SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"] as const;

export type Ga4OAuthEnv = {
  GA4_OAUTH_CLIENT_ID?: string;
  GA4_OAUTH_CLIENT_SECRET?: string;
  GA4_OAUTH_REFRESH_TOKEN?: string;
};

const GA4_OAUTH_ENV_KEYS = [
  "GA4_OAUTH_CLIENT_ID",
  "GA4_OAUTH_CLIENT_SECRET",
  "GA4_OAUTH_REFRESH_TOKEN",
] as const satisfies ReadonlyArray<keyof Ga4OAuthEnv>;

export function isGa4OAuthConfigured(env: Ga4OAuthEnv = process.env as Ga4OAuthEnv): boolean {
  return GA4_OAUTH_ENV_KEYS.every((key) => Boolean(env[key]?.trim()));
}

/** Which OAuth env keys are unset (for readiness / cron messages). */
export function missingGa4OAuthEnvKeys(env: Ga4OAuthEnv = process.env as Ga4OAuthEnv): string[] {
  return GA4_OAUTH_ENV_KEYS.filter((key) => !env[key]?.trim());
}

/**
 * Build an OAuth2 client for GA4. Caller must verify {@link isGa4OAuthConfigured} first.
 */
export function createGa4OAuth2Client(env: Ga4OAuthEnv = process.env as Ga4OAuthEnv): OAuth2Client {
  const clientId = env.GA4_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GA4_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = env.GA4_OAUTH_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GA4 OAuth credentials are incomplete.");
  }
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
