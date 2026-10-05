"use client";
export default function ErrorPage({ reset }: { reset:()=>void }) { return <main className="guide site-shell narrow"><h1>A little interruption.</h1><p>The wall is temporarily unavailable. Your messages are stored separately from the website.</p><button className="post-button" onClick={reset}>Try again ↗</button><a className="back-link" href="/">Back to the wall</a></main>; }
