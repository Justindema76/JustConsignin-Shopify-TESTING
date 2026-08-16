import { useState } from 'react';
import { ChevronDown, ChevronRight, Grid3X3, List, Plus, Users } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';
import { SummaryStatRow, PageToolbar, EntityCard } from '../../components/consignment/PageBuildingBlocks';
import { money, productLabel, statusClass, statusLabel } from '../../lib/consignmentHelpers';

export default function ItemsScreen({ items, consignors, onOpenItem, onOpenConsignor, onMarkSold, onStartPayout, onNewItem }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Current');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState('All');
  const [sort, setSort] = useState('consignor');
  const [viewMode, setViewMode] = useState('grouped');
  const [sellingItemId, setSellingItemId] = useState(null);
  const [openGroups, setOpenGroups] = useState({});
  const statuses = ['Current', 'Draft', 'Available', 'Sold', 'Archived', 'Returned', 'Donated'];
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const matchesQuery = !q || `${item.description || ''} ${item.itemNumber || ''} ${item.type || ''} ${item.brand || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const product = productLabel(item);
    const matchesProduct = productFilter === 'All'
      || (productFilter === 'Manual' && product.className === 'manual')
      || (productFilter === 'POS' && product.text === 'POS')
      || (productFilter === 'Online' && product.text === 'Online')
      || (productFilter === 'POS + Online' && product.text === 'POS + Online');
    const matchesStatus = filter === 'Current'
      ? !item.paidOut
      : filter === 'Archived'
        ? item.paidOut
        : filter === 'Available'
          ? item.status === 'Available' || item.status === 'Active'
          : item.status === filter && !item.paidOut;
    return matchesQuery && matchesConsignor && matchesProduct && matchesStatus;
  }).sort((a, b) => {
    if (sort === 'oldest') return String(a.dateReceived || '').localeCompare(String(b.dateReceived || ''));
    if (sort === 'consignor') {
      const aName = `${consignorById[a.consignorId]?.lastName || ''} ${consignorById[a.consignorId]?.firstName || ''}`;
      const bName = `${consignorById[b.consignorId]?.lastName || ''} ${consignorById[b.consignorId]?.firstName || ''}`;
      return aName.localeCompare(bName) || String(a.itemNumber || '').localeCompare(String(b.itemNumber || ''), undefined, { numeric: true });
    }
    if (sort === 'ticket') return String(a.itemNumber || '').localeCompare(String(b.itemNumber || ''), undefined, { numeric: true });
    if (sort === 'priceHigh') return Number(b.price || 0) - Number(a.price || 0);
    if (sort === 'priceLow') return Number(a.price || 0) - Number(b.price || 0);
    return String(b.dateReceived || '').localeCompare(String(a.dateReceived || '')) || String(b.itemNumber || '').localeCompare(String(a.itemNumber || ''), undefined, { numeric: true });
  });

  const groupedEntries = Array.from(filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map()).entries()).sort(([aId], [bId]) => {
    const a = consignorById[aId];
    const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  const activeCount = items.filter((item) => !item.paidOut).length;
  const availableCount = items.filter((item) => item.status === 'Available' || item.status === 'Active').length;
  const soldCount = items.filter((item) => item.status === 'Sold' || item.dateSold).length;

  async function quickMarkSold(item) {
    if (sellingItemId) return;
    const amount = window.prompt(`Sale price for ${item.description || item.itemNumber}`, String(item.price ?? ''));
    if (amount === null) return;
    const salePrice = Number(amount);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      window.alert('Enter a valid sale price.');
      return;
    }
    setSellingItemId(item.id);
    try {
      await onMarkSold(item.id, { salePrice, dateSold: new Date().toISOString().slice(0, 10) });
    } finally {
      setSellingItemId(null);
    }
  }

  function itemAction(item) {
    const consignor = consignorById[item.consignorId];
    const product = productLabel(item);
    const sold = item.status === 'Sold' || Boolean(item.dateSold);
    const paid = item.paidOut === true;
    const isManualAvailable = product.className === 'manual' && !sold && !paid && (item.status === 'Available' || item.status === 'Active');

    return (
      <>
        <button type="button" className="consignment-grid-open-btn" onClick={() => onOpenItem(item.id)}>
          Edit item
        </button>
        {isManualAvailable && (
          <button type="button" className="consignment-list-action" disabled={sellingItemId === item.id} onClick={() => quickMarkSold(item)}>
            {sellingItemId === item.id ? 'Saving…' : 'Mark sold'}
          </button>
        )}
        {sold && !paid && consignor && (
          <button type="button" className="consignment-sales-pay-btn" onClick={() => onStartPayout?.(consignor.id)}>
            Review &amp; pay
          </button>
        )}
        {paid && (
          <button type="button" className="consignment-grid-open-btn" disabled>
            Paid
          </button>
        )}
      </>
    );
  }

  function itemCard(item, showConsignor) {
    const consignor = consignorById[item.consignorId];
    const product = productLabel(item);
    return (
      <EntityCard
        key={item.id}
        photo={item.shopifyPhoto || item.photo}
        title={item.description || item.type || 'Consignment item'}
        subtitle={`#${item.itemNumber || '—'}${item.size ? ` · ${item.size}` : ''}${item.brand ? ` · ${item.brand}` : ''}`}
        topBadge={product}
        consignor={showConsignor ? (consignor || null) : undefined}
        onOpenConsignor={onOpenConsignor}
        metrics={[{ label: 'Price', value: money(item.price) }, { label: 'Commission', value: `${item.commissionPct ?? consignor?.commissionPct ?? 0}%` }]}
        detailLabel="Status"
        detailBadge={{ text: item.paidOut ? 'Paid · archived' : statusLabel(item.status), className: item.paidOut ? 'sold' : statusClass(item.status) }}
        action={itemAction(item)}
      />
    );
  }

  function allItemsView() {
    return (
      <div className="consignment-list-table-wrap">
        <table className="consignment-list-table">
          <thead><tr><th>Item</th><th>Consignor</th><th>Price</th><th>Commission</th><th>Source</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{filtered.map((item) => {
            const consignor = consignorById[item.consignorId];
            const product = productLabel(item);
            return (
              <tr key={item.id}>
                <td><button className="consignment-title-link" type="button" onClick={() => onOpenItem(item.id)}><strong>{item.description || item.type || 'Consignment item'}</strong></button><small>#{item.itemNumber || '—'}{item.brand ? ` · ${item.brand}` : ''}</small></td>
                <td>{consignor ? <button className="consignment-consignor-link" type="button" onClick={() => onOpenConsignor?.(consignor.id)}>{consignor.firstName} {consignor.lastName}</button> : 'Unassigned'}</td>
                <td className="consignment-money">{money(item.price)}</td>
                <td>{item.commissionPct ?? consignor?.commissionPct ?? 0}%</td>
                <td><span className={`consignment-badge ${product.className}`}>{product.text}</span></td>
                <td><span className={`consignment-badge ${item.paidOut ? 'sold' : statusClass(item.status)}`}>{item.paidOut ? 'Paid · archived' : statusLabel(item.status)}</span></td>
                <td>{itemAction(item)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }

  function groupedView() {
    return groupedEntries.map(([consignorId, consignorItems]) => {
      const consignor = consignorById[consignorId];
      const open = openGroups[consignorId] !== false;
      const sold = consignorItems.filter((item) => item.status === 'Sold' || item.dateSold).length;
      const total = consignorItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
      const due = consignorItems.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).reduce((sum, item) => {
        const salePrice = Number(item.salePrice ?? item.price ?? 0);
        return sum + (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
      }, 0);
      const initials = `${consignor?.firstName?.[0] || ''}${consignor?.lastName?.[0] || ''}` || '—';
      return (
        <section className="consignment-list-group" key={consignorId}>
          <button type="button" className="consignment-list-group-head" onClick={() => setOpenGroups((current) => ({ ...current, [consignorId]: !open }))}>
            <span className="consignment-list-chevron"><ChevronRight size={15} style={{ transform: open ? 'rotate(90deg)' : 'none' }} /></span>
            <span className="consignment-list-avatar">{initials}</span>
            <span className="consignment-list-person">
              <span className="consignment-list-person-name" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); if (consignor) onOpenConsignor?.(consignor.id); }} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && consignor) { event.preventDefault(); event.stopPropagation(); onOpenConsignor?.(consignor.id); } }}>{consignor ? `${consignor.firstName} ${consignor.lastName}` : 'Unassigned'}</span>
              <small>Consignor #{consignor?.number || '—'}</small>
            </span>
            <span className="consignment-list-stat"><strong>{consignorItems.length}</strong><small>Items</small></span>
            <span className="consignment-list-stat"><strong>{sold}</strong><small>Sold</small></span>
            <span className="consignment-list-stat"><strong>{money(total)}</strong><small>Total</small></span>
            <span className="consignment-list-stat"><strong>{money(due)}</strong><small>Due</small></span>
          </button>
          {open && (
            <div className="consignment-list-group-body">
              <div className="consignment-list-labels consignment-items-columns"><span>Item</span><span>Price</span><span>Commission</span><span>Source</span><span>Status</span><span>Action</span></div>
              {consignorItems.map((item) => {
                const product = productLabel(item);
                return (
                  <div className="consignment-list-row consignment-items-columns" key={item.id}>
                    <div className="consignment-list-item-main"><button className="consignment-title-link" type="button" onClick={() => onOpenItem(item.id)}>{item.description || item.type || 'Consignment item'}</button><small>#{item.itemNumber || '—'}{item.size ? ` · ${item.size}` : ''}{item.brand ? ` · ${item.brand}` : ''}</small></div>
                    <strong className="consignment-money">{money(item.price)}</strong>
                    <span>{item.commissionPct ?? consignor?.commissionPct ?? 0}%</span>
                    <span><span className={`consignment-badge ${product.className}`}>{product.text}</span></span>
                    <span><span className={`consignment-badge ${item.paidOut ? 'sold' : statusClass(item.status)}`}>{item.paidOut ? 'Paid · archived' : statusLabel(item.status)}</span></span>
                    <span>{itemAction(item)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      );
    });
  }

  const filtersSlot = (
    <details className="consignment-items-filter-details">
      <summary className="consignment-items-filter-summary"><span>Filters &amp; sorting</span><ChevronDown size={20} aria-hidden="true" /></summary>
      <div className="consignment-items-toolbar-top">
        <label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)}><option value="All">All consignors</option>{consignors.map((consignor) => <option key={consignor.id} value={consignor.id}>#{consignor.number} · {consignor.firstName} {consignor.lastName}</option>)}</select></label>
        <label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="consignor">Consignor name</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="ticket">SKU / item number</option><option value="priceHigh">Price high to low</option><option value="priceLow">Price low to high</option></select></label>
        <label className="consignment-tool-field"><span>Product type</span><select className="consignment-select consignment-filter-select" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="All">All product types</option><option value="Manual">Manual</option><option value="POS">POS</option><option value="Online">Online</option><option value="POS + Online">POS + Online</option></select></label>
        <label className="consignment-tool-field"><span>Status</span><select className="consignment-select consignment-filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>{statuses.map((status) => { const count = status === 'Current' ? items.filter((item) => !item.paidOut).length : status === 'Archived' ? items.filter((item) => item.paidOut).length : items.filter((item) => item.status === status && !item.paidOut).length; return <option key={status} value={status}>{statusLabel(status)} ({count})</option>; })}</select></label>
      </div>
    </details>
  );

  return (
    <>
      <Header eyebrow="Inventory" title="Items" action={<button className="consignment-btn" type="button" onClick={onNewItem}><Plus size={17} /> Add new item</button>} />
      <div className="consignment-body consignment-online-layout">
        <SummaryStatRow stats={[{ label: 'Active items', value: activeCount }, { label: 'Available', value: availableCount }, { label: 'Sold', value: soldCount }, { label: 'Total items', value: items.length }]} />
        <PageToolbar query={query} onQueryChange={setQuery} placeholder="Search name, SKU, brand, or consignor" filtersSlot={filtersSlot} viewOptions={[{ key: 'all', label: 'All items', icon: List }, { key: 'grouped', label: 'By consignor', icon: Users }, { key: 'grid', label: 'Grid', icon: Grid3X3 }]} activeView={viewMode} onViewChange={setViewMode} />
        {filtered.length === 0 && <div className="consignment-empty-small">No items match these filters.</div>}
        {viewMode === 'all' && filtered.length > 0 && allItemsView()}
        {viewMode === 'grouped' && filtered.length > 0 && groupedView()}
        {viewMode === 'grid' && filtered.length > 0 && <div className="consignment-entity-grid">{filtered.map((item) => itemCard(item, true))}</div>}
      </div>
    </>
  );
}
