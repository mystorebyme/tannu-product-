import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, carts } from "@/db/schema";
import { getProducts, ensureSeeded, type Product } from "@/lib/store";

export const CART_COOKIE = "liksha_cart";

export type CartLine = {
  id: number;
  handle: string;
  size: string;
  quantity: number;
  product: Product;
  lineTotal: number;
};

export type CartSummary = {
  token: string | null;
  lines: CartLine[];
  subtotal: number;
  count: number;
};

export const EMPTY_CART: CartSummary = { token: null, lines: [], subtotal: 0, count: 0 };

export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export async function getOrCreateCart(): Promise<string> {
  const existing = await readCartToken();
  if (existing) {
    try {
      await ensureSeeded();
      const found = await db.select().from(carts).where(eq(carts.token, existing)).limit(1);
      if (found.length > 0) return existing;
    } catch (error) {
      console.error("cart lookup failed", error);
    }
  }
  const token = crypto.randomUUID();
  await ensureSeeded();
  await db.insert(carts).values({ token }).onConflictDoNothing();
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

export async function getCartSummary(): Promise<CartSummary> {
  const token = await readCartToken();
  if (!token) return EMPTY_CART;
  try {
    await ensureSeeded();
    const found = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
    if (found.length === 0) return EMPTY_CART;
    const rows = await db.select().from(cartItems).where(eq(cartItems.cartId, found[0].id));
    if (rows.length === 0) return { token, lines: [], subtotal: 0, count: 0 };
    const products = await getProducts();
    const lines: CartLine[] = [];
    for (const row of rows) {
      const product = products.find((item) => item.handle === row.handle);
      if (!product) continue;
      lines.push({
        id: row.id,
        handle: row.handle,
        size: row.size,
        quantity: row.quantity,
        product,
        lineTotal: product.price * row.quantity,
      });
    }
    return {
      token,
      lines,
      subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
  } catch (error) {
    console.error("cart summary failed", error);
    return EMPTY_CART;
  }
}

export async function updateCartLine(
  token: string,
  itemId: number,
  quantity: number,
): Promise<void> {
  const found = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
  if (found.length === 0) return;
  if (quantity <= 0) {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, found[0].id)));
    return;
  }
  await db
    .update(cartItems)
    .set({ quantity: Math.min(quantity, 10) })
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, found[0].id)));
}

export async function clearCart(token: string): Promise<void> {
  const found = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
  if (found.length === 0) return;
  await db.delete(cartItems).where(eq(cartItems.cartId, found[0].id));
}
