/**
 * Guarded service-worker registration.
 * Follows the PWA skill rules: never register in dev/preview/iframes.
 */
export async function registerServiceWorker(): Promise<void> {
  const isDev = !import.meta.env.PROD;
  const isIframe = window.self !== window.top;
  const hostname = window.location.hostname;
  const isPreview =
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev");
  const swOff = new URL(window.location.href).searchParams.has("sw=off");

  if (!("serviceWorker" in navigator)) return;

  const scope = "/";
  const swPath = "/sw.js";

  // In refused contexts, unregister any matching stale app SW first
  if (isDev || isIframe || isPreview || swOff) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        if (r.scope.endsWith(scope)) {
          await r.unregister();
        }
      }
    } catch {
      // ignore
    }
    return;
  }

  try {
    await navigator.serviceWorker.register(swPath, { scope });
  } catch {
    // ignore registration failures
  }
}
