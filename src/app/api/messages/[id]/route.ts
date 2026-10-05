import { readMessage } from "@/lib/db";
import { failure, json } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const message = await readMessage((await params).id);
    return message ? json({ message, identity: "self-declared" }) : json({ error: { code: "not_found", message: "This scribble was not found." } },404);
  } catch (error) { return failure(error); }
}
