import "server-only";
import { cache } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { collections as collectionsTable, products as productsTable } from "@/db/schema";
import {
  catalog,
  collections as collectionCatalog,
  type CatalogCollection,
  type CatalogProduct,
} from "@/lib/catalog";

export type Product = CatalogProduct & { sortOrder: number };
export type Collection = CatalogCollection;

const withOrder = (product: CatalogProduct, index: number): Product => ({
  ...product,
  sortOrder: index,
});

let seedPromise: Promise<void> | null = null;

function catalogRows() {
  return catalog.map((product, index) => ({
    handle: product.handle,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    images: product.images,
    collections: product.collections,
    category: product.category,
    fabric: product.fabric,
    color: product.color,
    details: product.details,
    sizes: product.sizes,
    description: product.description,
    rating: product.rating,
    reviewCount: product.reviewCount,
    inStock: product.inStock,
    featured: product.featured,
    sortOrder: index,
  }));
}

export async function syncCatalog(): Promise<number> {
  const rows = catalogRows();
  for (const row of rows) {
    await db
      .insert(productsTable)
      .values(row)
      .onConflictDoUpdate({
        target: productsTable.handle,
        set: {
          title: row.title,
          price: row.price,
          compareAtPrice: row.compareAtPrice,
          images: row.images,
          collections: row.collections,
          category: row.category,
          fabric: row.fabric,
          color: row.color,
          details: row.details,
          sizes: row.sizes,
          description: row.description,
          inStock: row.inStock,
          featured: row.featured,
          sortOrder: row.sortOrder,
        },
      });
  }
  for (const collection of collectionCatalog) {
    await db
      .insert(collectionsTable)
      .values(collection)
      .onConflictDoUpdate({
        target: collectionsTable.handle,
        set: {
          title: collection.title,
          subtitle: collection.subtitle,
          image: collection.image,
          sortOrder: collection.sortOrder,
        },
      });
  }
  return rows.length;
}

async function seed(): Promise<void> {
  const existing = await db.select({ handle: productsTable.handle }).from(productsTable).limit(1);
  const count = await db.select({ id: productsTable.id }).from(productsTable);
  if (existing.length > 0 && count.length === catalog.length) {
    const cols = await db
      .select({ handle: collectionsTable.handle })
      .from(collectionsTable)
      .limit(1);
    if (cols.length === 0) {
      await db.insert(collectionsTable).values(collectionCatalog).onConflictDoNothing();
    }
    return;
  }
  await syncCatalog();
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seed().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export const getProducts = cache(async (): Promise<Product[]> => {
  try {
    await ensureSeeded();
    const rows = await db.select().from(productsTable).orderBy(asc(productsTable.sortOrder));
    if (rows.length > 0) {
      return rows.map((row) => ({
        handle: row.handle,
        title: row.title,
        price: row.price,
        compareAtPrice: row.compareAtPrice,
        images: row.images,
        collections: row.collections,
        category: row.category as Product["category"],
        fabric: row.fabric,
        color: row.color,
        details: row.details,
        sizes: row.sizes,
        description: row.description,
        rating: row.rating,
        reviewCount: row.reviewCount,
        inStock: row.inStock,
        featured: row.featured,
        sortOrder: row.sortOrder,
      }));
    }
  } catch (error) {
    console.error("Falling back to static catalog:", error);
  }
  return catalog.map(withOrder);
});

export const getCollections = cache(async (): Promise<Collection[]> => {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(collectionsTable)
      .orderBy(asc(collectionsTable.sortOrder));
    if (rows.length > 0) {
      return rows.map((row) => ({
        handle: row.handle,
        title: row.title,
        subtitle: row.subtitle,
        image: row.image,
        sortOrder: row.sortOrder,
      }));
    }
  } catch (error) {
    console.error("Falling back to static collections:", error);
  }
  return collectionCatalog;
});

export const getCollection = cache(async (handle: string): Promise<Collection | null> => {
  const all = await getCollections();
  return all.find((collection) => collection.handle === handle) ?? null;
});

export async function getProduct(handle: string): Promise<Product | null> {
  const all = await getProducts();
  return all.find((product) => product.handle === handle) ?? null;
}

export async function getProductsByCollection(handle: string): Promise<Product[]> {
  const all = await getProducts();
  if (handle === "all") return all;
  return all.filter((product) => product.collections.includes(handle));
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const all = await getProducts();
  const sameCollection = all.filter(
    (candidate) =>
      candidate.handle !== product.handle && candidate.category === product.category,
  );
  const merged = [...sameCollection, ...all.filter((c) => c.handle !== product.handle)];
  const unique: Product[] = [];
  for (const candidate of merged) {
    if (!unique.find((item) => item.handle === candidate.handle)) unique.push(candidate);
    if (unique.length === limit) break;
  }
  return unique;
}

export type SortKey = "featured" | "best-selling" | "price-asc" | "price-desc" | "newest" | "title-asc";

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const list = [...products];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
    case "title-asc":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
      return list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder);
    case "best-selling":
      return list.sort((a, b) => b.reviewCount - a.reviewCount);
    default:
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

export function isSortKey(value: string | undefined): value is SortKey {
  return (
    value === "featured" ||
    value === "best-selling" ||
    value === "price-asc" ||
    value === "price-desc" ||
    value === "newest" ||
    value === "title-asc"
  );
}
