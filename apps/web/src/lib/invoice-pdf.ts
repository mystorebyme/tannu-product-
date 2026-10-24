import "server-only";

import PDFDocument from "pdfkit";
import type { InvoiceView } from "@/lib/invoice";

const rupee = (paise: number) =>
  `Rs. ${((paise ?? 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * GST invoice PDF — pdfkit (pure JS, koi headless browser nahi).
 * Colours brand ke hain: maroon #862222.
 */
export function renderInvoicePdf(view: InvoiceView): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    // ── header ──
    doc.fillColor("#862222").font("Helvetica-Bold").fontSize(20).text("LIKSHA CLOTHING", left, 42);
    doc
      .fillColor("#5c534b")
      .font("Helvetica")
      .fontSize(8.5)
      .text(view.seller.address, left, 68)
      .text(`GSTIN: ${view.seller.gstin}`, left, 80)
      .text(`${view.seller.email} · ${view.seller.phone}`, left, 92);

    doc
      .fillColor("#862222")
      .font("Helvetica-Bold")
      .fontSize(13)
      .text("TAX INVOICE", left, 44, { width, align: "right" })
      .fillColor("#3f3830")
      .font("Helvetica")
      .fontSize(9)
      .text(view.number, left, 64, { width, align: "right" })
      .text(dateLabel(view.issuedAt), left, 78, { width, align: "right" })
      .text(`Place of supply: ${view.placeOfSupply}`, left, 92, { width, align: "right" });

    doc.moveTo(left, 112).lineTo(right, 112).strokeColor("#e9dfd4").stroke();

    // ── bill to / order ──
    doc.fillColor("#862222").font("Helvetica-Bold").fontSize(9).text("BILL TO", left, 124);
    doc.fillColor("#3f3830").font("Helvetica").fontSize(9);
    doc.text(view.buyer.name, left, 138);
    doc.text(view.buyer.address, left, 150, { width: width / 2 - 20 });
    const buyerLines = [
      `${view.buyer.city}, ${view.buyer.state} — ${view.buyer.pincode}`,
      `+91 ${view.buyer.phone}`,
      view.buyer.email,
    ];
    let buyerY = 138 + doc.heightOfString(view.buyer.address, { width: width / 2 - 20 }) + 4;
    for (const line of buyerLines) {
      doc.text(line, left, buyerY);
      buyerY += 12;
    }

    const metaX = left + width / 2;
    doc.fillColor("#862222").font("Helvetica-Bold").fontSize(9).text("ORDER", metaX, 124);
    doc.fillColor("#3f3830").font("Helvetica").fontSize(9);
    const meta = [
      ["Order number", view.order.orderNumber],
      ["Order date", dateLabel(view.order.createdAt)],
      ["Payment", view.order.paymentMethod === "cod" ? "Cash on delivery" : "Prepaid"],
      ["Payment status", view.order.paymentStatus],
    ];
    meta.forEach(([label, value], index) => {
      doc.fillColor("#8a8078").text(label, metaX, 138 + index * 13, { width: width / 2 });
      doc.fillColor("#3f3830").text(String(value), metaX, 138 + index * 13, { width: width / 2, align: "right" });
    });

    // ── items table ──
    let y = Math.max(buyerY, 138 + meta.length * 13) + 16;
    const cols = {
      item: left,
      hsn: left + width * 0.46,
      qty: left + width * 0.57,
      rate: left + width * 0.65,
      taxable: left + width * 0.75,
      gst: left + width * 0.87,
    };

    doc.rect(left, y, width, 20).fill("#f7f2ec");
    doc.fillColor("#862222").font("Helvetica-Bold").fontSize(8);
    doc.text("ITEM", cols.item + 6, y + 6);
    doc.text("HSN", cols.hsn, y + 6);
    doc.text("QTY", cols.qty, y + 6);
    doc.text("RATE", cols.rate, y + 6, { width: 60, align: "right" });
    doc.text("TAXABLE", cols.taxable, y + 6, { width: 60, align: "right" });
    doc.text("GST", cols.gst, y + 6, { width: 40, align: "right" });
    y += 20;

    doc.font("Helvetica").fontSize(8.5);
    const rows = [...view.lines, ...(view.shippingLine ? [view.shippingLine] : [])];
    for (const line of rows) {
      const title = `${line.title}${line.size && line.size !== "—" ? ` · ${line.size}` : ""}`;
      const titleHeight = doc.heightOfString(title, { width: width * 0.44 });
      const rowHeight = Math.max(22, titleHeight + 10);
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 130) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.fillColor("#2f2a25").text(title, cols.item + 6, y + 5, { width: width * 0.44 });
      doc.fillColor("#5c534b").text(line.hsn, cols.hsn, y + 5);
      doc.text(String(line.quantity), cols.qty, y + 5);
      doc.text(rupee(line.unitPrice), cols.rate, y + 5, { width: 60, align: "right" });
      doc.text(rupee(line.taxable), cols.taxable, y + 5, { width: 60, align: "right" });
      doc.text(`${line.rate}%`, cols.gst, y + 5, { width: 40, align: "right" });
      y += rowHeight;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#f1ebe5").stroke();
    }

    // ── totals ──
    y += 12;
    const totalsX = left + width * 0.55;
    const totalRow = (label: string, value: string, bold = false) => {
      doc
        .fillColor(bold ? "#862222" : "#5c534b")
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 10 : 9)
        .text(label, totalsX, y, { width: width * 0.24 })
        .text(value, totalsX, y, { width: width * 0.45 - 12, align: "right" });
      y += bold ? 16 : 14;
    };

    if (view.order.discount > 0) {
      totalRow("Discount", `− ${rupee(view.order.discount)}`);
    }
    totalRow("Taxable value", rupee(view.totals.taxable));
    if (view.interState) {
      totalRow(`IGST`, rupee(view.totals.igst));
    } else {
      totalRow("CGST", rupee(view.totals.cgst));
      totalRow("SGST", rupee(view.totals.sgst));
    }
    totalRow(`Total tax`, rupee(view.totals.tax));
    totalRow("Invoice total", rupee(view.order.total), true);

    // ── footer ──
    const footerY = doc.page.height - doc.page.margins.bottom - 62;
    doc
      .fillColor("#8a8078")
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        "Declaration: goods are dispatched from Jaipur, Rajasthan. Prices are inclusive of GST. " +
          "7 days replacement on unused products with tags intact. This is a computer-generated invoice.",
        left,
        footerY,
        { width },
      )
      .text(
        `For any query: WhatsApp ${view.seller.phone} · ${view.seller.email}`,
        left,
        footerY + 26,
        { width },
      )
      .fillColor("#862222")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("For LIKSHA CLOTHING", left, footerY + 40, { width, align: "right" });

    doc.end();
  });
}
