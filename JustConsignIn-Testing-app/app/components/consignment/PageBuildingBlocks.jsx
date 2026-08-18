import { Search } from 'lucide-react';
import '../../styles/consignment-card-grid.css';
import '../../styles/consignment-title-actions.css';

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

export function PageToolbar({ query, onQueryChange, placeholder = 'Search', filtersSlot = null, viewOptions, activeView, onViewChange }) {
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
              <button key={option.key} type="button" className={activeView === option.key ? 'active' : ''} onClick={() => onViewChange(option.key)} aria-pressed={activeView === option.key}>
                {option.icon && <option.icon size={16} />} {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function EntityCard({ photo, title, subtitle, onOpen, topBadge, consignor, onOpenConsignor, metrics = [], detailLabel, detailValue, detailBadge, footNote, action }) {
  const skuText = String(subtitle || '').replace(/^#/, '');

  return (
    <article className="consignment-readable-card">
      <div className="consignment-readable-card-top">
        <div className="consignment-grid-thumb-row">
          {photo && <div className="consignment-grid-thumb"><img src={photo} alt="" /></div>}
          <div className="consignment-readable-title-copy">
            {onOpen ? <button type="button" className="consignment-title-link consignment-readable-title-link" onClick={onOpen}>{title}</button> : <strong>{title}</strong>}
            {skuText && <small className="consignment-readable-card-sku"><b>SKU:</b><span>{skuText}</span></small>}
          </div>
        </div>
        {topBadge && <span className={`consignment-product-badge ${topBadge.className}`}>{topBadge.text}</span>}
      </div>

      {consignor !== undefined && (consignor ? (
        <button type="button" className="consignment-readable-consignor-link" onClick={() => onOpenConsignor?.(consignor.id)}>{consignor.firstName} {consignor.lastName}</button>
      ) : <span className="consignment-readable-consignor-link" style={{ cursor: 'default', color: 'var(--muted)' }}>Unassigned</span>)}

      {metrics.length > 0 && <div className="consignment-readable-card-meta consignment-sales-money-rows">{metrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></span>)}</div>}

      {(detailLabel || detailBadge) && <div className="consignment-readable-card-details"><span>{detailLabel && <small>{detailLabel}</small>}{detailValue && <strong>{detailValue}</strong>}</span>{detailBadge && <span className={`consignment-badge ${detailBadge.className}`}>{detailBadge.text}</span>}</div>}

      {footNote && <div className="consignment-sales-grid-order">{footNote}</div>}
      {action && <div className="consignment-readable-card-actions">{action}</div>}
    </article>
  );
}
