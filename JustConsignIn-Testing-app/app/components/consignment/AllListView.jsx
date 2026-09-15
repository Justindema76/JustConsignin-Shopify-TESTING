/* eslint-disable react/prop-types */
import {
  money,
  itemBadge,
  productLabel,
  statusClass,
  statusLabel,
} from '../../lib/consignmentHelpers';
import { ItemRowAction } from './AllConsignorView';
import '../../styles/by-consignor-container.css';

function formatItemDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AllListView({
  items,
  consignors = [],
  onOpenItem,
  onOpenConsignor,
  onMarkSold,
  onStartPayout,
  saleSourceMode = false,
}) {
  const consignorById = Object.fromEntries(
    consignors.map((consignor) => [consignor.id, consignor]),
  );

  return (
    <>
      <div className="consignment-shared-scroll-hint" aria-hidden="true">
        Swipe to see more <span>→</span>
      </div>

      <section className="consignment-card consignment-all-items-card">
        <div className="consignment-list-row consignment-list-head">
          <span>Item</span>
          <span>SKU</span>
          <span>Consignor</span>
          <span>Price</span>
          <span>Commission</span>
          <span>Dates</span>
          <span>Product</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {items.map((item) => {
          const consignor = consignorById[item.consignorId];
          const product = saleSourceMode ? itemBadge(item) : productLabel(item);
          const photo = item.shopifyPhoto || item.photo;

          return (
            <div className="consignment-all-item-row" key={item.id}>
              <button
                type="button"
                className="consignment-grouped-item-open"
                onClick={() => onOpenItem?.(item.id)}
              >
                {item.shopifyProductId && (
                  <span
                    className={`consignment-batch-thumb ${
                      photo ? '' : 'consignment-image-placeholder'
                    }`}
                  >
                    {photo ? (
                      <img src={photo} alt="" />
                    ) : (
                      <span aria-hidden="true">No image</span>
                    )}
                  </span>
                )}

                <span>
                  <strong>
                    {item.description || item.type || 'Consignment item'}
                  </strong>

                  <span>
                    {item.itemNumber}
                    {item.size ? ` · ${item.size}` : ''}
                    {item.brand ? ` · ${item.brand}` : ''}
                  </span>

                  <span className="consignment-all-item-mobile-consignor">
                    {consignor
                      ? `${consignor.firstName} ${consignor.lastName}`
                      : 'Unassigned'}
                  </span>
                </span>
              </button>

              <strong>{item.itemNumber || '—'}</strong>

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

              <strong>{money(item.salePrice ?? item.price)}</strong>

              <span>
                {item.commissionPct ?? consignor?.commissionPct ?? 0}%
              </span>

              <span className="consignment-item-dates">
                <span className="consignment-item-date-line">
                  <span className="consignment-item-date-label">Received</span>
                  <span className="consignment-item-date-value">
                    {formatItemDate(item.dateReceived)}
                  </span>
                </span>

                    {item.dateSold && (
                <span className="consignment-item-date-line">
                  <span className="consignment-item-date-label">Sold</span>
                  <span className="consignment-item-date-value">
                    {formatItemDate(item.dateSold)}
                  </span>
                </span>
                )}

                {item.expiryDate && (
                  <span className="consignment-item-date-line">
                    <span className="consignment-item-date-label">Expires</span>
                    <span className="consignment-item-date-value">
                      {formatItemDate(item.expiryDate)}
                    </span>
                  </span>
                )}
              </span>

              <span
                className={`consignment-product-badge ${product.className}`}
              >
                {product.text}
              </span>

              <span
                className={`consignment-badge ${
                  item.paidOut ? 'paid' : statusClass(item.status)
                }`}
              >
                {item.paidOut ? 'Paid' : statusLabel(item.status)}
              </span>

              <span className="consignment-item-quick-action">
                <ItemRowAction
                  item={item}
                  product={product}
                  consignor={consignor}
                  onOpenItem={onOpenItem}
                  onMarkSold={onMarkSold}
                  onStartPayout={onStartPayout}
                />
              </span>
            </div>
          );
        })}
      </section>
    </>
  );
}
