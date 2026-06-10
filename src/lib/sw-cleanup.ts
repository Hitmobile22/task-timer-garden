const SW_PATH = "/sw.js";

function isPreviewOrDev(): boolean {
  const hostname = location.hostname;
  return (
    !import.meta.env.PROD ||
    window.self !== window.top ||
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterMatching(scope: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((r) => r.scope === scope || new URL(r.scope).pathname === "/")
      .map((r) => r.unregister()),
  );
}

export async function initServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(location.href);
  if (url.searchParams.has("sw")) {
    await unregisterMatching(location.origin + "/");
    return;
  }

  if (isPreviewOrDev()) {
    await unregisterMatching(location.origin + "/");
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch {
    // ignore registration failures
  }
}
