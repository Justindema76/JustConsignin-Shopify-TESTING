import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { loadItemLabel } from "../item-label.server";
import { buildBarcode } from "../components/consignment/ItemBarcode";

export async function loader(args) {
  const item = await loadItemLabel(args);
  const barcode = buildBarcode(item.itemNumber);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([162, 90]); // 2.25 × 1.25 inches, in PDF points.
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const price = new Intl.NumberFormat("en-CA", { style: "currency", currency: item.currency }).format(Number(item.price));
  const printable = (value) => Array.from(String(value)).map((character) => {
    try { font.encodeText(character); return character; } catch { return "?"; }
  }).join("");
  const priceText = printable(price);
  const priceWidth = font.widthOfTextAtSize(priceText, 8);
  let description = printable(item.description);
  const availableWidth = Math.max(0, 144 - priceWidth);
  if (font.widthOfTextAtSize(description, 8) > availableWidth) {
    while (description && font.widthOfTextAtSize(`${description}...`, 8) > availableWidth) description = description.slice(0, -1);
    description = `${description}...`;
  }
  page.drawText(description, { x: 6, y: 78, size: 8, font });
  page.drawText(priceText, { x: 156 - priceWidth, y: 78, size: 8, font });
  const scale = 150 / barcode.totalWidth;
  for (const bar of barcode.bars) {
    page.drawRectangle({ x: 6 + bar.props.x * scale, y: 25, width: bar.props.width * scale, height: 44, color: rgb(0, 0, 0) });
  }
  const ticketWidth = font.widthOfTextAtSize(barcode.readableValue, 10);
  page.drawText(barcode.readableValue, { x: (162 - ticketWidth) / 2, y: 10, size: 10, font });
  const bytes = await pdf.save();
  const filename = `label-${item.itemNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  return new Response(bytes, { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
