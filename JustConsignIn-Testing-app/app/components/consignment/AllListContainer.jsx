import { useState } from 'react';
import { money, productLabel, statusClass, statusLabel, productAdminUrl } from '../../lib/consignmentHelpers';

/**
 * Single shared "flat list" table used by the All items / All sales views.
 * Same action logic (Review & pay / Mark sold / View Shopify Product /
 * Archived) as ByConsignorContainer and ItemGridCardContainer, so all
 * three "shapes" of the app (by-consignor, grid, all-list) stay in sync.
 *
 * mode: 'items' | 'sales' — controls the column set and which money field
 * (price vs sale price) is shown; the underlying items array and action
 * logic are identical either way.
 */
export default function AllListContainer({
  items = [],
  consignorById = {},
  mode = 'items',
  onOpenItem,
  onOpenConsignor,
  onMarkSold,
  onStartPayout,
}) {
  const [sellingItemId, setSellingItemId] = useState(null);

  async function quickMarkSold(item) {
    if (sellingItemId || !onMarkSold) return;
    const amount = window.prompt(`Sale price for ${item.description || item.itemNumber}`, String(item.price ?? ''));
    if (amount === null) return;
    const price = Number(amount);
    if (!Number.isFinite(price) || price < 0) {
      window.alert('Enter a valid sale price.');
      return;
    }
    setSellingItemId(item.id);
    try {
      await onMarkSold(item.id, { salePrice: price, dateSold: new Date().toISOString().slice(0, 10) });
    } finally {
      setSellingItemId(null);
    }
  }

  function renderAction(item, consignor) {
    const product = productLabel(item);
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

  function cell(item) {
    const photo = item.shopifyPhoto || item.photo;
    return (
      <div className="consignment-live-item-cell">
        {photo && <div className="consignment-grid-thumb"><img src={photo} alt="" /></div>}
        <div className="consignment-live-item-copy">
          <button className="consignment-title-link" type="button" onClick={() => onOpenItem?.(item.id)}>{item.description || item.type || item.itemNumber}</button>
          <small>#{item.itemNumber || '—'}{item.size ? ` · ${item.size}` : ''}{item.brand ? ` · ${item.brand}` : ''}</small>
          {item.orderName && <small>{item.orderName}</small>}
          {item.expiryDate && <small>Expiry {item.expiryDate}</small>}
        </div>
      </div>
    );
  }

  const columnsClass = mode === 'sales' ? 'consignment-sales-live-columns' : 'consignment-items-live-columns';

  return (
    <div className={`consignment-live-list ${mode === 'sales' ? 'consignment-sales-all-view' : 'consignment-items-all-view'}`}>
      <div className={`consignment-live-list-head ${columnsClass}`}>
        <span>Item</span>
        <span>Consignor</span>
        {mode === 'sales' ? <><span>Sale price</span><span>Consignor due</span></> : <><span>Price</span><span>Commission</span></>}
        <span>{mode === 'sales' ? 'Source' : 'Product'}</span>
        <span>Status</span>
        {mode === 'sales' && <span>Sold</span>}
        <span>Action</span>
      </div>
      {items.map((item) => {
        const consignor = consignorById[item.consignorId];
        const product = productLabel(item);
        const isPaid = item.paidOut === true;
        const salePrice = Number(item.salePrice ?? item.price ?? 0);
        const commissionPct = Number(item.commissionPct ?? consignor?.commissionPct ?? 0);
        const consignorDue = (salePrice * commissionPct) / 100;
        return (
          <div className={`consignment-live-list-row ${columnsClass}`} key={item.id}>
            {cell(item)}
            <div>{consignor ? <button className="consignment-consignor-link" type="button" onClick={() => onOpenConsignor?.(consignor.id)}>{consignor.firstName} {consignor.lastName}</button> : 'Unassigned'}</div>
            {mode === 'sales' ? (
              <>
                <strong className="consignment-money">{money(salePrice)}</strong>
                <strong className="consignment-money">{money(consignorDue)}</strong>
              </>
            ) : (
              <>
                <strong className="consignment-money">{money(item.price)}</strong>
                <span>{commissionPct}%</span>
              </>
            )}
            <span><span className={`consignment-product-badge ${product.className}`}>{product.text}</span></span>
            <span><span className={`consignment-badge ${isPaid ? 'sold' : statusClass(item.status)}`}>{isPaid ? 'Archived' : statusLabel(item.status)}</span></span>
            {mode === 'sales' && <span>{item.dateSold || 'Date unavailable'}</span>}
            <span>{renderAction(item, consignor)}</span>
          </div>
        );
      })}
      {items.length === 0 && <div className="consignment-empty-small">Nothing to show here.</div>}
    </div>
  );
}
