"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type AdminProduct = {
  id: number;
  handle: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  collections: string[];
  category: string;
  fabric: string;
  color: string;
  details: string[];
  sizes: string[];
  description: string;
  inStock: boolean;
  featured: boolean;
  sortOrder: number;
};

const ALL_COLLECTIONS = [
  "party-wear-gown",
  "new-arrivals",
  "likshas-choice",
  "lehnga-choli",
  "printed-suit-set",
  "saree",
  "sale",
  "weddin-collection",
];

const CATEGORIES = ["anarkali", "lehnga", "printed", "saree"];

const emptyProduct = (): AdminProduct => ({
  id: 0,
  handle: "",
  title: "",
  price: 299900,
  compareAtPrice: 799900,
  images: [],
  collections: ["new-arrivals"],
  category: "anarkali",
  fabric: "Premium Georgette",
  color: "As Shown",
  details: [],
  sizes: ["S", "M", "L", "XL", "XXL"],
  description: "",
  inStock: true,
  featured: false,
  sortOrder: 0,
});

export function ProductsManager({
  products,
  initialQuery,
  initialCollection,
  initialCategory,
}: {
  products: AdminProduct[];
  initialQuery: string;
  initialCollection: string;
  initialCategory: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [collection, setCollection] = useState(initialCollection);
  const [category, setCategory] = useState(initialCategory);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [visible, setVisible] = useState(40);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (term && !`${product.title} ${product.handle} ${product.color} ${product.fabric}`.toLowerCase().includes(term)) {
        return false;
      }
      if (collection && !product.collections.includes(collection)) return false;
      if (category && product.category !== category) return false;
      return true;
    });
  }, [products, query, collection, category]);

  const save = useCallback(
    async (product: AdminProduct) => {
      setBusy(true);
      setNotice(null);
      try {
        const response = await fetch(product.id ? `/api/admin/products/${product.id}` : "/api/admin/products", {
          method: product.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...product,
            price: Math.round(Number(product.price) || 0),
            compareAtPrice: Math.round(Number(product.compareAtPrice) || 0),
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setNotice(payload.error ?? "Could not save the product.");
          setBusy(false);
          return;
        }
        setEditing(null);
        setNotice("Product saved.");
        router.refresh();
      } catch {
        setNotice("Network error while saving.");
      }
      setBusy(false);
    },
    [router],
  );

  const remove = useCallback(
    async (product: AdminProduct) => {
      if (!window.confirm(`Delete "${product.title}"? This cannot be undone.`)) return;
      setBusy(true);
      try {
        await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
        setNotice("Product deleted.");
        router.refresh();
      } catch {
        setNotice("Network error while deleting.");
      }
      setBusy(false);
    },
    [router],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border border-[#e4d9cd] bg-white p-3">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisible(40);
          }}
          placeholder="Search by title, handle, colour, fabric…"
          className="h-10 min-w-[220px] flex-1 border border-[#e0d6ca] px-3 text-[12px] outline-none focus:border-[#862222]"
        />
        <select
          value={collection}
          onChange={(event) => setCollection(event.target.value)}
          className="h-10 border border-[#e0d6ca] px-2.5 text-[11.5px] outline-none"
        >
          <option value="">All collections</option>
          {ALL_COLLECTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-10 border border-[#e0d6ca] px-2.5 text-[11.5px] outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setEditing(emptyProduct())}
          className="h-10 bg-[#862222] px-4 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
        >
          + New product
        </button>
      </div>

      {notice ? (
        <p className="mt-2 border border-[#e4d9cd] bg-[#fffaf0] px-3 py-2 text-[11.5px] text-[#7a5b1e]">{notice}</p>
      ) : null}

      <div className="mt-3 border border-[#e4d9cd] bg-white">
        <div className="flex items-center justify-between border-b border-[#f1ebe5] px-4 py-2.5">
          <p className="text-[11px] text-[#8a8078]">
            Showing {Math.min(visible, filtered.length)} of {filtered.length} products
          </p>
          <p className="text-[10.5px] text-[#a49a90]">Prices in rupees (enter 2999 for Rs. 2,999)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[12px]">
            <thead>
              <tr className="bg-[#faf8f5] text-left text-[9.5px] tracking-[.14em] text-[#9c8f82] uppercase">
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Images</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visible).map((product) => (
                <tr key={product.handle} className="border-t border-[#f4efe9] align-top hover:bg-[#fdfbf9]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-start gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.images[0] ?? "/images/site/cat-anarkali.jpg"}
                        alt=""
                        className="h-14 w-11 shrink-0 border border-[#eee6de] object-cover"
                      />
                      <div className="max-w-[260px]">
                        <div className="line-clamp-2 font-medium">{product.title}</div>
                        <div className="mt-0.5 text-[10px] text-[#a49a90]">{product.handle}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {product.collections.slice(0, 3).map((item) => (
                            <span key={item} className="bg-[#f4efe9] px-1.5 py-0.5 text-[9px] text-[#6b6259]">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#862222]">₹{Math.round(product.price / 100).toLocaleString("en-IN")}</div>
                    {product.compareAtPrice ? (
                      <div className="text-[10px] text-[#a49a90] line-through">
                        ₹{Math.round(product.compareAtPrice / 100).toLocaleString("en-IN")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="capitalize">{product.category}</div>
                    <div className="text-[10px] text-[#a49a90]">{product.color}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex -space-x-1">
                      {product.images.slice(0, 4).map((image) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={image}
                          src={image}
                          alt=""
                          className="h-8 w-6 border border-white object-cover"
                        />
                      ))}
                    </div>
                    <div className="mt-1 text-[10px] text-[#a49a90]">{product.images.length} photos</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${
                        product.inStock ? "bg-[#eaf6ec] text-[#2f7a3f]" : "bg-[#fbeaea] text-[#b3261e]"
                      }`}
                    >
                      {product.inStock ? "In stock" : "Sold out"}
                    </span>
                    {product.featured ? (
                      <div className="mt-1 text-[9.5px] text-[#94620c]">★ Featured</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(product)}
                        className="border border-[#862222] px-2.5 py-1 text-[10px] tracking-[.1em] text-[#862222] uppercase"
                      >
                        Edit
                      </button>
                      <a
                        href={`/products/${product.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#8a8078] underline"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => remove(product)}
                        disabled={busy}
                        className="text-[10px] text-[#b3261e] underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible < filtered.length ? (
          <div className="border-t border-[#f1ebe5] p-3 text-center">
            <button
              type="button"
              onClick={() => setVisible((value) => value + 40)}
              className="border border-[#862222] px-6 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-[#862222] uppercase"
            >
              Load more
            </button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <ProductForm
          product={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={save}
          onChange={setEditing}
        />
      ) : null}
    </div>
  );
}

function ProductForm({
  product,
  busy,
  onCancel,
  onSave,
  onChange,
}: {
  product: AdminProduct;
  busy: boolean;
  onCancel: () => void;
  onSave: (product: AdminProduct) => void;
  onChange: (product: AdminProduct) => void;
}) {
  const update = (patch: Partial<AdminProduct>) => onChange({ ...product, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:p-6">
      <div className="w-full max-w-[820px] border border-[#e4d9cd] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#f1ebe5] px-5 py-3.5">
          <h2 className="text-[11.5px] font-semibold tracking-[.16em] uppercase">
            {product.id ? "Edit product" : "New product"}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-xl leading-none">
            ×
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input
                value={product.title}
                onChange={(event) => update({ title: event.target.value })}
                className="input"
              />
            </Field>
            <Field label="Handle (URL slug)">
              <input
                value={product.handle}
                onChange={(event) => update({ handle: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
                className="input"
              />
            </Field>
            <Field label="Price (rupees)">
              <input
                type="number"
                value={Math.round(product.price / 100)}
                onChange={(event) => update({ price: Number(event.target.value) * 100 })}
                className="input"
              />
            </Field>
            <Field label="Compare-at price (rupees)">
              <input
                type="number"
                value={product.compareAtPrice ? Math.round(product.compareAtPrice / 100) : 0}
                onChange={(event) => update({ compareAtPrice: Number(event.target.value) * 100 })}
                className="input"
              />
            </Field>
            <Field label="Category">
              <select
                value={product.category}
                onChange={(event) => update({ category: event.target.value })}
                className="input"
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Colour">
              <input value={product.color} onChange={(event) => update({ color: event.target.value })} className="input" />
            </Field>
            <Field label="Fabric">
              <input value={product.fabric} onChange={(event) => update({ fabric: event.target.value })} className="input" />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={product.sortOrder}
                onChange={(event) => update({ sortOrder: Number(event.target.value) })}
                className="input"
              />
            </Field>
          </div>

          <Field label="Images (one URL per line — they appear as the gallery on the product page)">
            <textarea
              rows={5}
              value={product.images.join("\n")}
              onChange={(event) =>
                update({ images: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })
              }
              className="w-full border border-[#ddd2c6] px-3 py-2 text-[12px] outline-none focus:border-[#862222]"
            />
          </Field>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {product.images.slice(0, 8).map((image) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={image} src={image} alt="" className="h-16 w-12 border border-[#eee6de] object-cover" />
            ))}
          </div>

          <Field label="Sizes (one per line)">
            <textarea
              rows={3}
              value={product.sizes.join("\n")}
              onChange={(event) =>
                update({ sizes: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })
              }
              className="w-full border border-[#ddd2c6] px-3 py-2 text-[12px] outline-none focus:border-[#862222]"
            />
          </Field>

          <Field label="Product details (one bullet per line)">
            <textarea
              rows={5}
              value={product.details.join("\n")}
              onChange={(event) =>
                update({ details: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })
              }
              className="w-full border border-[#ddd2c6] px-3 py-2 text-[12px] outline-none focus:border-[#862222]"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={4}
              value={product.description}
              onChange={(event) => update({ description: event.target.value })}
              className="w-full border border-[#ddd2c6] px-3 py-2 text-[12px] outline-none focus:border-[#862222]"
            />
          </Field>

          <div className="mt-3">
            <p className="text-[10px] tracking-[.14em] text-[#6b6259] uppercase">Collections</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALL_COLLECTIONS.map((item) => {
                const active = product.collections.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      update({
                        collections: active
                          ? product.collections.filter((value) => value !== item)
                          : [...product.collections, item],
                      })
                    }
                    className={`border px-2.5 py-1.5 text-[10.5px] ${
                      active ? "border-[#862222] bg-[#862222] text-white" : "border-[#ddd2c6] text-[#5c534b]"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[11.5px]">
              <input
                type="checkbox"
                checked={product.inStock}
                onChange={(event) => update({ inStock: event.target.checked })}
                className="accent-[#862222]"
              />
              In stock
            </label>
            <label className="flex items-center gap-2 text-[11.5px]">
              <input
                type="checkbox"
                checked={product.featured}
                onChange={(event) => update({ featured: event.target.checked })}
                className="accent-[#862222]"
              />
              Featured on home
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#f1ebe5] px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="border border-[#ddd2c6] px-5 py-2.5 text-[10.5px] font-semibold tracking-[.14em] uppercase"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(product)}
            className="bg-[#862222] px-6 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
      </div>

      <style>{`.input{height:40px;width:100%;border:1px solid #ddd2c6;padding:0 10px;font-size:12px;outline:none}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] tracking-[.14em] text-[#6b6259] uppercase">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
