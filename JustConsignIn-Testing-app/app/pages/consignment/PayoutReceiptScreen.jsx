/* eslint-disable react/prop-types */

import { Mail, Printer, UserRound } from "lucide-react";
import Header from "../../components/consignment/Header";
import { money } from "../../lib/consignmentHelpers";
import "../../styles/payout-receipt.css";

function formatReceiptDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function itemAmounts(item) {
  const salePrice = Number(item.salePrice ?? item.price ?? 0);
  const commissionRate = Number(item.commissionPct ?? 0);
  const earnings = Number(
    item.payoutAmount ?? (salePrice * commissionRate) / 100,
  );
  return { salePrice, commissionRate, earnings };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReceiptEmail(receipt) {
  const { consignor, payout, items } = receipt;
  const name = `${consignor.firstName} ${consignor.lastName}`.trim();
  const lines = items.flatMap((item) => {
    const { salePrice, commissionRate, earnings } = itemAmounts(item);
    return [
      `${item.itemNumber || "Item"} - ${item.description || item.type || "Consignment item"}`,
      `Sale price: ${money(salePrice)} | Commission: ${commissionRate}% | Earnings: ${money(earnings)}`,
      "",
    ];
  });

  return [
    `Payout receipt ${payout.id}`,
    `Consignor: ${name} (#${consignor.number})`,
    `Date: ${formatReceiptDate(payout.date)}`,
    `Payment: ${payout.method}${payout.reference ? ` | Reference: ${payout.reference}` : ""}`,
    "",
    ...lines,
    `Adjustment: ${money(payout.adjustment || 0)}`,
    `Total paid: ${money(payout.total)}`,
    payout.note ? `Note: ${payout.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrintableReceipt(receipt) {
  const { consignor, payout, items } = receipt;
  const name = `${consignor.firstName} ${consignor.lastName}`.trim();
  const itemRows = items
    .map((item) => {
      const { salePrice, commissionRate, earnings } = itemAmounts(item);
      const title = item.description || item.type || "Consignment item";
      return `
        <tr>
          <td>
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(item.itemNumber || "—")}</small>
          </td>
          <td>${escapeHtml(money(salePrice))}</td>
          <td>${escapeHtml(`${commissionRate}%`)}</td>
          <td><strong>${escapeHtml(money(earnings))}</strong></td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payout receipt ${escapeHtml(payout.id)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, sans-serif; }
      body { padding: 24px; }
      .receipt { width: 100%; max-width: 760px; margin: 0 auto; }
      .top { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #111; }
      .eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #555; }
      h1 { margin: 4px 0 2px; font-size: 24px; }
      .receipt-id { margin: 0; font-size: 12px; color: #555; }
      .total { font-size: 28px; font-weight: 700; white-space: nowrap; }
      .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; padding: 14px 0; border-bottom: 1px solid #bbb; }
      .meta span { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 4px; }
      .meta strong { font-size: 13px; }
      h2 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; color: #666; }
      th:not(:first-child), td:not(:first-child) { text-align: right; }
      th, td { padding: 8px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
      td:first-child { width: 52%; }
      td small { display: block; margin-top: 2px; color: #666; }
      .summary { width: min(100%, 320px); margin: 16px 0 0 auto; }
      .summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; }
      .summary-row.final { margin-top: 4px; padding-top: 9px; border-top: 2px solid #111; font-size: 17px; }
      .note { margin-top: 14px; font-size: 12px; line-height: 1.4; }
      .controls { max-width: 760px; margin: 18px auto 0; }
      .print-button { width: 100%; min-height: 48px; border: 0; border-radius: 5px; background: #1d5fa8; color: #fff; font-size: 16px; font-weight: 700; }
      .hint { margin: 10px 0 0; text-align: center; font-size: 12px; color: #666; }
      @media (max-width: 600px) {
        body { padding: 14px; }
        .top { gap: 12px; }
        h1 { font-size: 20px; }
        .total { font-size: 22px; }
        .meta { grid-template-columns: 1fr; gap: 8px; }
        td:first-child { width: auto; }
      }
      @media print {
        @page { size: auto; margin: 12mm; }
        body { padding: 0; }
        .receipt { max-width: none; }
        .controls { display: none !important; }
        tr { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <section class="top">
        <div>
          <div class="eyebrow">Payout receipt · Consignor #${escapeHtml(consignor.number)}</div>
          <h1>${escapeHtml(name)}</h1>
          <p class="receipt-id">Receipt ${escapeHtml(payout.id)}</p>
        </div>
        <div class="total">${escapeHtml(money(payout.total))}</div>
      </section>

      <section class="meta">
        <div><span>Payout date</span><strong>${escapeHtml(formatReceiptDate(payout.date))}</strong></div>
        <div><span>Payment method</span><strong>${escapeHtml(payout.method || "—")}</strong></div>
        <div><span>Reference</span><strong>${escapeHtml(payout.reference || "—")}</strong></div>
      </section>

      <h2>Items paid ${items.length}</h2>
      <table>
        <thead>
          <tr><th>Item</th><th>Sale</th><th>Rate</th><th>Earnings</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      ${payout.note ? `<p class="note"><strong>Note:</strong> ${escapeHtml(payout.note)}</p>` : ""}

      <section class="summary">
        <div class="summary-row"><span>Adjustment</span><strong>${escapeHtml(money(payout.adjustment || 0))}</strong></div>
        <div class="summary-row final"><span>Total paid</span><strong>${escapeHtml(money(payout.total))}</strong></div>
      </section>
    </main>

    <div class="controls">
      <button class="print-button" type="button" onclick="window.print()">Print receipt</button>
      <p class="hint">On a phone, tap Print receipt and choose your printer or AirPrint option.</p>
    </div>
  </body>
</html>`;
}

function printReceipt(receipt) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

  printWindow.document.open();
  printWindow.document.write(buildPrintableReceipt(receipt));
  printWindow.document.close();

  if (!isMobile) {
    printWindow.addEventListener("load", () => {
      window.setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          // The standalone receipt remains open with its own Print button.
        }
      }, 200);
    });
  }
}

export default function PayoutReceiptScreen({
  receipt,
  onBack,
  onOpenConsignor,
}) {
  const { consignor, payout, items } = receipt;
  const name = `${consignor.firstName} ${consignor.lastName}`.trim();
  const emailHref = consignor.email
    ? `mailto:${consignor.email}?subject=${encodeURIComponent(`Payout receipt ${payout.id}`)}&body=${encodeURIComponent(buildReceiptEmail(receipt))}`
    : "";

  return (
    <>
      <div className="consignment-receipt-screen-header">
        <Header
          eyebrow={`Consignor #${consignor.number}`}
          title="Payout receipt"
          onBack={onBack}
        />
      </div>

      <div className="consignment-body">
        <main className="consignment-payout-receipt">
          <header className="consignment-receipt-heading">
            <div>
              <span className="consignment-label">Payout receipt</span>
              <h1>{name}</h1>
              <p>Receipt {payout.id}</p>
            </div>
            <strong className="consignment-receipt-total">
              {money(payout.total)}
            </strong>
          </header>

          <dl className="consignment-receipt-meta">
            <div>
              <dt>Payout date</dt>
              <dd>{formatReceiptDate(payout.date)}</dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>{payout.method || "—"}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{payout.reference || "—"}</dd>
            </div>
          </dl>

          <section className="consignment-receipt-items">
            <h2>
              Items paid <span>{items.length}</span>
            </h2>
            <div className="consignment-receipt-table-wrap">
              <table className="consignment-receipt-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Sale</th>
                    <th>Rate</th>
                    <th>Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const { salePrice, commissionRate, earnings } =
                      itemAmounts(item);
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.description ||
                              item.type ||
                              "Consignment item"}
                          </strong>
                          <small>{item.itemNumber || "—"}</small>
                        </td>
                        <td>{money(salePrice)}</td>
                        <td>{commissionRate}%</td>
                        <td>
                          <strong>{money(earnings)}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="consignment-receipt-summary">
            {payout.note && (
              <p>
                <strong>Note:</strong> {payout.note}
              </p>
            )}
            <div>
              <span>Adjustment</span>
              <strong>{money(payout.adjustment || 0)}</strong>
            </div>
            <div className="total">
              <span>Total paid</span>
              <strong>{money(payout.total)}</strong>
            </div>
          </section>

          <div className="consignment-receipt-actions">
            <button
              type="button"
              className="consignment-btn secondary"
              onClick={onOpenConsignor}
            >
              <UserRound size={17} />
              Consignor dashboard
            </button>
            <button
              type="button"
              className="consignment-btn secondary"
              onClick={() => printReceipt(receipt)}
            >
              <Printer size={17} />
              Print receipt
            </button>
            {emailHref ? (
              <a className="consignment-btn" href={emailHref}>
                <Mail size={17} />
                Email receipt
              </a>
            ) : (
              <button type="button" className="consignment-btn" disabled>
                <Mail size={17} />
                No email on file
              </button>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
