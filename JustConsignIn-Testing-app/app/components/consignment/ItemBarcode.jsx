/* eslint-disable react/prop-types */

import { useRef, useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

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

function buildBarcode(value) {
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

function BarcodeGraphic({ barcode }) {
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

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export default function ItemBarcode({ value, description = "Consignment item", priceLabel = "" }) {
  const barcodeRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState("idle");
  const [printStatus, setPrintStatus] = useState("idle");
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

  function openPrintLabel(svg) {
    const win = window.open("", "_blank");
    if (!win) return false;
    const svgMarkup = new XMLSerializer().serializeToString(svg);
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Barcode ${escapeHtml(barcode.readableValue)}</title><style>
*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}body{padding:16px}.label{width:2.25in;height:1.25in;padding:.08in;background:#fff;border:1px solid #ddd;overflow:hidden}.head{display:flex;justify-content:space-between;gap:6px;height:.22in;font-size:8pt;font-weight:700;line-height:1.1}.title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.price{white-space:nowrap}.label svg{display:block;width:2.09in;height:.86in}.print-button{display:block;width:2.25in;margin-top:12px;padding:10px;border:0;border-radius:4px;background:#1677d2;color:#fff;font-weight:700}.hint{width:2.25in;font-size:11px;color:#555;line-height:1.3}@media print{@page{margin:.25in}body{padding:0}.label{border:0}.print-button,.hint{display:none!important}}
</style></head><body><section class="label"><div class="head"><span class="title">${escapeHtml(description)}</span>${priceLabel ? `<span class="price">${escapeHtml(priceLabel)}</span>` : ""}</div>${svgMarkup}</section><button class="print-button" onclick="window.print()">Print label</button><p class="hint">Label prints at 2.25 × 1.25 inches at 100% scale.</p></body></html>`);
    win.document.close();
    return true;
  }

  async function printLabel() {
    const svg = getSvg();
    if (!svg) return;
    setPrintStatus("working");
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
    if (mobile && await shareBarcode(svg)) { setPrintStatus("idle"); return; }
    const opened = openPrintLabel(svg);
    setPrintStatus(opened ? "idle" : "error");
    if (!opened) window.setTimeout(() => setPrintStatus("idle"), 1800);
  }

  if (!barcode) return null;
  return <section className="consignment-item-barcode-card" ref={barcodeRef}>
    <BarcodeGraphic barcode={barcode} />
    <div className="consignment-item-barcode-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <button type="button" className="consignment-btn secondary consignment-item-barcode-button" onClick={copyBarcode}>{copyStatus === "copied" ? <Check size={17} /> : <Copy size={17} />}{copyStatus === "copied" ? "Copied" : copyStatus === "shared" ? "Share opened" : copyStatus === "error" ? "Copy unavailable" : "Copy barcode"}</button>
      <button type="button" className="consignment-btn consignment-item-barcode-button" onClick={printLabel} disabled={printStatus === "working"}><Printer size={17} />{printStatus === "working" ? "Opening…" : printStatus === "error" ? "Print unavailable" : "Print label"}</button>
    </div>
  </section>;
}
