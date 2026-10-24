import { contactSchema } from "@liksha/validation";
import { saveMessage } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json({ error: first?.message ?? "Details check kariye." }, { status: 400 });
  }

  saveMessage(parsed.data);
  return Response.json({ ok: true, message: "Thank you! Our team WhatsApp par reply karegi." }, { status: 201 });
}
