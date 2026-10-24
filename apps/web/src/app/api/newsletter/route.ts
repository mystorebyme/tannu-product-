import { newsletterSchema } from "@liksha/validation";
import { saveSubscriber } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Valid email daaliye." }, { status: 400 });
  }
  const result = saveSubscriber(parsed.data.email);
  return Response.json({ ok: true, duplicate: result.duplicate }, { status: 201 });
}
