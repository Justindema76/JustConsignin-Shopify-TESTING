import { Search } from 'lucide-react';
import '../../styles/consignment-card-grid.css';

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

// One global card for Items, Sales, and Payouts. Media is only shown when an
// actual photo exists. Manual/no-photo cards use the existing media-hidden
// class instead of reserving an empty image area.
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
  const showMedia = Boolean(photo) && !isManual;

  return (
    <article className={`consignment-entity-card${showMedia ? ' has-media' : ' media-hidden'}`}>
      {showMedia && (
        <div className="consignment-entity-thumb has-photo">
          <img src={photo} alt="" />
        </div>
      )}

      <div className="consignment-entity-body">
        <div className="consignment-entity-card-top">
          <strong>{title}</strong>
          {subtitle && <small className="consignment-entity-subtitle">{subtitle}</small>}
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
            <span className="consignment-entity-consignor-link consignment-entity-consignor-unassigned">Unassigned</span>
          )
        )}

        {metrics.length > 0 && (
          <div className="consignment-entity-meta">
            {metrics.map((metric) => (
              <div className="consignment-entity-row" key={metric.label}>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        )}

        {detailLabel && (
          <div className="consignment-entity-row consignment-entity-detail-row">
            <small>{detailLabel}</small>
            {detailValue && <strong>{detailValue}</strong>}
          </div>
        )}

        {footNote && <div className="consignment-entity-footnote">{footNote}</div>}

        {(topBadge || detailBadge) && (
          <div className="consignment-entity-status-row">
            {topBadge && <span className={`consignment-badge ${topBadge.className}`}>{topBadge.text}</span>}
            {detailBadge && <span className={`consignment-badge ${detailBadge.className}`}>{detailBadge.text}</span>}
          </div>
        )}

        {action && <div className="consignment-entity-actions">{action}</div>}
      </div>
    </article>
  );
}
