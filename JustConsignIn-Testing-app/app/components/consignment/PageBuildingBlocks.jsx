import { Search } from 'lucide-react';

// Shared across every screen that shows a row of headline numbers
// (dashboard, items, sales, payouts). `stats` is [{ label, value }].
export function SummaryStatRow({ stats }) {
  return (
    <div className="consignment-stat-row">
      {stats.map((stat) => (
        <div className="consignment-stat-card" key={stat.label}>
          <span className="consignment-stat-label">{stat.label}</span>
          <strong className="consignment-stat-value">{stat.value}</strong>
        </div>
      ))}
    </div>
  );
}

// Shared search + filters + view-toggle bar. `filtersSlot` is whatever
// filter controls the calling screen needs (each screen's filters differ,
// so this stays a passthrough rather than a fixed set of props) — the
// bar itself, spacing, and responsive collapse are what's shared.
export function PageToolbar({
  query,
  onQueryChange,
  placeholder = 'Search',
  filtersSlot = null,
  viewOptions,
  activeView,
  onViewChange,
}) {
  return (
    <div className="consignment-toolbar-block">
      {filtersSlot}
      <div className="consignment-toolbar-row">
        <div className="consignment-search">
          <Search size={18} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} />
        </div>
        {viewOptions && (
          <div className="consignment-view-toggle" aria-label="Choose view">
            {viewOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={activeView === option.key ? 'active' : ''}
                onClick={() => onViewChange(option.key)}
                aria-pressed={activeView === option.key}
              >
                {option.icon && <option.icon size={16} />} {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// One global card layout for item/sale grids. The media section is part of
// the card structure so Shopify/POS/Online cards never need a different card.
// Manual cards simply hide the media section entirely. Tier 2 cards keep the
// media area reserved and display the real Shopify image when one is present.
export function EntityCard({
  photo,
  title,
  subtitle,
  topBadge,
  consignor,
  onOpenConsignor,
  metrics = [],
  detailLabel,
  detailValue,
  detailBadge,
  footNote,
  action,
}) {
  const isManual = topBadge?.className === 'manual';
  const showMedia = !isManual;

  return (
    <article className={`consignment-entity-card${showMedia ? ' has-media' : ' media-hidden'}`}>
      {showMedia && (
        <div className={`consignment-entity-thumb${photo ? ' has-photo' : ' empty'}`} aria-hidden={!photo}>
          {photo && <img src={photo} alt="" />}
        </div>
      )}
      <div className="consignment-entity-body">
        <div className="consignment-entity-card-top">
          <div style={{ minWidth: 0 }}>
            <strong>{title}</strong>
            {subtitle && <small className="consignment-entity-subtitle">{subtitle}</small>}
          </div>
          {topBadge && (
            <span className={`consignment-badge ${topBadge.className}`}>{topBadge.text}</span>
          )}
        </div>

        {consignor !== undefined && (
          consignor ? (
            <button
              type="button"
              className="consignment-entity-consignor-link"
              onClick={() => onOpenConsignor?.(consignor.id)}
            >
              {consignor.firstName} {consignor.lastName}
            </button>
          ) : (
            <span className="consignment-entity-consignor-link" style={{ cursor: 'default', color: 'var(--muted)' }}>
              Unassigned
            </span>
          )
        )}

        {metrics.length > 0 && (
          <div className="consignment-entity-meta">
            {metrics.map((metric) => (
              <span key={metric.label}>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </span>
            ))}
          </div>
        )}

        {(detailLabel || detailBadge) && (
          <div className="consignment-entity-details">
            {detailLabel && (
              <span>
                <small>{detailLabel}</small>
                {detailValue && <strong>{detailValue}</strong>}
              </span>
            )}
            {detailBadge && (
              <span className={`consignment-badge ${detailBadge.className}`}>{detailBadge.text}</span>
            )}
          </div>
        )}

        {footNote && <div className="consignment-entity-footnote">{footNote}</div>}

        {action && <div className="consignment-entity-actions">{action}</div>}
      </div>
    </article>
  );
}
