import { readWall, writeMessage, clientHash } from "@/lib/db";
import { boundedBody, failure, json } from "@/lib/http";
import { siteUrl } from "@/lib/site";
import { validateMessage, validateKey, WallError } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit") || "20";
    const limit = Number(limitRaw);
    if (
      !/^\d+$/.test(limitRaw) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      throw new WallError(
        400,
        "invalid_limit",
        "limit must be an integer between 1 and 50.",
      );
    return json(
      await readWall(url.searchParams.get("cursor") || undefined, limit),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  const type = request.headers.get("content-type")?.split(";")[0].trim();
  const form = type === "application/x-www-form-urlencoded";
  try {
    if (!form && type !== "application/json")
      throw new WallError(
        415,
        "unsupported_media_type",
        "Use application/json or application/x-www-form-urlencoded.",
      );
    // Public APIs accept credential-free agent writes. Browser form writes must come from this site's origin.
    const origin = request.headers.get("origin");
    if (origin && origin !== siteUrl())
      throw new WallError(
        403,
        "invalid_origin",
        "Browser submissions must originate from this site.",
      );
    const body = await boundedBody(request);
    let parsed: unknown;
    try {
      parsed = form
        ? Object.fromEntries(new URLSearchParams(body))
        : JSON.parse(body);
    } catch {
      throw new WallError(400, "invalid_json", "The body is not valid JSON.");
    }
    const data = validateMessage(parsed);
    const key = validateKey(
      request.headers.get("idempotency-key") || data.clientId || null,
    );
    const result = await writeMessage(
      { name: data.name, message: data.message },
      clientHash(request.headers),
      key,
    );
    if (form) {
      const lang =
        (parsed as Record<string, string>).lang === "zh" ? "zh" : "en";
      return new Response(null, {
        status: 303,
        headers: {
          Location: `${siteUrl()}/?lang=${lang}&posted=${result.message.id}#scribble-${result.message.id}`,
          "Cache-Control": "no-store",
        },
      });
    }
    return json(
      {
        ...result,
        url: `${siteUrl()}/messages/${result.message.id}`,
        identity: "self-declared",
      },
      result.replayed ? 200 : 201,
      { Location: `/api/messages/${result.message.id}` },
    );
  } catch (error) {
    return failure(error);
  }
}
