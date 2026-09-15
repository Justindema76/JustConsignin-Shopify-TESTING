import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import {
  money,
  itemBadge,
  productLabel,
  statusClass,
  statusLabel,
} from '../../lib/consignmentHelpers';

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


/* =========================================================
   SHARED MANUAL ITEM BUTTON
   ========================================================= */

function ManualMarkSoldButton({
  item,
  onOpenItem,
}) {
  return (
    <button
      type="button"
      className="consignment-quick-sold-btn"
      onClick={() =>
        onOpenItem?.(item.id)
      }
    >
      Mark sold
    </button>
  );
}


/* =========================================================
   GRID CARD ACTION
   ========================================================= */

export function ItemAction({
  item,
  product,
  consignor,
  onOpenItem,
  onStartPayout,
}) {
  const isSold =
    item.status === 'Sold' ||
    Boolean(item.dateSold);

  const isPaid =
    item.paidOut === true;

  const isManualAvailable =
    product.className === 'manual' &&
    !isSold &&
    !isPaid &&
    (
      item.status === 'Available' ||
      item.status === 'Active' ||
      item.status === 'Draft'
    );

  if (isPaid) {
    return null;
  }

  if (isSold && consignor) {
    return (
      <button
        type="button"
        className="consignment-sales-pay-btn"
        onClick={() =>
          onStartPayout?.(consignor.id)
        }
      >
        Pay consignor
      </button>
    );
  }

  if (isManualAvailable) {
    return (
      <ManualMarkSoldButton
        item={item}
        onOpenItem={onOpenItem}
      />
    );
  }

  return null;
}


/* =========================================================
   LIST / TABLE ACTION
   ========================================================= */

export function ItemRowAction({
  item,
  product,
  consignor,
  onOpenItem,
  onStartPayout,
}) {
  const isSold =
    item.status === 'Sold' ||
    Boolean(item.dateSold);

  const isPaid =
    item.paidOut === true;

  const isManual =
    product.className === 'manual';

  if (isPaid) {
    return (
      <span className="consignment-action-static">
        {isManual
          ? 'Sold'
          : 'Archived'}
      </span>
    );
  }

  if (isSold) {
    if (consignor) {
      return (
        <button
          type="button"
          className="consignment-sales-pay-btn"
          onClick={() =>
            onStartPayout?.(
              consignor.id
            )
          }
        >
          Pay consignor
        </button>
      );
    }

    return (
      <span className="consignment-action-static">
        Sold
      </span>
    );
  }

  if (isManual) {
    return (
      <ManualMarkSoldButton
        item={item}
        onOpenItem={onOpenItem}
      />
    );
  }

  return (
    <button
      type="button"
      className="consignment-item-open-btn"
      onClick={() =>
        onOpenItem?.(item.id)
      }
    >
      Edit
    </button>
  );
}


/* =========================================================
   ALL CONSIGNOR VIEW
   ========================================================= */

