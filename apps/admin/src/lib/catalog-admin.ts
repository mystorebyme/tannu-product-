import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Catalog, Product } from "@liksha/types";
import catalogJson from "../data/catalog.json";
import {
  catalogWritable,
  readOverrides,
  repoRoot,
  overridesFile,
  writeOverrides,
  type OverridesFile,
  type ProductOverride,
} from "./overrides";

const run = promisify(execFile);

export { catalogWritable, overridesFile, readOverrides };
export type { OverridesFile, ProductOverride };

/** admin list/edit ke liye catalogue + overrides merged */
export function mergedProducts(): Product[] {
  const catalog = catalogJson as unknown as Catalog;
  const overrides = readOverrides();
  const hidden = new Set(overrides.hidden);
  return catalog.products.map((product) => {
    const patch = overrides.products[product.handle];
    const merged: Product & { hidden?: boolean } = patch
      ? {
          ...product,
          title: patch.title ?? product.title,
          price: patch.price ?? product.price,
          compareAtPrice: patch.compareAtPrice === undefined ? product.compareAtPrice : patch.compareAtPrice,
          inStock: patch.inStock ?? product.inStock,
          featured: patch.featured ?? product.featured,
          description: patch.description ?? product.description,
          collections: patch.collections ?? product.collections,
          images: patch.images?.length ? patch.images : product.images,
          sizePricing: { ...product.sizePricing, ...(patch.sizePricing ?? {}) } as Product["sizePricing"],
        }
      : product;
    merged.hidden = hidden.has(product.handle);
    return merged;
  });
}

export type AdminProduct = Product & { hidden?: boolean };

export function mergedProduct(handle: string): AdminProduct | null {
  return (mergedProducts() as AdminProduct[]).find((product) => product.handle === handle) ?? null;
}

export function saveProductOverride(handle: string, patch: ProductOverride, actor: string): boolean {
  const overrides = readOverrides();
  overrides.products[handle] = {
    ...overrides.products[handle],
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  return writeOverrides(overrides);
}

export function setProductHidden(handle: string, hidden: boolean, actor: string): boolean {
  const overrides = readOverrides();
  const set = new Set(overrides.hidden);
  if (hidden) set.add(handle);
  else set.delete(handle);
  overrides.hidden = [...set];
  overrides.products[handle] = {
    ...overrides.products[handle],
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  return writeOverrides(overrides);
}

export function saveCollectionOverride(
  handle: string,
  patch: { title?: string; subtitle?: string },
): boolean {
  const overrides = readOverrides();
  overrides.collections[handle] = { ...overrides.collections[handle], ...patch };
  return writeOverrides(overrides);
}

/**
 * Publish: seed overrides -> catalogue rebuild. Website usi build se serve hoti hai,
 * isliye admin ka edit live storefront par chala jaata hai.
 */
export async function publishCatalog(): Promise<{ ok: boolean; log: string }> {
  const root = repoRoot();
  if (!catalogWritable()) {
    return {
      ok: false,
      log: "Catalogue publish sirf repo checkout par chalta hai (deployed panel read-only hai). Edits local se push karein.",
    };
  }
  try {
    const { stdout, stderr } = await run("node", ["scripts/build-catalog.mjs"], {
      cwd: root,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const overrides = readOverrides();
    overrides.meta = { ...(overrides.meta ?? {}), lastPublishedAt: new Date().toISOString() };
    writeOverrides(overrides);
    return { ok: true, log: `${stdout}\n${stderr}`.trim().slice(-4000) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "build failed";
    return { ok: false, log: message.slice(0, 4000) };
  }
}

/** Kaunse products par admin edits hain (dashboard ke liye) */
export function overrideStats() {
  const overrides = readOverrides();
  return {
    edited: Object.keys(overrides.products).length,
    hidden: overrides.hidden.length,
    lastPublishedAt: overrides.meta?.lastPublishedAt ?? null,
  };
}
