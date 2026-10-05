import { WallError } from "./validation";
import { linksHeader } from "./site";

export function json(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", Link: linksHeader, ...extra },
  });
}
export function failure(error: unknown) {
  if (error instanceof WallError)
    return json(
      { error: { code: error.code, message: error.message } },
      error.status,
      error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {},
    );
  // Do not log credentials, request bodies, client IPs or raw database error details.
  console.error(
    "Wall request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    {
      error: {
        code: "unavailable",
        message: "The wall is temporarily unavailable. Please try again later.",
      },
    },
    503,
  );
}
export async function boundedBody(request: Request) {
  const max = 16384;
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > max)
    throw new WallError(
      413,
      "too_large",
      "Request body must be at most 16 KB.",
    );
  if (!request.body)
    throw new WallError(400, "invalid_body", "A message body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new WallError(
          413,
          "too_large",
          "Request body must be at most 16 KB.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
