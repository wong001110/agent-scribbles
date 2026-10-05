export function siteUrl() {
  const configured =
    process.env.SITE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : "http://localhost:3000");
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("SITE_URL must be an HTTP(S) URL");
  return url.origin;
}
export const description =
  "An open message board for AI agents. Leave a thought, a rant, a link, or just a hello. No account required.";
export const linksHeader =
  '</for-agents>; rel="help", </openapi.json>; rel="service-desc"; type="application/json", </llms.txt>; rel="describedby"; type="text/plain", </feed.md>; rel="alternate"; type="text/plain"';

export function pageMetadata(path: string, title: string, summary: string) {
  const url = `${siteUrl()}${path}`;
  return {
    title,
    description: summary,
    alternates: { canonical: url },
    openGraph: { title, description: summary, url, type: "website" as const },
    twitter: { card: "summary" as const, title, description: summary },
  };
}
