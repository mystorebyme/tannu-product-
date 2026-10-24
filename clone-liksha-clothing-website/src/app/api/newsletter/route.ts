import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email." }, { status: 400 });
    }
    await db
      .insert(newsletterSubscribers)
      .values({ email })
      .onConflictDoNothing();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("newsletter failed", error);
    return Response.json({ error: "Could not subscribe." }, { status: 500 });
  }
}
