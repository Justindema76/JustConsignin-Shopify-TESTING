import { Link, useLoaderData, useLocation, useRouteError, isRouteErrorResponse } from "react-router";
import { loadItemLabel } from "../item-label.server";
import { BarcodeGraphic, buildBarcode } from "../components/consignment/ItemBarcode";

export const loader = loadItemLabel;

const PRINT_STYLES = `
.item-label-route{padding:20px;font-family:Arial,sans-serif;color:#111;background:#fff;min-height:100vh}
.item-label-route h1{font-size:20px;margin:0 0 16px}
.item-label-sheet{box-sizing:border-box;width:2.25in;height:1.25in;padding:.08in;border:1px solid #ddd;background:white;overflow:hidden}
.item-label-heading{display:flex;justify-content:space-between;gap:6px;height:.22in;font-size:8pt;font-weight:bold;line-height:1.1}
.item-label-heading strong{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.item-label-heading span{white-space:nowrap}
.item-label-sheet .consignment-item-barcode-graphic{padding:0;border:0;background:white}
.item-label-sheet svg{display:block;width:2.09in;height:.86in}
.item-label-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:20px}
.item-label-actions button{background:#1677d2;color:white;border:0;border-radius:4px;padding:12px 20px;font:inherit;cursor:pointer}
.item-label-route p{max-width:420px;line-height:1.5}
@media print{
  @page{size:2.25in 1.25in;margin:0}
  html,body{margin:0!important;padding:0!important;background:#fff!important}
  body *{visibility:hidden!important}
  .item-label-sheet,.item-label-sheet *{visibility:visible!important}
  .item-label-route{padding:0!important;min-height:0!important}
  .item-label-sheet{position:absolute!important;top:0!important;left:0!important;border:0!important}
  .item-label-actions,.item-label-route h1,.item-label-route p{display:none!important}
}`;

export default function PrintItemLabel() {
  const item = useLoaderData();
  const location = useLocation();
  const pdfUrl = `/app/print/${encodeURIComponent(item.itemNumber)}.pdf${location.search}`;
  const barcode = buildBarcode(item.itemNumber);
  const price = new Intl.NumberFormat("en-CA", { style: "currency", currency: item.currency }).format(Number(item.price));

  return <main className="item-label-route">
    <style>{PRINT_STYLES}</style>
    <h1>Print label</h1>
    <section className="item-label-sheet" aria-label={`Label for ${item.itemNumber}`}>
      <div className="item-label-heading"><strong>{item.description}</strong><span>{price}</span></div>
      <BarcodeGraphic barcode={barcode} />
    </section>
    <div className="item-label-actions">
      <a href={pdfUrl} download={`label-${item.itemNumber}.pdf`}>Download PDF</a>
      <Link to={`/app${location.search}`}>Back to app</Link>
    </div>
    <p>Label size: 2.25 × 1.25 inches. Download the PDF, open it in Files, then choose Share → Print.</p>
  </main>;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  return <main className="item-label-route">
    <h1>Unable to load label</h1>
    <p role="alert">{isRouteErrorResponse(error) ? String(error.data) : "Unable to load this label. Please return to the app and try again."}</p>
    <Link to={`/app${location.search}`}>Back to app</Link>
  </main>;
}
