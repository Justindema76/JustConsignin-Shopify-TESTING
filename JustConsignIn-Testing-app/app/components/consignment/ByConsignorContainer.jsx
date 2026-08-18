import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export default function ByConsignorContainer({
  consignor,
  itemCount = 0,
  itemLabel = 'items',
  stats = [],
  onOpenConsignor,
  children,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const initials = consignor
    ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` || '—'
    : '—';

  return (
    <section className="consignment-item-group">
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
              {' '}· {itemCount} {itemLabel}
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

      {open && <div className="consignment-item-group-items">{children}</div>}
    </section>
  );
}
