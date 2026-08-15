import { Search, Tag } from 'lucide-react';

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
          <Search size={19} />
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

// The one card layout shared by the Items grid and the Sales grid.
// Both screens were rendering their own near-duplicate card before —
// this is that card, generalized: a photo, a title, a top-right badge,
// an optional consignor link, up to two metric rows, one status row,
// an optional footnote line, and one action.
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
  return (
    <article className="consignment-entity-card">
      <div className="consignment-entity-card-top">
        <div className="consignment-entity-thumb-row">
          <div className="consignment-entity-thumb">
            {photo ? <img src={photo} alt="" /> : <Tag size={16} color="var(--muted)" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <strong>{title}</strong>
            {subtitle && <small className="consignment-entity-subtitle">{subtitle}</small>}
          </div>
        </div>
        {topBadge && (
          <span className={`consignment-product-badge ${topBadge.className}`}>{topBadge.text}</span>
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
    </article>
  );
}
