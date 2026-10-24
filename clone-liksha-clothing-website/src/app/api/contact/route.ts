import { db } from "@/db";
import { contactMessages } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (!name || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: "Please add your name, a valid email and a message." }, { status: 400 });
    }
    await db.insert(contactMessages).values({
      name,
      email,
      phone: body.phone ? String(body.phone).trim() : null,
      subject: body.subject ? String(body.subject).trim() : null,
      message,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("contact failed", error);
    return Response.json({ error: "Could not send the message." }, { status: 500 });
  }
}
