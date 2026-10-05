export class WallError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const controls =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
export const codePointLength = (s: string) => Array.from(s).length;
export const normalizeMessage = (s: string) => s.replace(/\r\n?/g, "\n").trim();
export const normalizeName = (s: string) => s.trim();
export function validateMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WallError(
      400,
      "invalid_body",
      "Send a JSON object with name and message.",
    );
  const data = value as Record<string, unknown>;
  if (typeof data.message !== "string")
    throw new WallError(400, "invalid_message", "message must be a string.");
  if (data.name !== undefined && typeof data.name !== "string")
    throw new WallError(400, "invalid_name", "name must be a string.");
  const message = normalizeMessage(data.message);
  const name = normalizeName((data.name as string | undefined) || "") || "anonymous";
  if (!message || codePointLength(message) > 1000)
    throw new WallError(
      400,
      "invalid_message",
      "Use between 1 and 1,000 characters for message.",
    );
  if (codePointLength(name) > 40 || /[\r\n]/u.test(name))
    throw new WallError(
      400,
      "invalid_name",
      "Use a single line of up to 40 characters for name.",
    );
  if (controls.test(message) || controls.test(name))
    throw new WallError(
      400,
      "invalid_characters",
      "Control and text-direction override characters are not supported.",
    );
  if (
    data.client_id !== undefined &&
    (typeof data.client_id !== "string" || !UUID.test(data.client_id))
  )
    throw new WallError(400, "invalid_client_id", "client_id must be a UUID.");
  return { name, message, clientId: data.client_id as string | undefined };
}
export function validateKey(key: string | null) {
  if (key !== null && !/^[A-Za-z0-9_.:-]{8,128}$/.test(key))
    throw new WallError(
      400,
      "invalid_idempotency_key",
      "Use 8–128 letters, numbers, dots, colons, underscores or hyphens for Idempotency-Key.",
    );
  return key;
}
export type TextPart = { text: string; href?: string };
export function linkParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let offset = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`]+/gu)) {
    const raw = match[0];
    const clean = raw.replace(/[.,!?;:，。！？；：)\]}>]+$/u, "");
    if (match.index > offset)
      parts.push({ text: text.slice(offset, match.index) });
    try {
      const url = new URL(clean);
      parts.push({
        text: clean,
        href:
          ["https:", "http:"].includes(url.protocol) &&
          !url.username &&
          !url.password
            ? url.href
            : undefined,
      });
    } catch {
      parts.push({ text: clean });
    }
    if (raw.length > clean.length)
      parts.push({ text: raw.slice(clean.length) });
    offset = match.index + raw.length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts.length ? parts : [{ text }];
}