export default function AllConsignorView({
  consignor,
  items = [],
  itemLabel,
  onOpenConsignor,
  onOpenItem,
  onStartPayout,
  defaultOpen = false,
  saleSourceMode = false,
}) {
  const [open, setOpen] =
    useState(defaultOpen);

  const initials = consignor
    ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` || '—'
    : '—';

  const availableCount =
    items.filter(
      (item) =>
        item.status === 'Available' ||
        item.status === 'Active' ||
        item.status === 'Draft',
    ).length;

const unpaidCount =
  items.filter(
    (item) =>
      (
        item.status === 'Sold' ||
        item.dateSold
      ) &&
      !item.paidOut,
  ).length;

  const total =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.salePrice ??
            item.price ??
            0,
        ),
      0,
    );

  const due =
    items
      .filter(
        (item) =>
          (
            item.status === 'Sold' ||
            item.dateSold
          ) &&
          !item.paidOut,
      )
      .reduce(
        (sum, item) =>
          sum +
          (
            Number(
              item.salePrice ??
                item.price ??
                0,
            ) *
            Number(
              item.commissionPct ??
                consignor?.commissionPct ??
                0,
            )
          ) /
            100,
        0,
      );

  const stats = [
    {
      label: 'Available',
      value: availableCount,
    },
    {
      label: 'Unpaid',
      value: unpaidCount,
    },    {
      label: 'Total',
      value: money(total),
    },
    {
      label: 'Due',
      value: money(due),
    },
  ];

  const label =
    itemLabel ||
    `item${items.length === 1 ? '' : 's'}`;

  return (
    <section className="consignment-item-group consignment-by-consignor-container">

      <div className="consignment-item-group-summary">

        <button
          type="button"
          className={`consignment-item-group-chevron ${
            open
              ? 'open'
              : ''
          }`}
          onClick={() =>
            setOpen(
              (current) =>
                !current,
            )
          }
          aria-expanded={open}
          aria-label={
            open
              ? 'Collapse consignor'
              : 'Expand consignor'
          }
        >
          <ChevronRight size={16} />
        </button>

        <span className="consignment-avatar consignment-item-group-avatar">
          {initials}
        </span>

        <span className="consignment-item-group-person">

          {consignor ? (
            <button
              type="button"
              className="consignment-consignor-profile-link"
              onClick={() =>
                onOpenConsignor?.(
                  consignor.id,
                )
              }
            >
              {consignor.firstName}{' '}
              {consignor.lastName}
            </button>
          ) : (
            <span>
              Unassigned
            </span>
          )}

          <span className="consignment-item-group-meta">

            <strong className="consignment-item-group-number">
              #{consignor?.number || '—'}
            </strong>

          <span className="consignment-item-group-count">
            {' \u00B7 '}
            {items.length} {label}
          </span>

          </span>

        </span>

        {stats.map(
          (stat) => (
            <span
              className="consignment-item-group-stat"
              key={stat.label}
            >
              <strong>
                {stat.value}
              </strong>

              <span>
                {stat.label}
              </span>
            </span>
          ),
        )}

      </div>


      {open && (
        <>

          <div
            className="consignment-shared-scroll-hint"
            aria-hidden="true"
          >
            Swipe to see more{' '}
            <span>→</span>
          </div>

          <div className="consignment-item-group-items consignment-shared-item-table">

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
              const product =
                saleSourceMode ? itemBadge(item) : productLabel(item);

              const photo =
                item.shopifyPhoto ||
                item.photo;

              return (
                <div
                  className="consignment-all-item-row"
                  key={item.id}
                >

                  <button
                    type="button"
                    className="consignment-grouped-item-open"
                    onClick={() =>
                      onOpenItem?.(
                        item.id,
                      )
                    }
                  >

                    {item.shopifyProductId && (
                      <span
                        className={`consignment-batch-thumb ${
                          photo
                            ? ''
                            : 'consignment-image-placeholder'
                        }`}
                      >
                        {photo ? (
                          <img
                            src={photo}
                            alt=""
                          />
                        ) : (
                          <span aria-hidden="true">
                            No image
                          </span>
                        )}
                      </span>
                    )}

                    <span>

                      <strong>
                        {item.description ||
                          item.type ||
                          'Consignment item'}
                      </strong>

                      <span>
                        {item.itemNumber}

                        {item.size
                          ? ` · ${item.size}`
                          : ''}

                        {item.brand
                          ? ` · ${item.brand}`
                          : ''}
                      </span>

                    </span>

                  </button>


                  <strong>
                    {item.itemNumber || '—'}
                  </strong>


                  {consignor ? (
                    <button
                      type="button"
                      className="consignment-consignor-profile-link"
                      onClick={() =>
                        onOpenConsignor?.(
                          consignor.id,
                        )
                      }
                    >
                      {consignor.firstName}{' '}
                      {consignor.lastName}
                    </button>
                  ) : (
                    <span>
                      Unassigned
                    </span>
                  )}


                  <strong>
                    {money(item.price)}
                  </strong>


                  <span>
                    {item.commissionPct ??
                      consignor?.commissionPct ??
                      0}
                    %
                  </span>


                  <span
                    className="consignment-expiry-date"
                    style={{ display: 'grid', gap: 3 }}
                  >
                    <span>
                      <strong>Entered:</strong>{' '}
                      {formatItemDate(
                        item.dateReceived ||
                          item.createdAt ||
                          item.created_at,
                      )}
                    </span>

                    <span>
                      <strong>Sold:</strong>{' '}
                      {formatItemDate(
                        item.dateSold || item.soldAt,
                      )}
                    </span>

                    {item.expiryDate && (
                      <span>
                        <strong>Expires:</strong>{' '}
                        {formatItemDate(item.expiryDate)}
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
                      item.paidOut
                        ? 'paid'
                        : statusClass(
                            item.status,
                          )
                    }`}
                  >
                    {item.paidOut
                      ? 'Paid'
                      : statusLabel(
                          item.status,
                        )}
                  </span>


                  <span className="consignment-item-quick-action">

                    <ItemRowAction
                      item={item}
                      product={product}
                      consignor={consignor}
                      onOpenItem={onOpenItem}
                      onStartPayout={onStartPayout}
                    />

                  </span>

                </div>
              );
            })}


            {items.length === 0 && (
              <div className="consignment-empty-small">
                No items yet.
              </div>
            )}

          </div>

        </>
      )}

    </section>
  );
}