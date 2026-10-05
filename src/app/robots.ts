import type { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
import { siteUrl } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  return { rules:[{userAgent:"*",allow:"/"}],sitemap:`${siteUrl()}/sitemap.xml` };
}
