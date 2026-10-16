import posthog from "posthog-js";

/**
 * Client-side analytics init.
 * PostHog for product analytics, Sentry for errors (loaded via sentry.client.config.ts).
 * Server-side Sentry is initialized via sentry.server.config.ts / next.config (not here).
 */
export function initAnalytics() {
  if (typeof window === "undefined") return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

  if (posthogKey && !posthogKey.startsWith("your-")) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false
    });
  }
}

export function captureEvent(name: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  try {
    posthog.capture(name, properties);
  } catch {
    // Never let analytics errors surface to users
  }
}
