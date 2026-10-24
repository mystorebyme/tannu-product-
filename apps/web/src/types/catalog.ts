import type { Collection, Product } from "@liksha/types";

export type { Collection, Product };

export type CatalogProduct = Product;
export type CatalogCollection = Collection;

export type SearchHit = Pick<Product, "handle" | "title" | "price" | "compareAtPrice" | "images"> & {
  color: string;
  fabric: string;
};

export type MiniProduct = {
  handle: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  size?: string;
};
