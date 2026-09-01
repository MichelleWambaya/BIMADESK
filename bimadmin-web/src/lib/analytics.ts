// A minimal analytics hook, intentionally provider-agnostic. It does
// nothing until VITE_ANALYTICS_SRC and VITE_ANALYTICS_DOMAIN are set in
// .env, so no third-party script loads or tracks anyone by default.
//
// Works as-is with Plausible (privacy-friendly, no cookie banner needed
// under most readings of Kenyan and EU rules) or any script-tag analytics
// tool that exposes a global `track` style function. Swap the src/domain
// for your provider of choice.

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  const src = import.meta.env.VITE_ANALYTICS_SRC as string | undefined;
  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN as string | undefined;
  if (!src || !domain) return;

  const script = document.createElement("script");
  script.src = src;
  script.defer = true;
  script.dataset.domain = domain;
  document.head.appendChild(script);
  initialized = true;
}

export function trackEvent(name: string, props?: Record<string, string | number>) {
  const plausible = (window as unknown as { plausible?: (name: string, opts?: { props?: Record<string, string | number> }) => void }).plausible;
  if (plausible) plausible(name, { props });
}
