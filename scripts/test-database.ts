// Tests must never fall back to an application's DATABASE_URL.
export function testDatabaseUrl(value: string | undefined): string {
  const refused = () => new Error(
    "TEST_DATABASE_URL must target a disposable localhost PostgreSQL database named agent_scribbles_test.",
  );
  if (!value) throw refused();
  let url: URL;
  try { url = new URL(value); } catch { throw refused(); }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/agent_scribbles_test" ||
    url.search || url.hash
  ) throw refused();
  return value;
}
