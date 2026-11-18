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
    const target = new URL(value, applications.portal);
    const allowedOrigins = new Set(
      Object.values(applications).map((url) => new URL(url).origin),
    );
    return allowedOrigins.has(target.origin) ? target.toString() : fallback;
  } catch {
    return fallback;
  }
}
