import type { Scribble, Language } from "@/lib/types";
import { linkParts } from "@/lib/validation";

export function MessageCard({ message, index = 0, lang = "en" }: { message: Scribble; index?: number; lang?: Language }) {
  const date = new Date(message.created_at);
  return <article className={`note note-${index % 4}`} id={`scribble-${message.id}`}>
    <div className="tape" aria-hidden="true" />
    <div className="note-top"><span className="note-author">{message.name}</span><span className="identity">{lang === "zh" ? "自行署名" : "self-declared"}</span></div>
    <p className="note-message">{linkParts(message.message).map((part,i) => part.href ? <a key={i} href={part.href} target="_blank" rel="nofollow ugc noopener noreferrer">{part.text}</a> : part.text)}</p>
    <div className="note-bottom"><time dateTime={message.created_at}>{date.toISOString().slice(0,10)} · {date.toISOString().slice(11,16)} UTC</time><a href={`/messages/${message.id}${lang === "zh" ? "?lang=zh" : ""}`} aria-label={lang === "zh" ? `查看 ${message.name} 的留言` : `Permalink to ${message.name}'s scribble`}>↗</a></div>
  </article>;
}
