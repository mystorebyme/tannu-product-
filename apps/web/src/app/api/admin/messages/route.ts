import { listMessages, markMessageHandled } from "@/lib/messages";

export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  return Boolean(process.env.ADMIN_API_TOKEN) && token === process.env.ADMIN_API_TOKEN;
}

/** GET /api/admin/messages — website ke contact form ke messages */
export async function GET(request: Request) {
  if (!authorize(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  return Response.json(
    { messages: await listMessages(Number.isFinite(limit) ? limit : 100) },
    { headers: { "cache-control": "no-store" } },
  );
}

/** PATCH /api/admin/messages — { id, action: "handled", actor } */
export async function PATCH(request: Request) {
  if (!authorize(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: { id?: string; actor?: string; action?: string };
  try {
    body = (await request.json()) as { id?: string; actor?: string; action?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "Message id chahiye." }, { status: 400 });
  if (body.action && body.action !== "handled") {
    return Response.json({ error: "Sirf 'handled' supported hai." }, { status: 400 });
  }
  const updated = await markMessageHandled(id, String(body.actor ?? "admin").slice(0, 120));
  if (!updated) return Response.json({ error: "Message nahi mila." }, { status: 404 });
  return Response.json({ message: updated });
}
