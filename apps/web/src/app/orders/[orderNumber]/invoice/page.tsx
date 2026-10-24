import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureInvoice, getOrder } from "@/lib/orders";
import { buildInvoice } from "@/lib/invoice";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GST invoice", robots: { index: false, follow: false } };

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { orderNumber } = await params;
  const { phone = "" } = await searchParams;
  const order = getOrder(orderNumber);
  if (!order) notFound();

  const digits = phone.replace(/\D/g, "");
  const verified = digits.length >= 4 && digits.slice(-4) === order.phone.replace(/\D/g, "").slice(-4);

  if (!verified) {
    return (
      <div className="container-liksha py-14">
        <div className="mx-auto max-w-[420px] border border-[#e9dfd4] bg-[#faf8f5] p-6">
          <h1 className="font-display text-[24px] font-medium">Download GST invoice</h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#6b6259]">
            Order <strong>{order.orderNumber}</strong> ki invoice ke liye order ke phone number ke
            aakhri 4 digit daaliye.
          </p>
          <form method="get" className="mt-4 flex">
            <input
              name="phone"
              inputMode="numeric"
              maxLength={10}
              required
              placeholder="Last 4 digits"
              className="h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222]"
            />
            <button
              type="submit"
              className="shrink-0 bg-[#862222] px-5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
            >
              Open
            </button>
          </form>
          <p className="mt-3 text-[11px] text-[#8a8078]">
            <Link href={`/orders/${order.orderNumber}`} className="underline">
              Back to order
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const { order: withInvoice, invoice } = ensureInvoice(order.orderNumber);
  const view = buildInvoice(withInvoice, invoice.number, invoice.issuedAt);
  const rows = [...view.lines, ...(view.shippingLine ? [view.shippingLine] : [])];

  return (
    <div className="container-liksha py-8 print:py-0">
      <div className="mx-auto max-w-[860px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/orders/${order.orderNumber}`} className="text-[12px] text-[#862222] underline">
            ← Back to order
          </Link>
          <div className="flex gap-2">
            <a
              href={`/api/orders/${order.orderNumber}/invoice?phone=${encodeURIComponent(phone)}`}
              className="border border-[#862222] px-4 py-2 text-[10.5px] font-semibold tracking-[.14em] text-[#862222] uppercase"
            >
              Download PDF
            </a>
            <a
              href="javascript:window.print()"
              className="bg-[#862222] px-4 py-2 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
            >
              Print
            </a>
          </div>
        </div>

        <div className="border border-[#e9dfd4] bg-white p-6 sm:p-9 print:border-0 print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e9dfd4] pb-4">
            <div>
              <h1 className="font-display text-[26px] font-semibold tracking-[.06em] text-[#862222]">
                LIKSHA CLOTHING
              </h1>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#6b6259]">
                {view.seller.address}
                <br />
                GSTIN: <strong>{view.seller.gstin}</strong>
                <br />
                {view.seller.email} · {view.seller.phone}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold tracking-[.14em] text-[#862222] uppercase">Tax invoice</p>
              <p className="mt-1 text-[12px]">{view.number}</p>
              <p className="text-[11.5px] text-[#6b6259]">{formatDate(view.issuedAt)}</p>
              <p className="text-[11.5px] text-[#6b6259]">Place of supply: {view.placeOfSupply}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold tracking-[.16em] text-[#862222] uppercase">Bill to</p>
              <p className="mt-1.5 text-[12px] leading-relaxed">
                <strong>{view.buyer.name}</strong>
                <br />
                {view.buyer.address}
                <br />
                {view.buyer.city}, {view.buyer.state} — {view.buyer.pincode}
                <br />
                +91 {view.buyer.phone}
                <br />
                {view.buyer.email}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[.16em] text-[#862222] uppercase">Order</p>
              <p className="mt-1.5 text-[12px] leading-relaxed">
                {order.orderNumber}
                <br />
                {formatDate(order.createdAt)}
                <br />
                {order.paymentMethod === "cod" ? "Cash on delivery" : "Prepaid"} · {order.paymentStatus}
              </p>
            </div>
          </div>

          <table className="mt-5 w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-[#f7f2ec] text-left">
                <th className="p-2 font-semibold">Item</th>
                <th className="p-2 font-semibold">HSN</th>
                <th className="p-2 text-right font-semibold">Qty</th>
                <th className="p-2 text-right font-semibold">Rate</th>
                <th className="p-2 text-right font-semibold">Taxable</th>
                <th className="p-2 text-right font-semibold">GST</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((line, index) => (
                <tr key={`${line.title}-${index}`} className="border-b border-[#f1ebe5]">
                  <td className="p-2 align-top">
                    {line.title}
                    {line.size && line.size !== "—" ? <span className="text-[#8a8078]"> · {line.size}</span> : null}
                  </td>
                  <td className="p-2 align-top text-[#6b6259]">{line.hsn}</td>
                  <td className="p-2 text-right align-top">{line.quantity}</td>
                  <td className="p-2 text-right align-top">{rupees(line.unitPrice)}</td>
                  <td className="p-2 text-right align-top">{rupees(line.taxable)}</td>
                  <td className="p-2 text-right align-top">{line.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-full max-w-[320px] space-y-1.5 text-[12px]">
            {order.discount > 0 ? <Row label="Discount" value={`− ${rupees(order.discount)}`} /> : null}
            <Row label="Taxable value" value={rupees(view.totals.taxable)} />
            {view.interState ? (
              <Row label="IGST" value={rupees(view.totals.igst)} />
            ) : (
              <>
                <Row label="CGST" value={rupees(view.totals.cgst)} />
                <Row label="SGST" value={rupees(view.totals.sgst)} />
              </>
            )}
            <Row label="Total tax" value={rupees(view.totals.tax)} />
            <div className="flex justify-between border-t border-[#e9dfd4] pt-1.5 text-[13px] font-semibold text-[#862222]">
              <span>Invoice total</span>
              <span>{rupees(order.total)}</span>
            </div>
          </div>

          <p className="mt-6 border-t border-[#e9dfd4] pt-3 text-[10.5px] leading-relaxed text-[#8a8078]">
            Declaration: goods are dispatched from Jaipur, Rajasthan. Prices are inclusive of GST. 7 days
            replacement on unused products with tags intact. This is a computer-generated invoice.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#6b6259]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
