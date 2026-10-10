/* eslint-disable react/prop-types */

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Printer, X } from "lucide-react";
import { useLocation } from "react-router";

const CODE_128_PATTERNS = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

function code128Values(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  const characterValues = Array.from(text).map((character) => {
    const code = character.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error("Barcode values must use standard printable characters.");
    return code - 32;
  });
  const startCode = 104;
  const checksum = (startCode + characterValues.reduce((total, characterValue, index) => total + characterValue * (index + 1), 0)) % 103;
  return [startCode, ...characterValues, checksum, 106];
}

export function buildBarcode(value) {
  const values = code128Values(value);
  if (!values.length) return null;
  const quietZone = 12;
  let cursor = quietZone;
  const bars = [];
  values.forEach((codeValue, codeIndex) => {
    Array.from(CODE_128_PATTERNS[codeValue]).forEach((widthCharacter, patternIndex) => {
      const width = Number(widthCharacter);
      if (patternIndex % 2 === 0) bars.push(<rect key={`${codeIndex}-${patternIndex}`} x={cursor} y="0" width={width} height="54" fill="#000" />);
      cursor += width;
    });
  });
  return { bars, readableValue: String(value).trim(), totalWidth: cursor + quietZone };
}

export function BarcodeGraphic({ barcode }) {
  return <div className="consignment-item-barcode-graphic" role="img" aria-label={`Barcode for item ${barcode.readableValue}`}>
    <svg viewBox={`0 0 ${barcode.totalWidth} 76`} preserveAspectRatio="none" aria-hidden="true">
      <rect width={barcode.totalWidth} height="76" fill="#fff" />
      {barcode.bars}
      <text x={barcode.totalWidth / 2} y="70" textAnchor="middle" fill="#000" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" letterSpacing="1">{barcode.readableValue}</text>
    </svg>
  </div>;
}

function svgToPngBlob(svg, width = 900, height = 300) {
  return new Promise((resolve, reject) => {
    const copy = svg.cloneNode(true);
    copy.setAttribute("width", String(width));
    copy.setAttribute("height", String(height));
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((png) => { URL.revokeObjectURL(url); png ? resolve(png) : reject(new Error("PNG failed")); }, "image/png");
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image failed")); };
    image.src = url;
  });
}

// Print just the label: copy the preview into a hidden frame sized to the
// 2.25 × 1.25 in label and open the browser's print dialog for that frame,
// so the rest of the app never prints and the page stays put.
const LABEL_PRINT_CSS = `
@page{size:2.25in 1.25in;margin:0}
html,body{margin:0;padding:0;background:#fff}
.consignment-print-sheet{box-sizing:border-box;width:2.25in;height:1.25in;padding:.08in;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff}
.consignment-print-heading{display:flex;justify-content:space-between;gap:6px;height:.22in;font-size:8pt;font-weight:bold;line-height:1.1}
.consignment-print-heading strong{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.consignment-print-heading span{white-space:nowrap}
.consignment-item-barcode-graphic{padding:0;border:0;background:#fff}
.consignment-item-barcode-graphic svg{display:block;width:2.09in;height:.86in}`;

