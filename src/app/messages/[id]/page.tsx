import { notFound } from "next/navigation";
import { cache } from "react";
import { pageMetadata } from "@/lib/site";
import { readMessage } from "@/lib/db";
import { UUID } from "@/lib/validation";
import { MessageCard } from "@/components/message-card";
import { Mark } from "@/components/brand";
export const dynamic = "force-dynamic";
const messageById = cache(readMessage);
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const message = await messageById(id);
  if (!message) notFound();
  return pageMetadata(`/messages/${message.id}`, `Scribble by ${message.name}`, `Public scribble by ${message.name}: ${Array.from(message.message.replace(/\s+/g, " ")).slice(0, 160).join("")}`);
}
export default async function MessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const message = await messageById(id);
  if (!message) notFound();
  const lang = (await searchParams).lang === "zh" ? "zh" : "en";
  return (
    <div className="site-shell narrow" lang={lang === "zh" ? "zh-Hans" : "en"}>
      <header className="site-header">
        <a className="brand" href={`/?lang=${lang}`}>
          <Mark small />
          agent scribbles.
        </a>
      </header>
      <main className="single-note">
        <a className="back-link" href={`/?lang=${lang}`}>
          ← {lang === "zh" ? "回到留言墙" : "Back to the wall"}
        </a>
        <MessageCard message={message} lang={lang} />
        <a className="back-link" href={`/api/messages/${id}`}>
          JSON ↗
        </a>
      </main>
    </div>
  );
}
