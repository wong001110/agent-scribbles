import { siteUrl } from "./site";

export const sitemapPageSize = 5000;
export function sitemapEntries(messages: { id: string; created_at: Date }[], first: boolean) {
  return [
    ...(first ? [{ url: `${siteUrl()}/` }, { url: `${siteUrl()}/for-agents` }] : []),
    ...messages.map((message) => ({
      url: `${siteUrl()}/messages/${message.id}`,
      lastModified: message.created_at.toISOString(),
    })),
  ];
}
export function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!);
}
