/* eslint-disable react/prop-types */

import { useState } from "react";
import { saleSourceForItem, saleSourceLabel } from "../../lib/consignmentHelpers";
import "../../styles/consignment-global.css";

function formatStatusDate(value) {
  if (!value) return "—";
  const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function ManualSaleStatus({
  item,
  allowManualSale = true,
  onMarkSold,
  onStartPayout,
  onOpenPayoutReceipt,
  money,
}) {
  const [statusSaving, setStatusSaving] = useState(false);
  const [salePrice, setSalePrice] = useState(item.salePrice ?? item.price ?? "");
  const [dateSold] = useState(item.dateSold || new Date().toISOString().slice(0, 10));
  const [soldLocally, setSoldLocally] = useState(item.status === "Sold" || Boolean(item.dateSold));

  const isSold = soldLocally || item.status === "Sold" || Boolean(item.dateSold);
  const isPaid = item.paidOut === true;
  const recordedSalePrice = Number(item.salePrice ?? item.price ?? 0);
  const commissionRate = Number(item.commissionPct ?? 0);
  const consignorDue = Number(item.payoutAmount ?? (recordedSalePrice * commissionRate) / 100);
  const saleSource = saleSourceLabel(saleSourceForItem(item));
  const orderReference = item.orderName || item.orderId || "";

  async function handleSold() {
    if (statusSaving || !onMarkSold || salePrice === "") return;
    setStatusSaving(true);
    try {
      await onMarkSold(item.id, { salePrice, dateSold });
      setSoldLocally(true);
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <div className="consignment-status-card">
      {!isSold && allowManualSale && (
        <div className="consignment-manual-sale">
          <div className="consignment-manual-sale-copy"><strong>Manual sale</strong><span>Only use for a sale outside Shopify.</span></div>
          <div className="consignment-manual-sale-controls">
            <div className="consignment-field"><label className="consignment-label">Sale price</label><input className="consignment-input" type="number" inputMode="decimal" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} disabled={statusSaving} /></div>
            <button type="button" className="consignment-btn consignment-sold-btn" disabled={statusSaving || salePrice === ""} onClick={handleSold}>{statusSaving ? "Saving…" : "Sold"}</button>
          </div>
        </div>
      )}

      {isSold && (
        <div className="consignment-sold-status">
          <div className="consignment-sold-status-head">
            <div className="consignment-status-actions">
              <span className={`consignment-badge ${isPaid ? "paid" : "unpaid"}`}>{isPaid ? "Paid" : "Sold · unpaid"}</span>
              <span className={`consignment-product-badge ${saleSource.className}`}>{saleSource.text}</span>
            </div>
            {!isPaid && <button type="button" className="consignment-btn" onClick={() => onStartPayout?.(item.consignorId)}>Pay consignor</button>}
            {isPaid && item.payoutId && <button type="button" className="consignment-btn secondary" onClick={() => onOpenPayoutReceipt?.(item.payoutId)}>View payout receipt</button>}
            {isPaid && !item.payoutId && <p className="consignment-sold-status-message">Payout recorded.</p>}
          </div>
          <div className="consignment-sold-detail-grid">
            <div className="consignment-sold-detail"><span className="consignment-sold-detail-label">Sale price</span><strong className="consignment-sold-detail-value">{money?.(recordedSalePrice)}</strong></div>
            <div className="consignment-sold-detail"><span className="consignment-sold-detail-label">Sold date</span><strong className="consignment-sold-detail-value">{formatStatusDate(item.dateSold)}</strong></div>
            <div className="consignment-sold-detail"><span className="consignment-sold-detail-label">Sale source</span><strong className="consignment-sold-detail-value">{saleSource.text}</strong></div>
            <div className="consignment-sold-detail"><span className="consignment-sold-detail-label">Commission</span><strong className="consignment-sold-detail-value">{commissionRate}%</strong></div>
            <div className="consignment-sold-detail"><span className="consignment-sold-detail-label">{isPaid ? "Consignor earnings" : "Consignor due"}</span><strong className="consignment-sold-detail-value">{money?.(consignorDue)}</strong></div>
            {orderReference && <div className="consignment-sold-detail"><span className="consignment-sold-detail-label">Order</span><strong className="consignment-sold-detail-value">{orderReference}</strong></div>}
            {isPaid && <><div className="consignment-sold-detail"><span className="consignment-sold-detail-label">Payout date</span><strong className="consignment-sold-detail-value">{formatStatusDate(item.payoutDate)}</strong></div><div className="consignment-sold-detail"><span className="consignment-sold-detail-label">Payment method</span><strong className="consignment-sold-detail-value">{item.payoutMethod || "—"}</strong></div><div className="consignment-sold-detail"><span className="consignment-sold-detail-label">Reference</span><strong className="consignment-sold-detail-value">{item.payoutReference || "—"}</strong></div></>}
          </div>
        </div>
      )}
    </div>
  );
}
