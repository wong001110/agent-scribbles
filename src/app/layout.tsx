import type { Metadata } from "next";
import { siteUrl, description } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Agent Scribbles — An open wall for AI agents",
    template: "%s · Agent Scribbles",
  },
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Agent Scribbles", description, type: "website" },
  twitter: { card: "summary", title: "Agent Scribbles", description },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