function printLabelSheet(sheet) {
  if (!sheet) return;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Label</title><style>${LABEL_PRINT_CSS}</style></head><body>${sheet.outerHTML}</body></html>`);
  doc.close();
  const cleanup = () => { if (frame.parentNode) frame.parentNode.removeChild(frame); };
  frame.contentWindow.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 60000);
  window.setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }, 50);
}

// Pop-up preview of the printed label. Matches the PDF from
// /app/print/:itemNumber.pdf: 2.25 × 1.25 in, description and price on top,
// barcode below.
function PrintLabelDialog({ barcode, description, price, currency, pdfUrl, onClose }) {
  const sheetRef = useRef(null);
  useEffect(() => {
    function onKey(event) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  let priceText;
  try {
    priceText = new Intl.NumberFormat("en-CA", { style: "currency", currency: currency || "CAD" }).format(Number(price || 0));
  } catch {
    priceText = `$${Number(price || 0).toFixed(2)}`;
  }

  return <div className="consignment-print-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="consignment-print-dialog" role="dialog" aria-modal="true" aria-labelledby="print-label-title">
      <header className="consignment-print-head">
        <strong id="print-label-title">Print label</strong>
        <button type="button" className="consignment-print-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </header>
      <p className="consignment-print-note">This is what prints. Label size 2.25 × 1.25 in.</p>
      <div className="consignment-print-preview">
        <div className="consignment-print-sheet" ref={sheetRef} aria-label={`Label for ${barcode.readableValue}`}>
          <div className="consignment-print-heading"><strong>{description}</strong><span>{priceText}</span></div>
          <BarcodeGraphic barcode={barcode} />
        </div>
      </div>
      <p className="consignment-print-note">In the Shopify phone app, use Download PDF, open it in Files, then choose Share → Print.</p>
      <footer className="consignment-print-actions">
        <button type="button" className="consignment-btn secondary" onClick={onClose}>Close</button>
        <a className="consignment-btn secondary" href={pdfUrl} download={`label-${barcode.readableValue}.pdf`}><Download size={16} />Download PDF</a>
        <button type="button" className="consignment-btn" onClick={() => printLabelSheet(sheetRef.current)}><Printer size={16} />Print</button>
      </footer>
    </section>
  </div>;
}

// `compact` renders a barcode chip + Print label for the item header;
// copy and print behave the same in both layouts.
export default function ItemBarcode({ value, description = "Consignment item", price = 0, currency = "CAD", compact = false }) {
  const barcodeRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState("idle");
  const [printOpen, setPrintOpen] = useState(false);
  const location = useLocation();
  let barcode;
  try { barcode = buildBarcode(value); } catch { barcode = null; }

  const getSvg = () => barcodeRef.current?.querySelector("svg") || null;

  async function shareBarcode(svg) {
    if (!navigator.share || typeof File === "undefined") return false;
    try {
      const png = await svgToPngBlob(svg, 900, 300);
      const file = new File([png], `barcode-${barcode.readableValue}.png`, { type: "image/png" });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
      await navigator.share({ files: [file], title: `${description} barcode` });
      return true;
    } catch (error) { return error?.name === "AbortError"; }
  }

  async function copyBarcode() {
    const svg = getSvg();
    if (!svg) return;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        const png = await svgToPngBlob(svg);
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
        setCopyStatus("copied");
      } else if (await shareBarcode(svg)) setCopyStatus("shared");
      else setCopyStatus("error");
    } catch {
      setCopyStatus((await shareBarcode(svg)) ? "shared" : "error");
    }
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  function printLabel() {
    setPrintOpen(true);
  }

  if (!barcode) return null;
  if (compact) {
    const copyLabel = copyStatus === "copied" ? "Copied" : copyStatus === "shared" ? "Share opened" : copyStatus === "error" ? "Copy unavailable" : "Copy barcode";
    return <div className="consignment-barcode-chip-row" ref={barcodeRef}>
      <div className="consignment-barcode-chip">
        <BarcodeGraphic barcode={barcode} />
        <span className="consignment-barcode-chip-value">{barcode.readableValue}</span>
        <button type="button" className="consignment-barcode-chip-copy" onClick={copyBarcode} aria-label={copyLabel} title={copyLabel}>{copyStatus === "copied" ? <Check size={16} /> : <Copy size={16} />}</button>
      </div>
      <button type="button" className="consignment-btn secondary" onClick={printLabel}><Printer size={16} />Print label</button>
    {printOpen && (
      <PrintLabelDialog
        barcode={barcode}
        description={description}
        price={price}
        currency={currency}
        pdfUrl={`/app/print/${encodeURIComponent(barcode.readableValue)}.pdf${location.search}`}
        onClose={() => setPrintOpen(false)}
      />
    )}
    </div>;
  }
  return <section className="consignment-item-barcode-card" ref={barcodeRef}>
    <BarcodeGraphic barcode={barcode} />
    <div className="consignment-item-barcode-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <button type="button" className="consignment-btn secondary consignment-item-barcode-button" onClick={copyBarcode}>{copyStatus === "copied" ? <Check size={17} /> : <Copy size={17} />}{copyStatus === "copied" ? "Copied" : copyStatus === "shared" ? "Share opened" : copyStatus === "error" ? "Copy unavailable" : "Copy barcode"}</button>
      <button type="button" className="consignment-btn consignment-item-barcode-button" onClick={printLabel}><Printer size={17} />Print label</button>
    </div>
    {printOpen && (
      <PrintLabelDialog
        barcode={barcode}
        description={description}
        price={price}
        currency={currency}
        pdfUrl={`/app/print/${encodeURIComponent(barcode.readableValue)}.pdf${location.search}`}
        onClose={() => setPrintOpen(false)}
      />
    )}
  </section>;
}
