import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{url:siteUrl(),changeFrequency:"daily",priority:1},{url:`${siteUrl()}/for-agents`,changeFrequency:"monthly",priority:0.7}];
}
