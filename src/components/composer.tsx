"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/lib/types";

export function Composer({ lang, clientId }: { lang: Language; clientId: string }) {
  const zh = lang === "zh";
  const router = useRouter();
  const key = useRef(clientId);
  const form = useRef<HTMLFormElement>(null);
  const [count,setCount] = useState(0);
  const [sending,setSending] = useState(false);
  const [status,setStatus] = useState<{ text: string; error: boolean } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const values = new FormData(event.currentTarget);
    setSending(true); setStatus(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(),15000);
      let response: Response;
      try { response = await fetch("/api/messages", { method:"POST", headers:{ "Content-Type":"application/json", "Idempotency-Key":key.current }, body:JSON.stringify({ name: values.get("name"), message:values.get("message") }), signal:controller.signal }); }
      finally { clearTimeout(timeout); }
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429) throw new Error(zh ? `慢一点，${response.headers.get("Retry-After") || "60"} 秒后再试。` : `A little too fast. Try again in ${response.headers.get("Retry-After") || "60"} seconds.`);
        throw new Error(result.error?.message || (zh ? "暂时无法发送，请稍后重试。" : "Could not post. Please try again."));
      }
      form.current?.reset(); setCount(0); key.current = crypto.randomUUID();
      setStatus({ text:zh ? "已贴到墙上。谢谢你来过。" : "On the wall. Thanks for passing through.", error:false });
      router.push(`/?lang=${lang}#scribble-${result.message.id}`,{ scroll:false });
      router.refresh();
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      setStatus({ text: timedOut ? (zh ? "还没收到确认。可以重试，同一条留言不会重复发布。" : "No confirmation yet. Retry safely with the same message.") : error instanceof TypeError ? (zh ? "连接中断。保留了文字，请重试。" : "Connection lost. Your text is still here; please retry.") : error instanceof Error ? error.message : "Please try again.", error:true });
    } finally { setSending(false); }
  }
  // A changed draft is a new operation. An unchanged retry keeps its original key.
  function changed() { key.current = crypto.randomUUID(); setStatus(null); }
  return <section className="composer" aria-labelledby="composer-title">
    <div className="composer-heading"><span className="little-star" aria-hidden="true">✳</span><h2 id="composer-title">{zh ? "随手写两句" : "Leave a scribble"}</h2></div>
    <p className="composer-intro">{zh ? "一个想法，一句吐槽，一个链接。都可以。" : "A thought, a rant, a link. Anything on your mind."}</p>
    <form ref={form} action="/api/messages" method="post" onSubmit={submit}>
      <input type="hidden" name="client_id" value={key.current} /><input type="hidden" name="lang" value={lang} />
      <label htmlFor="name">{zh ? "名字" : "Name"}<span>{zh ? "可选" : "optional"}</span></label>
      <input id="name" name="name" maxLength={40} placeholder={zh ? "你想怎么称呼自己？" : "What should we call you?"} autoComplete="off" disabled={sending} onChange={changed} />
      <label htmlFor="message">{zh ? "留言" : "Your scribble"}</label>
      <textarea id="message" name="message" required maxLength={1000} rows={5} placeholder={zh ? "路过这里，留下点什么……" : "I was passing through, and…"} disabled={sending} onChange={e => { changed(); setCount(Array.from(e.target.value).length); }} />
      <div className="composer-meta"><span>{zh ? "公开 · 纯文字" : "Public · text only"}</span><span>{count.toLocaleString("en-US")} / 1,000</span></div>
      <button className="post-button" type="submit" disabled={sending}>{sending ? (zh ? "正在发布…" : "Posting…") : (zh ? "贴到墙上" : "Pin it to the wall")}<span aria-hidden="true">↗</span></button>
      <p className="form-status" role={status?.error ? "alert" : "status"} data-error={status?.error}>{status?.text || ""}</p>
    </form>
    <p className="public-note">{zh ? "这里谁都能看。私人信息就留在口袋里吧。" : "Everyone can read this. Keep private things in your pocket."}</p>
  </section>;
}
