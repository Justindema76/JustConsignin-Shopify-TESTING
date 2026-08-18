import { useState } from 'react';
import { ChevronDown, Grid3X3, Plus, Users } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';
import { PageToolbar } from '../../components/consignment/PageBuildingBlocks';
import ByConsignorContainer from '../../components/consignment/ByConsignorContainer';
import { money, productLabel, statusLabel } from '../../lib/consignmentHelpers';

export default function ConsignorsScreen({
  consignors,
  items,
  query,
  setQuery,
  onOpenConsignor,
  onOpenItem,
  onMarkSold,
  onStartPayout,
  onNewConsignor,
  onNewItem,
}) {
  const [filter, setFilter] = useState('All');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState('All');
  const [sort, setSort] = useState('consignor');
  const [viewMode, setViewMode] = useState('grouped');
  const statuses = ['All', 'Draft', 'Available', 'Sold', 'Archived', 'Returned', 'Donated'];
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const product = productLabel(item);
    const matchesQuery = !q || `${item.description || ''} ${item.itemNumber || ''} ${item.type || ''} ${item.brand || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const matchesProduct = productFilter === 'All'
      || (productFilter === 'Manual' && product.className === 'manual')
      || (productFilter === 'POS' && product.text === 'POS')
      || (productFilter === 'Online' && product.text === 'Online')
      || (productFilter === 'POS + Online' && product.text === 'POS + Online');
    const matchesStatus = filter === 'All'
      ? true
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
    return String(b.dateReceived || '').localeCompare(String(a.dateReceived || ''));
  });

  const grouped = filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());

  if (filter === 'All' && productFilter === 'All') {
    const q = query.trim().toLowerCase();
    consignors.forEach((consignor) => {
      if (grouped.has(consignor.id)) return;
      if (consignorFilter !== 'All' && consignor.id !== consignorFilter) return;
      if (q && !`${consignor.firstName || ''} ${consignor.lastName || ''} ${consignor.number || ''}`.toLowerCase().includes(q)) return;
      grouped.set(consignor.id, []);
    });
  }

  const groupedEntries = Array.from(grouped.entries()).sort(([aId], [bId]) => {
    const a = consignorById[aId];
    const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  const filtersSlot = (
    <details className="consignment-items-filter-details">
      <summary className="consignment-items-filter-summary"><span>Filters &amp; sorting</span><ChevronDown size={20} /></summary>
      <div className="consignment-items-toolbar-top">
        <label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)}><option value="All">All consignors</option>{consignors.map((consignor) => <option key={consignor.id} value={consignor.id}>#{consignor.number} · {consignor.firstName} {consignor.lastName}</option>)}</select></label>
        <label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="consignor">Consignor name</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="ticket">SKU / item number</option><option value="priceHigh">Price high to low</option><option value="priceLow">Price low to high</option></select></label>
        <label className="consignment-tool-field"><span>Product type</span><select className="consignment-select consignment-filter-select" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="All">All product types</option><option value="Manual">Manual</option><option value="POS">POS</option><option value="Online">Online</option><option value="POS + Online">POS + Online</option></select></label>
        <label className="consignment-tool-field"><span>Status</span><select className="consignment-select consignment-filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
      </div>
    </details>
  );

  return (
    <>
      <Header eyebrow="Accounts" title="Consignors" action={<div className="consignment-header-actions consignment-header-actions-full"><button className="consignment-btn secondary" type="button" onClick={onNewItem}><Plus size={17} /> New item</button><button className="consignment-btn" type="button" onClick={onNewConsignor}><Plus size={17} /> New consignor</button></div>} />
      <div className="consignment-body consignment-online-layout">
        <PageToolbar query={query} onQueryChange={setQuery} placeholder="Search name, SKU, brand, or consignor" filtersSlot={filtersSlot} viewOptions={[{ key: 'grouped', label: 'By consignor', icon: Users }, { key: 'grid', label: 'Grid', icon: Grid3X3 }]} activeView={viewMode} onViewChange={setViewMode} />

        {groupedEntries.length === 0 && <div className="consignment-empty-small">No consignors match these filters.</div>}

        {viewMode === 'grouped' && (
          <div className="consignment-item-groups">
            {groupedEntries.map(([consignorId, consignorItems]) => (
              <ByConsignorContainer
                key={consignorId}
                consignor={consignorById[consignorId]}
                items={consignorItems}
                variant="inventory"
                onOpenConsignor={onOpenConsignor}
                onOpenItem={onOpenItem}
                onMarkSold={onMarkSold}
                onStartPayout={onStartPayout}
              />
            ))}
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="consignment-consignor-card-grid">
            {groupedEntries.map(([consignorId, consignorItems]) => {
              const consignor = consignorById[consignorId];
              const initials = consignor ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` : '—';
              const availableCount = consignorItems.filter((item) => item.status === 'Available' || item.status === 'Active').length;
              const soldCount = consignorItems.filter((item) => item.status === 'Sold' || item.dateSold).length;
              const due = consignorItems.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).reduce((sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100, 0);
              return (
                <article className="consignment-consignor-card" key={consignorId}>
                  <div className="consignment-consignor-card-top"><span className="consignment-avatar">{initials}</span><span className="consignment-consignor-card-name"><strong>{consignor ? `${consignor.firstName} ${consignor.lastName}` : 'Unassigned'}</strong><small>#{consignor?.number || '—'}</small></span></div>
                  <div className="consignment-consignor-card-stats"><span><strong>{availableCount}</strong><small>Active</small></span><span><strong>{soldCount}</strong><small>Sold</small></span></div>
                  <div className="consignment-consignor-card-due"><small>Amount due</small><strong>{money(due)}</strong></div>
                  <button type="button" className="consignment-consignor-card-open" onClick={() => onOpenConsignor(consignorId)}>View consignor</button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
