import Link from "next/link";
import { notFound } from "next/navigation";
import { getProducts } from "@/lib/data";
import { inr } from "@/lib/format";
import { updatePriceAction, updateStockAction } from "@/app/actions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProducts().find((item) => item.handle === decodeURIComponent(id));
  if (!product) notFound();
  const session = await getSession();

  return (
    <>
      <div className="topbar">
        <div>
          <p className="small muted">
            <Link href="/products">← Products</Link>
          </p>
          <h1>{product.title}</h1>
          <p className="mono small">{product.handle}</p>
        </div>
        <a className="btn" href={`${process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000"}/products/${product.handle}`} target="_blank" rel="noreferrer">
          View on store
        </a>
      </div>

      <div className="row">
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel-head">
            <h2>Catalogue details</h2>
          </div>
          <div className="panel-body">
            <div className="row">
              <div className="field">
                <label>Price (₹)</label>
                <form action={updatePriceAction} className="actions">
                  <input type="hidden" name="handle" value={product.handle} />
                  <input type="hidden" name="actor" value={session?.email ?? "admin"} />
                  <input
                    name="price"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={Math.round(product.price / 100)}
                    style={{ width: 140 }}
                  />
                  <button className="btn btn-sm btn-primary" type="submit">
                    Save price
                  </button>
                </form>
                <p className="small muted" style={{ marginTop: 6 }}>
                  Current: {inr(product.price)} · MRP {product.compareAtPrice ? inr(product.compareAtPrice) : "—"}
                </p>
              </div>
              <div className="field">
                <label>Stock</label>
                <form action={updateStockAction} className="actions">
                  <input type="hidden" name="handle" value={product.handle} />
                  <input type="hidden" name="inStock" value={product.inStock ? "false" : "true"} />
                  <input type="hidden" name="actor" value={session?.email ?? "admin"} />
                  <button className="btn btn-sm" type="submit">
                    {product.inStock ? "Mark out of stock" : "Restock"}
                  </button>
                </form>
                <p className="small muted" style={{ marginTop: 6 }}>
                  Status: {product.inStock ? "In stock" : "Out of stock"}
                </p>
              </div>
            </div>

            <table style={{ marginTop: 8 }}>
              <tbody>
                <tr>
                  <td className="muted">Category</td>
                  <td>{product.category}</td>
                </tr>
                <tr>
                  <td className="muted">Fabric</td>
                  <td>{product.fabric}</td>
                </tr>
                <tr>
                  <td className="muted">Colour</td>
                  <td>{product.color}</td>
                </tr>
                <tr>
                  <td className="muted">Sizes</td>
                  <td>{product.sizes.join(", ")}</td>
                </tr>
                <tr>
                  <td className="muted">Collections</td>
                  <td>{product.collections.join(", ")}</td>
                </tr>
                <tr>
                  <td className="muted">Rating</td>
                  <td>
                    {product.rating} ({product.reviewCount} reviews)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel-head">
            <h2>Images</h2>
          </div>
          <div className="panel-body">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${product.images[0]}?width=600`} alt={product.title} style={{ width: "100%", borderRadius: 8 }} />
            <p className="small muted">
              Images Shopify CDN se aate hain. Naya image upload karne ke liye presigned URL flow use karein
              (uploads module).
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Description & detail points</h2>
        </div>
        <div className="panel-body small">
          <p>{product.description}</p>
          <ul>
            {product.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
