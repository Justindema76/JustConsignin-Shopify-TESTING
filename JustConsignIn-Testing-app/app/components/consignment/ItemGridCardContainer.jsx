import { useState } from 'react';
import { EntityCard } from './PageBuildingBlocks';
import { money, productLabel, statusClass, statusLabel, productAdminUrl } from '../../lib/consignmentHelpers';

/**
 * Single shared "item card" used by every grid view in the app:
 * Items grid, Sales grid, Payouts grid, and the Consignor dashboard grid.
 * Mirrors the same 4-branch action logic as ByConsignorContainer so the
 * buttons (Review & pay / Mark sold / View Shopify Product / Archived)
 * behave identically everywhere.
 */
export default function ItemGridCardContainer({
  item,
  consignor,
  showConsignor = true,
  onOpenItem,
  onOpenConsignor,
  onMarkSold,
  onStartPayout,
}) {
  const [saving, setSaving] = useState(false);

  const product = productLabel(item);
  const isSold = item.status === 'Sold' || Boolean(item.dateSold);
  const isPaid = item.paidOut === true;
  const isManualAvailable = product.className === 'manual' && !isSold && !isPaid && (item.status === 'Available' || item.status === 'Active');
  const hasShopifyProduct = Boolean(item.shopifyProductId);

  const salePrice = Number(item.salePrice ?? item.price ?? 0);
  const commissionPct = Number(item.commissionPct ?? consignor?.commissionPct ?? 0);
  const consignorDue = (salePrice * commissionPct) / 100;

  async function quickMarkSold() {
    if (saving || !onMarkSold) return;
    const amount = window.prompt(`Sale price for ${item.description || item.itemNumber}`, String(item.price ?? ''));
    if (amount === null) return;
    const price = Number(amount);
    if (!Number.isFinite(price) || price < 0) {
      window.alert('Enter a valid sale price.');
      return;
    }
    setSaving(true);
    try {
      await onMarkSold(item.id, { salePrice: price, dateSold: new Date().toISOString().slice(0, 10) });
    } finally {
      setSaving(false);
    }
  }

  function renderAction() {
    if (isPaid) return <span className="consignment-archive-note">Archived</span>;
    if (isSold && consignor && onStartPayout) {
      return <button type="button" className="consignment-sales-pay-btn" onClick={() => onStartPayout(consignor.id)}>Review &amp; pay</button>;
    }
    if (isManualAvailable && onMarkSold) {
      return <button type="button" className="consignment-quick-sold-btn" disabled={saving} onClick={quickMarkSold}>{saving ? 'Saving…' : 'Mark sold'}</button>;
    }
    if (!isSold && hasShopifyProduct) {
      return <a className="consignment-sales-pay-btn" href={productAdminUrl(item.shopifyProductId)} target="_top" rel="noreferrer">View Shopify Product</a>;
    }
    return null;
  }

  return (
    <EntityCard
      photo={item.shopifyPhoto || item.photo || null}
      title={item.description || item.type || 'Consignment item'}
      subtitle={`#${item.itemNumber || '—'}${item.size ? ` · ${item.size}` : ''}${item.brand ? ` · ${item.brand}` : ''}`}
      onOpen={() => onOpenItem?.(item.id)}
      topBadge={product}
      consignor={showConsignor ? (consignor || null) : undefined}
      onOpenConsignor={onOpenConsignor}
      metrics={isSold
        ? [{ label: 'Sale price', value: money(salePrice) }, { label: 'Consignor due', value: money(consignorDue) }]
        : [{ label: 'Price', value: money(item.price) }, { label: 'Commission', value: `${commissionPct}%` }]}
      detailLabel={isSold ? 'Sale date' : 'Status'}
      detailValue={isSold ? (item.dateSold || 'Sold') : undefined}
      detailBadge={{
        text: isPaid ? 'Archived' : isSold ? 'Unpaid' : statusLabel(item.status),
        className: isPaid ? 'paid' : isSold ? 'unpaid' : statusClass(item.status),
      }}
      footNote={item.expiryDate ? `Expiry ${item.expiryDate}` : (item.orderName || null)}
      action={renderAction()}
    />
  );
}
