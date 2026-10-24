import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { getProducts } from "@/lib/store";
import { orderNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type IncomingItem = { handle?: unknown; size?: unknown; quantity?: unknown };

const COUPONS: Record<string, number> = { LIKSHA10: 10, WELCOME15: 15, BOB20: 20 };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const items = Array.isArray(body.items) ? (body.items as IncomingItem[]) : [];
    const customerName = String(body.customerName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const city = String(body.city ?? "").trim();
    const state = String(body.state ?? "").trim();
    const pincode = String(body.pincode ?? "").trim();
    const notes = body.notes ? String(body.notes).slice(0, 500) : null;
    const paymentMethod = body.paymentMethod === "cod" ? "cod" : "prepaid";
    const couponCode = body.couponCode ? String(body.couponCode).toUpperCase() : null;

    if (!customerName || !email || !phone || !address || !city || !state || !/^\d{6}$/.test(pincode)) {
      return Response.json({ error: "Please complete all required delivery fields." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (items.length === 0) {
      return Response.json({ error: "Your cart is empty." }, { status: 400 });
    }

    const products = await getProducts();
    const resolved = items
      .map((item) => {
        const product = products.find((candidate) => candidate.handle === String(item.handle));
        if (!product) return null;
        const quantity = Math.max(1, Math.min(10, Number(item.quantity) || 1));
        const size = String(item.size ?? product.sizes[0] ?? "Free Size");
        return { product, quantity, size };
      })
      .filter((item): item is { product: (typeof products)[number]; quantity: number; size: string } => item !== null);

    if (resolved.length === 0) {
      return Response.json({ error: "No valid products in the order." }, { status: 400 });
    }

    const subtotal = resolved.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const discount = couponCode && COUPONS[couponCode] ? Math.round((subtotal * COUPONS[couponCode]) / 100) : 0;
    const codFee = paymentMethod === "cod" ? 5000 : 0;
    if (paymentMethod === "cod" && subtotal > 350000) {
      return Response.json({ error: "COD is only available on orders under Rs. 3,500." }, { status: 400 });
    }
    const total = Math.max(0, subtotal - discount + codFee);
    const number = orderNumber();

    const inserted = await db
      .insert(orders)
      .values({
        orderNumber: number,
        customerName,
        email,
        phone,
        address,
        city,
        state,
        pincode,
        notes,
        paymentMethod,
        subtotal,
        discount,
        shipping: 0,
        total,
        status: "confirmed",
      })
      .returning({ id: orders.id });

    const orderId = inserted[0]?.id;
    if (!orderId) throw new Error("order insert failed");

    await db.insert(orderItems).values(
      resolved.map((item) => ({
        orderId,
        handle: item.product.handle,
        title: item.product.title,
        image: item.product.images[0] ?? "",
        size: item.size,
        price: item.product.price,
        quantity: item.quantity,
      })),
    );

    return Response.json({ orderNumber: number, total }, { status: 201 });
  } catch (error) {
    console.error("order create failed", error);
    return Response.json({ error: "Server error while placing the order." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const number = searchParams.get("orderNumber");
    if (!number) return Response.json({ error: "orderNumber required" }, { status: 400 });
    const found = await db.select().from(orders).where(eq(orders.orderNumber, number)).limit(1);
    if (found.length === 0) return Response.json({ error: "Order not found" }, { status: 404 });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, found[0].id));
    return Response.json({ order: found[0], items });
  } catch (error) {
    console.error("order fetch failed", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
