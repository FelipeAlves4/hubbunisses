type ApplicationUrls = {
  portal: string;
  precifica: string;
  proposta: string;
};

export function safeApplicationRedirect(
  value: string | null,
  applications: ApplicationUrls,
  fallback = "/",
) {
  if (!value) return fallback;
  try {
    // Keep Portal navigation on the current origin. This is important for
    // Preview deployments, where the configured production URL is not the
    // URL currently serving the authenticated session.
    if (value.startsWith("/")) {
      const internalOrigin = "https://portal.internal";
      const target = new URL(value, internalOrigin);
      if (target.origin !== internalOrigin) return fallback;
      return `${target.pathname}${target.search}${target.hash}`;
    }

    const target = new URL(value);
    const portalOrigin = new URL(applications.portal).origin;
    if (target.origin !== portalOrigin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
