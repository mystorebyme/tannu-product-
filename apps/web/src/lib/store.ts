import "server-only";

import type { Catalog, Collection, Product } from "@liksha/types";
import catalog from "@/data/catalog.json";

/**
 * Catalog ek build-time JSON hai (database/seeds/catalog.json se generate hota hai).
 * Isliye har page static render ho sakta hai — koi DB call nahi, TTFB fast.
 */
const data = catalog as unknown as Catalog;

export const products: Product[] = data.products;
export const collections: Collection[] = data.collections;
export const catalogMeta = data.meta;

export async function getProducts(): Promise<Product[]> {
  return products;
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  return products.find((product) => product.handle === handle);
}

export async function getCollections(): Promise<Collection[]> {
  return [...collections].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCollection(handle: string): Promise<Collection | undefined> {
  return collections.find((collection) => collection.handle === handle);
}

export async function getProductsByCollection(handle: string, limit?: number): Promise<Product[]> {
  const list = products.filter((product) => product.collections.includes(handle));
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

export async function getFeatured(limit = 8): Promise<Product[]> {
  return products.filter((product) => product.featured).slice(0, limit);
}

export async function getLatest(limit = 12): Promise<Product[]> {
  return products.slice(0, limit);
}

export async function getRelated(handle: string, limit = 8): Promise<Product[]> {
  const current = products.find((product) => product.handle === handle);
  if (!current) return products.slice(0, limit);
  const sameCategory = products.filter(
    (product) => product.handle !== handle && product.category === current.category,
  );
  const sameColor = sameCategory.filter((product) => product.color === current.color);
  return [...sameColor, ...sameCategory.filter((p) => !sameColor.includes(p))].slice(0, limit);
}

export function searchProducts(term: string, limit = 8) {
  const query = term.trim().toLowerCase();
  if (query.length < 2) return [];
  return products
    .filter((product) => {
      const haystack = `${product.title} ${product.color} ${product.fabric} ${product.category}`.toLowerCase();
      return query.split(/\s+/).every((word) => haystack.includes(word));
    })
    .slice(0, limit)
    .map((product) => ({
      handle: product.handle,
      title: product.title,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      images: product.images,
      color: product.color,
      fabric: product.fabric,
    }));
}

export const SORT_KEYS = ["featured", "price-low", "price-high", "discount", "new", "title-asc"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value) && (SORT_KEYS as readonly string[]).includes(value as string);
}

export function sortProducts(list: Product[], key: SortKey = "featured"): Product[] {
  const copy = [...list];
  switch (key) {
    case "price-low":
      return copy.sort((a, b) => a.price - b.price);
    case "price-high":
      return copy.sort((a, b) => b.price - a.price);
    case "discount":
      return copy.sort(
        (a, b) =>
          (b.compareAtPrice ?? b.price) - b.price - ((a.compareAtPrice ?? a.price) - a.price),
      );
    case "new":
      return copy;
    case "title-asc":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return getRelated(product.handle, limit);
}
