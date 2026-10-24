/**
 * @liksha/types
 * Web, admin aur api teeno yahi types use karte hain.
 * Rule: paisa hamesha INTEGER PAISE me. Kabhi float nahi.
 */

export type Currency = "INR";

export type ProductCategory = "anarkali" | "lehnga" | "printed" | "saree";

export interface Product {
  /** URL-safe ASCII slug (emoji/space strip karke) */
  handle: string;
  /** original likshaclothing.com handle — traceability ke liye */
  sourceHandle: string;
  title: string;
  /** selling price in paise */
  price: number;
  /** MRP in paise (null = no strike-through) */
  compareAtPrice: number | null;
  /** CDN image urls, first one is the primary */
  images: string[];
  collections: string[];
  category: ProductCategory;
  fabric: string;
  color: string;
  sizes: string[];
  details: string[];
  description: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  featured: boolean;
}

export interface Collection {
  handle: string;
  title: string;
  subtitle: string;
  image: string;
  sortOrder: number;
}

export interface Catalog {
  meta: {
    store: string;
    source: string;
    cdn: string;
    currency: Currency;
    moneyUnit: "paise";
    builtAt: string;
    productCount: number;
  };
  collections: Collection[];
  products: Product[];
}

export interface CartLineInput {
  handle: string;
  size: string;
  quantity: number;
}

export type PaymentMethod = "prepaid" | "cod";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentStatus = "pending" | "paid" | "failed" | "cod" | "refunded";

export interface OrderItem {
  handle: string;
  title: string;
  image: string;
  size: string;
  quantity: number;
  /** unit price in paise */
  price: number;
}

export interface Address {
  fullName: string;
  phone: string;
  email: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  /** har mutation ka record — kisne kya badla */
  audit: AuditEntry[];
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
