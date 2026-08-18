import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { money, productLabel, statusClass, statusLabel, productAdminUrl } from '../../lib/consignmentHelpers';
import '../../styles/by-consignor-container.css';

export default function ByConsignorContainer({
  consignor,
  items = [],
  itemLabel,
  onOpenConsignor,
  onOpenItem,
  onMarkSold,
  onStartPayout,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [sellingItemId, setSellingItemId] = useState(null);

  const initials = consignor
    ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` || '—'
    : '—';

  const availableCount = items.filter((item) => item.status === 'Available' || item.status === 'Active').length;
  const soldCount = items.filter((item) => item.status === 'Sold' || item.dateSold).length;
  const total = items.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
  const due = items
    .filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut)
    .reduce((sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100, 0);

  const stats = [
    { label: 'Available', value: availableCount },
    { label: 'Sold', value: soldCount },
    { label: 'Total', value: money(total) },
    { label: 'Due', value: money(due) },
  ];

  const label = itemLabel || `item${items.length === 1 ? '' : 's'}`;

  async function quickMarkSold(item) {
    if (sellingItemId || !onMarkSold) return;
    const amount = window.prompt(`Sale price for ${item.description || item.itemNumber}`, String(item.price ?? ''));
    if (amount === null) return;
    const salePrice = Number(amount);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      window.alert('Enter a valid sale price.');
      return;
    }
    setSellingItemId(item.id);
    try {
      await onMarkSold(item.id, { salePrice, dateSold: new Date().toISOString().slice(0, 10) });
    } finally {
      setSellingItemId(null);
    }
  }

  function ItemAction({ item, product }) {
    const isSold = item.status === 'Sold' || Boolean(item.dateSold);
    const isPaid = item.paidOut === true;
    const isManualAvailable = product.className === 'manual' && !isSold && !isPaid && (item.status === 'Available' || item.status === 'Active');
    const hasShopifyProduct = Boolean(item.shopifyProductId);

    if (isPaid) return <span className="consignment-archive-note">Archived</span>;
    if (isSold && consignor && onStartPayout) {
      return <button type="button" className="consignment-sales-pay-btn" onClick={() => onStartPayout(consignor.id)}>Review &amp; pay</button>;
    }
    if (isManualAvailable && onMarkSold) {
      return <button type="button" className="consignment-quick-sold-btn" disabled={sellingItemId === item.id} onClick={() => quickMarkSold(item)}>{sellingItemId === item.id ? 'Saving…' : 'Mark sold'}</button>;
    }
    if (!isSold && hasShopifyProduct) {
      return <a className="consignment-sales-pay-btn" href={productAdminUrl(item.shopifyProductId)} target="_top" rel="noreferrer">View Shopify Product</a>;
    }
    return null;
  }

  return (
    <section className="consignment-item-group consignment-by-consignor-container">
      <div className="consignment-item-group-summary">
        <button
          type="button"
          className={`consignment-item-group-chevron ${open ? 'open' : ''}`}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={open ? 'Collapse consignor' : 'Expand consignor'}
        >
          <ChevronRight size={16} />
        </button>

        <span className="consignment-avatar consignment-item-group-avatar">{initials}</span>

        <span className="consignment-item-group-person">
          {consignor ? (
            <button
              type="button"
              className="consignment-consignor-profile-link"
              onClick={() => onOpenConsignor?.(consignor.id)}
            >
              {consignor.firstName} {consignor.lastName}
            </button>
          ) : (
            <span>Unassigned</span>
          )}
          <span className="consignment-item-group-meta">
            <strong className="consignment-item-group-number">#{consignor?.number || '—'}</strong>
            <span className="consignment-item-group-count"> · {items.length} {label}</span>
          </span>
        </span>

        {stats.map((stat) => (
          <span className="consignment-item-group-stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </span>
        ))}
      </div>

      {open && (
        <div className="consignment-item-group-items">
          <div className="consignment-grouped-item-row consignment-list-head">
            <span>Item</span><span>Price</span><span>Commission</span><span>Product</span><span>Status</span><span>Action</span>
          </div>
          {items.map((item) => {
            const product = productLabel(item);
            const photo = item.shopifyPhoto || item.photo;
            return (
              <div className="consignment-grouped-item-row" key={item.id}>
                <button type="button" className="consignment-grouped-item-open" onClick={() => onOpenItem?.(item.id)}>
                  {photo && <span className="consignment-batch-thumb"><img src={photo} alt="" /></span>}
                  <span>
                    <strong>{item.description || item.type || 'Consignment item'}</strong>
                    <span>{item.itemNumber}{item.size ? ` · ${item.size}` : ''}{item.brand ? ` · ${item.brand}` : ''}</span>
                  </span>
                </button>
                <strong>{money(item.price)}</strong>
                <span>{item.commissionPct ?? consignor?.commissionPct ?? 0}%</span>
                <span className={`consignment-product-badge ${product.className}`}>{product.text}</span>
                <span className={`consignment-badge ${item.paidOut ? 'sold' : statusClass(item.status)}`}>{item.paidOut ? 'Paid · archived' : statusLabel(item.status)}</span>
                <span className="consignment-item-quick-action"><ItemAction item={item} product={product} /></span>
              </div>
            );
          })}
          {items.length === 0 && <div className="consignment-empty-small">No items yet.</div>}
        </div>
      )}
    </section>
  );
}
