import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { money } from '../../lib/consignmentHelpers';
import '../../styles/by-consignor-container.css';

export default function ByConsignorContainer({
  consignor,
  summaryItems = [],
  onOpenConsignor,
  onStartPayout,
  children,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const initials = consignor
    ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` || '—'
    : '—';

  const availableCount = summaryItems.filter(
    (item) => (item.status === 'Available' || item.status === 'Active') && !item.paidOut,
  ).length;
  const soldCount = summaryItems.filter((item) => item.status === 'Sold' || item.dateSold).length;
  const total = summaryItems.reduce(
    (sum, item) => sum + Number(item.salePrice ?? item.price ?? 0),
    0,
  );
  const due = summaryItems
    .filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut)
    .reduce(
      (sum, item) => sum + (
        Number(item.salePrice ?? item.price ?? 0)
        * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)
      ) / 100,
      0,
    );

  const stats = [
    { label: 'Available', value: availableCount },
    { label: 'Sold', value: soldCount },
    { label: 'Total', value: money(total) },
    { label: 'Due', value: money(due) },
  ];

  const handlePayout = () => {
    if (!consignor) return;
    if (onStartPayout) onStartPayout(consignor.id);
    else onOpenConsignor?.(consignor.id);
  };

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
              {' '}· {summaryItems.length} item{summaryItems.length === 1 ? '' : 's'}
            </span>
          </span>
        </span>

        {stats.map((stat) => (
          <span className="consignment-item-group-stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </span>
        ))}

        <span className="consignment-by-consignor-action">
          {due > 0 ? (
            <button
              type="button"
              className="consignment-list-action"
              onClick={handlePayout}
            >
              Review &amp; pay
            </button>
          ) : null}
        </span>
      </div>

      {open && <div className="consignment-item-group-items">{children}</div>}
    </section>
  );
}
