import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contactMessages,
  emails,
  newsletterSubscribers,
  orderItems,
  orders,
  products,
} from "@/db/schema";
import { formatPrice } from "@/lib/format";

export const ORDER_STATUSES = [
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending",
};

export const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-[#eef3fb] text-[#2b4c86]",
  packed: "bg-[#fdf2e2] text-[#94620c]",
  shipped: "bg-[#eaf3fb] text-[#1f5f8b]",
  delivered: "bg-[#eaf6ec] text-[#2f7a3f]",
  completed: "bg-[#e6f2e8] text-[#2f7a3f]",
  cancelled: "bg-[#fbeaea] text-[#b3261e]",
  pending: "bg-[#f1ece6] text-[#6b6259]",
};

export async function getDashboardStats() {
  const [orderAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.total}),0)::int`,
    })
    .from(orders)
    .where(sql`${orders.status} <> 'cancelled'`);

  const [productCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products);

  const [messageCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contactMessages);

  const [subscriberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsletterSubscribers);

  const [emailCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emails);

  const byStatus = await db
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);

  const recentOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(8);

  const topProducts = await db
    .select({
      handle: orderItems.handle,
      title: orderItems.title,
      units: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<number>`sum(${orderItems.price} * ${orderItems.quantity})::int`,
    })
    .from(orderItems)
    .groupBy(orderItems.handle, orderItems.title)
    .orderBy(sql`sum(${orderItems.quantity}) desc`)
    .limit(6);

  const latestEmails = await db
    .select()
    .from(emails)
    .orderBy(desc(emails.createdAt))
    .limit(5);

  return {
    orderCount: orderAgg?.count ?? 0,
    revenue: orderAgg?.revenue ?? 0,
    productCount: productCount?.count ?? 0,
    messageCount: messageCount?.count ?? 0,
    subscriberCount: subscriberCount?.count ?? 0,
    emailCount: emailCount?.count ?? 0,
    byStatus,
    recentOrders,
    topProducts,
    latestEmails,
  };
}

export async function getAllOrders(limit = 200) {
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function getOrderWithItems(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { order, items };
}

export function money(value: number) {
  return formatPrice(value);
}
