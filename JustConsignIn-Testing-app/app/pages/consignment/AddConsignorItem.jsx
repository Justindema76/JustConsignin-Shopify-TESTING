import { useState } from 'react';
import {
  Grid3X3,
  List,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';

import { Header } from '../../components/consignment/SharedPieces';
import { EntityCard } from '../../components/consignment/PageBuildingBlocks';
import {
  money,
  productLabel,
  statusClass,
  statusLabel,
} from '../../lib/consignmentHelpers';

export default function ConsignorsDashboard({
  consignor,
  items,
  onBack,
  onStartIntake,
  onOpenItem,
  onDeleteConsignor,
  onEditConsignor,
  onStartPayout,
}) {
  const [viewMode, setViewMode] = useState('grid');
  const [confirmingDeleteConsignor, setConfirmingDeleteConsignor] =
    useState(false);

  const consignorItems = items.filter(
    (item) => item.consignorId === consignor.id,
  );

  const draftCount = consignorItems.filter(
    (item) => item.status === 'Draft',
  ).length;

  const soldItems = consignorItems.filter(
    (item) => item.status === 'Sold' || item.dateSold,
  );

  const unpaidItems = soldItems.filter((item) => !item.paidOut);

  const totalSales = soldItems.reduce(
    (sum, item) =>
      sum + Number(item.salePrice ?? item.price ?? 0),
    0,
  );

  const activeCount = consignorItems.filter((item) =>
    ['Available', 'Active'].includes(item.status),
  ).length;

  const amountDue = unpaidItems.reduce(
    (sum, item) =>
      sum +
      (Number(item.salePrice ?? item.price ?? 0) *
        Number(
          item.commissionPct ??
            consignor.commissionPct ??
            0,
        )) /
        100,
    0,
  );

  const fullAddress = [
    consignor.address,
    consignor.city,
    consignor.province,
    consignor.postalCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Header
        eyebrow={`Consignor #${consignor.number}`}
        title={`${consignor.firstName} ${consignor.lastName}`}
        onBack={onBack}
        action={
          <div className="consignment-header-actions">
            <button
              type="button"
              className="consignment-btn"
              onClick={onStartIntake}
            >
              <Plus size={17} />
              Add items
            </button>

            <button
              type="button"
              className="consignment-btn secondary"
              onClick={onEditConsignor}
            >
              <Pencil size={17} />
              Edit
            </button>

            <button
              type="button"
              className="consignment-btn secondary"
              style={{
                color: 'var(--danger)',
                borderColor: 'var(--danger-soft)',
              }}
              onClick={() =>
                setConfirmingDeleteConsignor(true)
              }
            >
              <Trash2 size={17} />
              Delete
            </button>
          </div>
        }
      />

      <div className="consignment-body">
        {/* CONSIGNOR PROFILE */}

        <section
          className="consignment-card consignment-consignor-profile"
          aria-label="Consignor profile information"
        >
          <div className="consignment-profile-column">
            <div className="consignment-profile-title">
              Contact
            </div>

            <div className="consignment-profile-row">
              <span className="consignment-profile-icon">
                <Phone size={17} />
              </span>

              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">
                  Phone
                </span>

                {consignor.phone ? (
                  <a
                    className="consignment-profile-value consignment-profile-link"
                    href={`tel:${String(
                      consignor.phone,
                    ).replace(/[^\d+]/g, '')}`}
                  >
                    {consignor.phone}
                  </a>
                ) : (
                  <span className="consignment-profile-value">
                    —
                  </span>
                )}
              </span>
            </div>

            <div className="consignment-profile-row">
              <span className="consignment-profile-icon">
                <Mail size={17} />
              </span>

              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">
                  Email
                </span>

                {consignor.email ? (
                  <a
                    className="consignment-profile-value consignment-profile-link"
                    href={`mailto:${consignor.email}`}
                  >
                    {consignor.email}
                  </a>
                ) : (
                  <span className="consignment-profile-value">
                    —
                  </span>
                )}
              </span>
            </div>

            <div className="consignment-profile-row">
              <span className="consignment-profile-icon">
                <MapPin size={17} />
              </span>

              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">
                  Address
                </span>

                {fullAddress ? (
                  <a
                    className="consignment-profile-value consignment-profile-link"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      fullAddress,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {fullAddress}
                  </a>
                ) : (
                  <span className="consignment-profile-value">
                    —
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="consignment-profile-column">
            <div className="consignment-profile-title">
              Account details
            </div>

            <div className="consignment-profile-row detail">
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">
                  Commission split
                </span>

                <span className="consignment-profile-value">
                  Consignor gets {consignor.commissionPct}%
                </span>
              </span>
            </div>

            <div className="consignment-profile-row detail">
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">
                  Joined
                </span>

                <span className="consignment-profile-value">
                  {consignor.dateJoined || '—'}
                </span>
              </span>
            </div>

            <div className="consignment-profile-row detail">
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">
                  Unsold items
                </span>

                <span className="consignment-profile-value">
                  {consignor.unsoldPreference ||
                    'Please return'}
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* STATS */}

        <div className="consignment-consignor-stats">
          <div className="consignment-consignor-stat">
            <span>Amount due</span>
            <strong>{money(amountDue)}</strong>
          </div>

          <div className="consignment-consignor-stat">
            <span>Total sales</span>
            <strong>{money(totalSales)}</strong>
          </div>

          <div className="consignment-consignor-stat">
            <span>Active items</span>
            <strong>{activeCount}</strong>
          </div>

          <div className="consignment-consignor-stat">
            <span>Store credit</span>
            <strong aria-label="Not available yet">
              &nbsp;
            </strong>
          </div>
        </div>

        {/* ITEMS ON FILE HEADER */}

        <div className="consignment-consignor-items-head">
          <h3>Items on file</h3>

          <div className="consignment-consignor-items-tools">
            <span className="consignment-consignor-items-count">
              {consignorItems.length} total · {draftCount} draft
            </span>

            <div
              className="consignment-consignor-view-toggle"
              aria-label="Choose item view"
            >
              <button
                type="button"
                className={
                  viewMode === 'list' ? 'active' : ''
                }
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
              >
                <List size={14} />
                List
              </button>

              <button
                type="button"
                className={
                  viewMode === 'grid' ? 'active' : ''
                }
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
              >
                <Grid3X3 size={14} />
                Grid
              </button>
            </div>
          </div>
        </div>

        {/* EMPTY STATE */}

        {consignorItems.length === 0 && (
          <div className="consignment-empty">
            <h3>No items yet</h3>

            <p>
              Add the first consignment item for{' '}
              {consignor.firstName}.
            </p>

            <button
              type="button"
              className="consignment-btn"
              onClick={onStartIntake}
            >
              <Plus size={17} />
              Add items
            </button>
          </div>
        )}

        {/* GRID VIEW — GLOBAL ENTITY CARD */}

        {consignorItems.length > 0 &&
          viewMode === 'grid' && (
            <div className="consignment-entity-grid">
              {consignorItems.map((item) => {
                const product = productLabel(item);

                const sold =
                  item.status === 'Sold' ||
                  Boolean(item.dateSold);

                const paid = item.paidOut === true;

                const salePrice = Number(
                  item.salePrice ?? item.price ?? 0,
                );

                const commissionPct = Number(
                  item.commissionPct ??
                    consignor.commissionPct ??
                    0,
                );

                const consignorDue =
                  (salePrice * commissionPct) / 100;

                return (
                  <EntityCard
                    key={item.id}
                    photo={
                      item.shopifyPhoto ||
                      item.photo ||
                      null
                    }
                    title={
                      item.description ||
                      item.type ||
                      'Consignment item'
                    }
                    subtitle={[
                      item.itemNumber,
                      item.size
                        ? `Size ${item.size}`
                        : null,
                      item.brand || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    topBadge={product}
                    metrics={
                      sold
                        ? [
                            {
                              label: 'Sale price',
                              value: money(salePrice),
                            },
                            {
                              label: 'Consignor due',
                              value: money(
                                consignorDue,
                              ),
                            },
                          ]
                        : [
                            {
                              label: 'Price',
                              value: money(
                                item.price,
                              ),
                            },
                            {
                              label: 'Commission',
                              value: `${commissionPct}%`,
                            },
                          ]
                    }
                    detailLabel={
                      sold ? 'Sale date' : 'Status'
                    }
                    detailValue={
                      sold
                        ? item.dateSold || 'Sold'
                        : undefined
                    }
                    detailBadge={{
                      text: paid
                        ? 'Paid'
                        : sold
                          ? 'Unpaid'
                          : statusLabel(
                              item.status,
                            ),
                      className: paid
                        ? 'paid'
                        : sold
                          ? 'unpaid'
                          : statusClass(
                              item.status,
                            ),
                    }}
                    action={
                      sold && !paid ? (
                        <button
                          type="button"
                          className="consignment-sales-pay-btn"
                          onClick={() =>
                            onStartPayout?.(
                              consignor.id,
                            )
                          }
                        >
                          Review &amp; pay
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="consignment-grid-open-btn"
                          onClick={() =>
                            onOpenItem(item.id)
                          }
                        >
                          Open item
                        </button>
                      )
                    }
                  />
                );
              })}
            </div>
          )}

       {/* LIST VIEW */}

{consignorItems.length > 0 &&
  viewMode === 'list' && (
    <div className="consignment-dashboard-list">
      <div className="consignment-dashboard-list-head">
        <span>Item</span>
        <span>Price</span>
        <span>Commission</span>
        <span>Product</span>
        <span>Status</span>
        <span>Action</span>
      </div>

      {consignorItems.map((item) => {
        const product = productLabel(item);

        const sold =
          item.status === 'Sold' ||
          Boolean(item.dateSold);

        const paid = item.paidOut === true;

        const salePrice = Number(
          item.salePrice ?? item.price ?? 0,
        );

        const commissionPct = Number(
          item.commissionPct ??
            consignor.commissionPct ??
            0,
        );

        return (
          <div
            className="consignment-dashboard-list-row"
            key={item.id}
          >
            <button
              type="button"
              className="consignment-dashboard-list-item"
              onClick={() => onOpenItem(item.id)}
            >
              <span className="consignment-dashboard-list-item-copy">
                <strong>
                  {item.description ||
                    item.type ||
                    'Consignment item'}
                </strong>

                <small>
                  {[
                    item.itemNumber,
                    item.size
                      ? `Size ${item.size}`
                      : null,
                    item.brand || null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
            </button>

            <strong className="consignment-dashboard-list-value">
              {money(
                sold
                  ? salePrice
                  : item.price,
              )}
            </strong>

            <span className="consignment-dashboard-list-value">
              {commissionPct}%
            </span>

            <span>
              <span
                className={`consignment-product-badge ${product.className}`}
              >
                {product.text}
              </span>
            </span>

            <span>
              <span
                className={`consignment-badge ${
                  paid
                    ? 'paid'
                    : sold
                      ? 'unpaid'
                      : statusClass(item.status)
                }`}
              >
                {paid
                  ? 'Paid'
                  : sold
                    ? 'Sold · unpaid'
                    : statusLabel(item.status)}
              </span>
            </span>

            <span className="consignment-dashboard-list-action">
              {sold && !paid ? (
                <button
                  type="button"
                  className="consignment-grid-open-btn"
                  onClick={() =>
                    onStartPayout?.(
                      consignor.id,
                    )
                  }
                >
                  Review &amp; pay
                </button>
              ) : (
                <button
                  type="button"
                  className="consignment-grid-open-btn"
                  onClick={() =>
                    onOpenItem(item.id)
                  }
                >
                  Open item
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  )}

      </div>

      {/* DELETE CONFIRMATION */}

      {confirmingDeleteConsignor && (
        <div className="consignment-modal-backdrop">
          <div
            className="consignment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-consignor-title"
          >
            <h3 id="delete-consignor-title">
              Delete consignor?
            </h3>

            <p>
              Delete {consignor.firstName}{' '}
              {consignor.lastName}?
            </p>

            <div className="consignment-modal-actions">
              <button
                type="button"
                className="consignment-btn secondary"
                onClick={() =>
                  setConfirmingDeleteConsignor(
                    false,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="consignment-btn"
                style={{
                  background: 'var(--danger)',
                }}
                onClick={() => {
                  setConfirmingDeleteConsignor(
                    false,
                  );

                  onDeleteConsignor(
                    consignor.id,
                  );
                }}
              >
                <Trash2 size={16} />
                Delete consignor
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}