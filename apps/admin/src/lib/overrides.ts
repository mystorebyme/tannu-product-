import fs from "node:fs";
import path from "node:path";

/**
 * Admin ke catalogue edits ki ek hi jagah.
 *
 * Ye module leaf hai (koi app import nahi) taaki tests aur server actions dono
 * ise seedha load kar sakein aur circular import na bane.
 */

export function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (fs.existsSync(path.join(dir, "turbo.json")) || fs.existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export type ProductOverride = {
  title?: string;
  price?: number;
  compareAtPrice?: number | null;
  inStock?: boolean;
  featured?: boolean;
  description?: string;
  collections?: string[];
  sizePricing?: Record<string, { price?: number; available?: boolean }>;
  images?: string[];
  updatedAt?: string;
  updatedBy?: string;
};

export type OverridesFile = {
  meta?: { note?: string; lastPublishedAt?: string | null };
  products: Record<string, ProductOverride>;
  collections: Record<string, { title?: string; subtitle?: string }>;
  hidden: string[];
};

const EMPTY: OverridesFile = { products: {}, collections: {}, hidden: [] };

export function overridesFile(): string {
  return path.join(repoRoot(), "database/seeds/admin/overrides.json");
}

export function readOverrides(): OverridesFile {
  const file = overridesFile();
  if (!fs.existsSync(file)) return { ...EMPTY, products: {}, collections: {}, hidden: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<OverridesFile>;
    return {
      meta: parsed.meta ?? EMPTY.meta,
      products: parsed.products ?? {},
      collections: parsed.collections ?? {},
      hidden: parsed.hidden ?? [],
    };
  } catch {
    return { ...EMPTY, products: {}, collections: {}, hidden: [] };
  }
}

/**
 * Catalogue edits repo ke andar jaate hain (source of truth GitHub) aur publish
 * par catalogue rebuild hota hai. Deployed container me filesystem read-only hota
 * hai — wahan crash karne ke bajaye saaf message dikhate hain.
 */
export function catalogWritable(): boolean {
  try {
    const root = repoRoot();
    fs.accessSync(root, fs.constants.W_OK);
    return fs.existsSync(path.join(root, "scripts/build-catalog.mjs"));
  } catch {
    return false;
  }
}

export function writeOverrides(next: OverridesFile): boolean {
  if (!catalogWritable()) return false;
  try {
    const file = overridesFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(next, null, 2)}\n`);
    fs.renameSync(`${file}.tmp`, file);
    return true;
  } catch {
    return false;
  }
}
