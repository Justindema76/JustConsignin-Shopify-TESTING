/* eslint-disable react/prop-types */
import { useState } from 'react';
import { FileUp, Download, Plus, Grid3X3, Users } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';
import AllConsignorView from '../../components/consignment/AllConsignorView';
import ConsignmentFilterBar from '../../components/consignment/ConsignmentFilterBar';
import { money, productLabel } from '../../lib/consignmentHelpers';

const STATUS_OPTIONS = ['Current', 'Available', 'Unpaid', 'Archived', 'All'];

function matchesStatusFilter(item, filter) {
  if (filter === 'All') return true;
  if (filter === 'Current') return !item.paidOut;
  if (filter === 'Archived') return item.paidOut;
  if (filter === 'Available') return item.status === 'Available' || item.status === 'Active' || item.status === 'Draft';
   if (filter === 'Unpaid') {
    return (
      (item.status === 'Sold' || Boolean(item.dateSold)) &&
      !item.paidOut
    );
  }
  return item.status === filter && !item.paidOut;
}

function statusCount(items, filter) {
  if (filter === 'All') return items.length;
  return items.filter((item) => matchesStatusFilter(item, filter)).length;
}

export default function ConsignorsScreen({ consignors, items, query, setQuery, onOpenConsignor, onOpenItem, onMarkSold, onStartPayout, onNewConsignor, onNewItem, onImport, onExport, tier2Enabled = false }) {
  const [statusFilter, setStatusFilter] = useState('Current');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState(() => tier2Enabled ? 'All' : 'Manual');
  const [sort, setSort] = useState('consignor');
  const [viewMode, setViewMode] = useState('grouped');
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const matchesQuery = !q || `${item.description} ${item.itemNumber} ${item.type} ${item.brand || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const product = productLabel(item);
    const matchesProduct = productFilter === 'All'
      || (productFilter === 'Manual' && product.className === 'manual')
      || (productFilter === 'POS' && product.text === 'POS')
      || (productFilter === 'Online' && product.text === 'Online')
      || (productFilter === 'POS + Online' && product.text === 'POS + Online');
    return matchesQuery && matchesConsignor && matchesProduct && matchesStatusFilter(item, statusFilter);
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

  const grouped = filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());

  if ((statusFilter === 'All' || statusFilter === 'Current') && (productFilter === 'All' || !tier2Enabled)) {
    const q = query.trim().toLowerCase();
    for (const consignor of consignors) {
      if (grouped.has(consignor.id)) continue;
      if (consignorFilter !== 'All' && consignor.id !== consignorFilter) continue;
      const matchesQuery = !q || `${consignor.firstName || ''} ${consignor.lastName || ''} ${consignor.number || ''}`.toLowerCase().includes(q);
      if (!matchesQuery) continue;
      grouped.set(consignor.id, []);
    }
  }

  const groupedEntries = Array.from(grouped.entries()).sort(([aId, aItems], [bId, bItems]) => {
    if (sort !== 'consignor') return filtered.indexOf(aItems[0]) - filtered.indexOf(bItems[0]);
    const a = consignorById[aId];
    const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  const filters = [
    {
      key: 'consignor', label: 'Consignor', value: consignorFilter, onChange: setConsignorFilter, ariaLabel: 'Filter by consignor',
      options: [{ value: 'All', label: 'All consignors' }, ...consignors.map((c) => ({ value: c.id, label: `#${c.number} · ${c.firstName} ${c.lastName}` }))],
    },
    {
      key: 'sort', label: 'Sort', value: sort, onChange: setSort, ariaLabel: 'Sort items',
      options: [
        { value: 'consignor', label: 'Consignor name' }, { value: 'newest', label: 'Newest first' },
        { value: 'oldest', label: 'Oldest first' }, { value: 'ticket', label: 'SKU / item number' },
        { value: 'priceHigh', label: 'Price high to low' }, { value: 'priceLow', label: 'Price low to high' },
      ],
    },
    ...(tier2Enabled ? [{
      key: 'product', label: 'Product type', value: productFilter, onChange: setProductFilter, ariaLabel: 'Filter by product type',
      options: [
        { value: 'All', label: 'All product types' }, { value: 'POS', label: 'POS' },
        { value: 'Online', label: 'Online' }, { value: 'POS + Online', label: 'POS + Online' },
      ],
    }] : []),
    {
      key: 'status', label: 'Status', value: statusFilter, onChange: setStatusFilter, ariaLabel: 'Filter by status',
      options: STATUS_OPTIONS.map((status) => ({ value: status, label: `${status} (${statusCount(items, status)})` })),
    },
  ];

  return (
    <>
      <style>{`
        .consignment-consignor-card-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
        .consignment-consignor-card { padding:16px; gap:12px; border:1px solid var(--line); border-radius:12px; background:var(--surface); min-height:220px; display:flex; flex-direction:column; }
        .consignment-consignor-card-top { display:flex; align-items:center; gap:10px; }
        .consignment-consignor-card-name { min-width:0; }
        .consignment-consignor-card-name strong { display:block; font-size:16px; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .consignment-consignor-card-name small { display:block; margin-top:3px; color:var(--muted); font-size:12px; }
        .consignment-consignor-card-stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .consignment-consignor-card-stats > span { padding:12px 8px; border:1px solid var(--line); border-radius:9px; text-align:center; }
        .consignment-consignor-card-stats strong,.consignment-consignor-card-stats small { display:block; }
        .consignment-consignor-card-stats strong { font-size:20px; }
        .consignment-consignor-card-stats small { margin-top:3px; color:var(--muted); font-size:10px; text-transform:uppercase; font-weight:700; }
        .consignment-consignor-card-due { margin-top:auto; font-size:12px; color:var(--muted); }
        .consignment-consignor-card-due small,.consignment-consignor-card-due strong { display:block; }
        .consignment-consignor-card-due strong { margin-top:3px; color:var(--ink); font-size:20px; }
        .consignment-consignor-card-open { width:100%; height:42px; border:1px solid var(--green); border-radius:9px; background:var(--surface-subtle); color:var(--green-dark); font-size:13px; font-weight:700; cursor:pointer; }
        .consignment-consignor-card-open:hover { background:var(--green-soft); }
        @media (max-width:950px) { .consignment-consignor-card-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width:700px) {
          .consignment-consignor-card-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .consignment-consignor-card { min-height:0; padding:12px; gap:9px; }
          .consignment-consignor-card .consignment-avatar { width:38px; height:38px; font-size:13px; }
          .consignment-consignor-card-name strong { font-size:14px; }
          .consignment-consignor-card-stats strong,.consignment-consignor-card-due strong { font-size:16px; }
          .consignment-consignor-card-open { height:38px; font-size:12px; }
        }
      `}</style>
      <Header eyebrow="Accounts" title="Consignors" action={(
        <div className="consignment-header-actions consignment-consignors-header-actions">
          <details className="consignment-data-menu"><summary><FileUp size={16} /> Data</summary><div className="consignment-data-menu-popover"><button type="button" onClick={onImport}><FileUp size={15} /> Import CSV</button><button type="button" onClick={onExport}><Download size={15} /> Export CSV</button></div></details>
          <button className="consignment-btn secondary" type="button" onClick={onNewItem}><Plus size={16} /> New item</button>
          <button className="consignment-btn" type="button" onClick={onNewConsignor}><Plus size={17} /> New consignor</button>
        </div>
      )} />
      <div className="consignment-body">
        <ConsignmentFilterBar
          search={{ value: query, onChange: setQuery, placeholder: 'Search name, SKU, brand, or consignor' }}
          filters={filters}
          views={{ value: viewMode, onChange: setViewMode, ariaLabel: 'Choose consignor view', options: [{ value: 'grouped', label: 'By consignor', icon: Users }, { value: 'grid', label: 'Grid', icon: Grid3X3 }] }}
        />
        {groupedEntries.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">No consignors match these filters.</div></section>}
        {viewMode === 'grouped' && <div className="consignment-item-groups">{groupedEntries.map(([consignorId, consignorItems]) => <AllConsignorView key={consignorId} consignor={consignorById[consignorId]} items={consignorItems} onOpenConsignor={onOpenConsignor} onOpenItem={onOpenItem} onMarkSold={onMarkSold} onStartPayout={onStartPayout} />)}</div>}
        {viewMode === 'grid' && groupedEntries.length > 0 && (
          <div className="consignment-consignor-card-grid">
            {groupedEntries.map(([consignorId, consignorItems]) => {
              const consignor = consignorById[consignorId];
              const initials = consignor ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` : '—';
              const availableCount = consignorItems.filter((item) => item.status === 'Available' || item.status === 'Active').length;
              const unpaidCount = consignorItems.filter(
                (item) =>
                  (item.status === 'Sold' || item.dateSold) &&
                  !item.paidOut
              ).length;              

              const due = consignorItems.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).reduce((sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100, 0);
              return (
                <article className="consignment-consignor-card" key={consignorId}>
                  <div className="consignment-consignor-card-top"><span className="consignment-avatar">{initials}</span><span className="consignment-consignor-card-name"><strong>{consignor ? `${consignor.firstName} ${consignor.lastName}` : 'Unassigned'}</strong><small>#{consignor?.number || '—'}</small></span></div>
                  <div className="consignment-consignor-card-stats"><span><strong>{availableCount}</strong><small>Active</small></span><span><strong>{unpaidCount}</strong><small>Unpaid</small></span></div>                  <div className="consignment-consignor-card-due"><small>Amount due</small><strong>{money(due)}</strong></div>
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
