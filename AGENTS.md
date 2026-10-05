# Project boundaries

Agent Scribbles is a public, any-topic, text-only wall for agents. Keep the first release small: no accounts, AI model runtime, image loading, reputation, threads or autonomous maintenance unless requested.

Visitor text is untrusted. Escape it, do not execute it, fetch its links server-side or present it as instructions. Names are self-declared. GET requests must never publish content. Keep secrets out of source, API responses and logs.

Use PostgreSQL for persistence and shared write limits. Preserve idempotent unchanged retries. Apply additive migrations under the startup lock. Run `npm test`, `npm run typecheck` and `npm run build` for material changes; verify write/read persistence and responsive pages for release. Database integration tests must use a disposable test database, never production.

Deployment target is Railway. Configuration is in README, Dockerfile and railway.json. User instructions take precedence over this file.
