import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { money, productLabel, statusClass, statusLabel } from '../../lib/consignmentHelpers';
import '../../styles/by-consignor-container.css';

function formatSaleDate(value) {
  if (!value) return 'Sold';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ByConsignorContainer({
  consignor,
  items = [],
  variant = 'inventory',
  onOpenConsignor,
  onOpenItem,
  onMarkSold,
  onStartPayout,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [sellingItemId, setSellingItemId] = useState(null);
  const initials = consignor
    ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` || '—'
    : '—';

  const availableCount = items.filter(
    (item) => (item.status === 'Available' || item.status === 'Active') && !item.paidOut,
  ).length;
  const soldItems = items.filter((item) => item.status === 'Sold' || item.dateSold);
  const soldCount = soldItems.length;
  const archivedCount = soldItems.filter((item) => item.paidOut).length;
  const total = items.reduce(
    (sum, item) => sum + Number(item.salePrice ?? item.price ?? 0),
    0,
  );
  const due = soldItems
    .filter((item) => !item.paidOut)
    .reduce(
      (sum, item) => sum + (
        Number(item.salePrice ?? item.price ?? 0)
        * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)
      ) / 100,
      0,
    );

  const isSalesView = variant === 'sales' || variant === 'payouts';
  const stats = isSalesView
    ? [
        { label: 'Sales', value: soldCount },
        { label: 'Archived', value: archivedCount },
        { label: 'Total sales', value: money(total) },
        { label: 'Due', value: money(due) },
      ]
    : [
        { label: 'Available', value: availableCount },
        { label: 'Sold', value: soldCount },
        { label: 'Total', value: money(total) },
        { label: 'Due', value: money(due) },
      ];

  async function quickMarkSold(item) {
    if (!onMarkSold || sellingItemId) return;
    const amount = window.prompt(
      `Sale price for ${item.description || item.itemNumber}`,
      String(item.price ?? ''),
    );
    if (amount === null) return;
    const salePrice = Number(amount);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      window.alert('Enter a valid sale price.');
      return;
    }
    setSellingItemId(item.id);
    try {
      await onMarkSold(item.id, {
        salePrice,
        dateSold: new Date().toISOString().slice(0, 10),
      });
    } finally {
      setSellingItemId(null);
    }
  }

  function handleReviewPay() {
    if (!consignor) return;
    if (onStartPayout) {
      onStartPayout(consignor.id);
      return;
    }
    onOpenConsignor?.(consignor.id);
  }

  function renderAction(item) {
    const sold = item.status === 'Sold' || Boolean(item.dateSold);
    const paid = item.paidOut === true;
    const product = productLabel(item);
    const manualAvailable = product.className === 'manual'
      && !sold
      && !paid
      && (item.status === 'Available' || item.status === 'Active');

    if (paid) return <span className="consignment-archive-note">Archived</span>;

    if (sold && consignor) {
      return (
        <button
          type="button"
          className="consignment-sales-pay-btn"
          onClick={handleReviewPay}
        >
          Review &amp; pay
        </button>
      );
    }

    if (manualAvailable && onMarkSold) {
      return (
        <button
          type="button"
          className="consignment-list-action"
          disabled={sellingItemId === item.id}
          onClick={() => quickMarkSold(item)}
        >
          {sellingItemId === item.id ? 'Saving…' : 'Mark sold'}
        </button>
      );
    }

    return null;
  }

  function itemIdentity(item) {
    const photo = item.shopifyPhoto || item.photo;
    return (
      <div className="consignment-live-item-cell">
        {photo ? <div className="consignment-grid-thumb"><img src={photo} alt="" /></div> : null}
        <div className="consignment-live-item-copy">
          <button
            className="consignment-title-link"
            type="button"
            onClick={() => onOpenItem?.(item.id)}
          >
            {item.description || item.type || item.itemNumber || 'Consignment item'}
          </button>
          <small>
            #{item.itemNumber || '—'}
            {item.size ? ` · ${item.size}` : ''}
            {item.brand ? ` · ${item.brand}` : ''}
          </small>
        </div>
      </div>
    );
  }

  function inventoryRows() {
    return (
      <>
        <div className="consignment-live-list-head consignment-grouped-live-columns">
          <span>Item</span><span>Price</span><span>Commission</span><span>Product</span><span>Status</span><span>Action</span>
        </div>
        {items.map((item) => {
          const product = productLabel(item);
          return (
            <div className="consignment-live-list-row consignment-grouped-live-columns" key={item.id}>
              {itemIdentity(item)}
              <strong className="consignment-money">{money(item.price)}</strong>
              <span>{item.commissionPct ?? consignor?.commissionPct ?? 0}%</span>
              <span><span className={`consignment-product-badge ${product.className}`}>{product.text}</span></span>
              <span><span className={`consignment-badge ${item.paidOut ? 'sold' : statusClass(item.status)}`}>{item.paidOut ? 'Paid · archived' : statusLabel(item.status)}</span></span>
              <span>{renderAction(item)}</span>
            </div>
          );
        })}
      </>
    );
  }

  function salesRows() {
    const sales = items.filter((item) => item.status === 'Sold' || item.dateSold || item.orderId);
    return (
      <>
        <div className="consignment-live-list-head consignment-sales-grouped-live-columns">
          <span>Item</span><span>Sale price</span><span>Due</span><span>Source</span><span>Payout</span><span>Sold</span><span>Action</span>
        </div>
        {sales.map((item) => {
          const salePrice = Number(item.salePrice ?? item.price ?? 0);
          const itemDue = (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
          const source = productLabel(item);
          return (
            <div className="consignment-live-list-row consignment-sales-grouped-live-columns" key={item.id}>
              {itemIdentity(item)}
              <strong className="consignment-money">{money(salePrice)}</strong>
              <strong className="consignment-money">{money(itemDue)}</strong>
              <span><span className={`consignment-product-badge ${source.className}`}>{source.text}</span></span>
              <span><span className={`consignment-badge ${item.paidOut ? 'paid' : 'unpaid'}`}>{item.paidOut ? 'Archived' : 'Unpaid'}</span></span>
              <span>{formatSaleDate(item.dateSold)}</span>
              <span>{renderAction(item)}</span>
            </div>
          );
        })}
      </>
    );
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
            <span className="consignment-item-group-count">
              {' '}· {items.length} {isSalesView ? `sale${items.length === 1 ? '' : 's'}` : `item${items.length === 1 ? '' : 's'}`}
            </span>
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
          {isSalesView ? salesRows() : inventoryRows()}
        </div>
      )}
    </section>
  );
}
